import { LogLevel } from '../constants';
import { LogManager } from './LogManager';
import { LogEntry } from './types';

/**
 * The user-facing logger class.
 * It provides methods for logging at different levels (info, warn, error, etc.)
 * and for creating contextual child loggers.
 */
export class Logger {
    /**
     * @param logManager The singleton LogManager instance.
     * @param namespace The name of the logger (e.g., "AuthService").
     * @param context Contextual data to be included with every log from this logger.
     */
    constructor(
        private readonly logManager: LogManager,
        public readonly namespace: string,
        private readonly context: Record<string, any> = {}
    ) {}

    public trace(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.TRACE, message, context);
    }

    public debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    public info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context);
    }

    public warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context);
    }

    public error(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context, error);
    }

    public fatal(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.FATAL, message, context, error);
    }

    /**
     * Creates a child logger that inherits the parent's context.
     * @param context Additional context to add to the child logger.
     * @returns A new Logger instance.
     */
    public child(context: Record<string, any>): Logger {
        const mergedContext = { ...this.context, ...context };
        return new Logger(this.logManager, this.namespace, mergedContext);
    }

    private log(level: LogLevel, message: string, localContext?: Record<string, any>, error?: Error): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            namespace: this.namespace,
            message,
            context: { ...this.context, ...localContext },
            error,
        };

        if (Object.keys(entry.context!).length === 0) {
            delete entry.context;
        }

        this.logManager.dispatch(entry);
    }
}
