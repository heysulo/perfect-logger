import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './BaseAppender';
import { LogLevel } from '../constants';
import { safeStringify } from '../utils/safeStringify';

export interface JsonAppenderConfig extends AppenderConfig {}

export class JsonAppender extends BaseAppender {
    constructor(config: JsonAppenderConfig = {}) {
        super('JsonAppender', config, { minLevel: LogLevel.INFO });
    }

    public handle(entry: LogEntry): void {
        // The BaseAppender already filters by minLevel, so we don't need to check here.
        const logObject = this.prepareForJson(entry);
        const logLine = safeStringify(logObject);

        // We use the same console methods as ConsoleAppender for consistency
        switch (entry.level) {
            case LogLevel.TRACE:
                console.trace(logLine);
                break;
            case LogLevel.DEBUG:
                console.debug(logLine);
                break;
            case LogLevel.INFO:
                console.info(logLine);
                break;
            case LogLevel.WARN:
                console.warn(logLine);
                break;
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(logLine);
                break;
            default:
                console.log(logLine);
        }
    }

    /**
     * Prepares the log entry for JSON serialization, creating a clean and standard object.
     */
    private prepareForJson(entry: LogEntry): Record<string, unknown> {
        const output: Record<string, unknown> = {
            timestamp: entry.timestamp.toISOString(),
            level: LogLevel[entry.level] || 'UNKNOWN',
            namespace: entry.namespace,
            message: entry.message,
        };

        if (entry.context) {
            output.context = entry.context;
        }

        if (entry.error) {
            // We expand the error object for better readability in JSON logs
            output.error = {
                name: entry.error.name,
                message: entry.error.message,
                stack: entry.error.stack,
            };
        }

        return output;
    }
}
