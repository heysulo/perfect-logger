import { LoggerConfig, LogEntry } from './types';
import { LogLevel } from '../constants';
import { Logger } from './Logger';

/**
 * The singleton LogManager class.
 * It holds the central configuration and dispatches log entries to the appenders.
 */
export class LogManager {
    private static instance: LogManager;
    private config: LoggerConfig;

    private constructor() {
        this.config = {
            minLevel: LogLevel.INFO,
            appenders: [],
            timezone: undefined,
        };
    }

    public static getInstance(): LogManager {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
        }
        return LogManager.instance;
    }

    /**
     * Configures the LogManager. This should be called once at application startup.
     * @param config The configuration object.
     */
    public configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };

        // Pass the global timezone to appenders that don't have one
        this.config.appenders.forEach(appender => {
            if ('timezone' in appender && !(appender as any).timezone) {
                (appender as any).timezone = this.config.timezone;
            }
        });
    }

    /**
     * Creates a new Logger instance.
     * @param namespace The name of the logger.
     * @returns A new Logger.
     */
    public getLogger(namespace: string): Logger {
        return new Logger(this, namespace);
    }

    /**
     * Dispatches a log entry to all configured appenders.
     * This is called by the Logger instances.
     * @param entry The log entry to dispatch.
     */
    public dispatch(entry: LogEntry): void {
        if (entry.level >= this.config.minLevel) {
            for (const appender of this.config.appenders) {
                // The type assertion is a bit of a hack, but it's necessary
                // because the Appender interface doesn't have a log method.
                (appender as any).log(entry);
            }
        }
    }
}
