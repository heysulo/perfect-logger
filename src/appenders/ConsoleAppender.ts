import { LogEntry, ConsoleAppenderConfig } from '../core/types';
import { BaseAppender } from './BaseAppender';
import { LogLevel } from '../constants';
import { LogFormatter } from '../utils/LogFormatter';
import { safeStringify } from '../utils/safeStringify';

export class ConsoleAppender extends BaseAppender {
    private readonly formatter: LogFormatter;

    constructor(config: ConsoleAppenderConfig = {}) {
        super('ConsoleAppender', config, { minLevel: LogLevel.INFO });
        this.formatter = new LogFormatter(config.format, this.timezone);
    }

    public handle(entry: LogEntry): void {
        const logLine = this.formatLog(entry);

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

    private formatLog(entry: LogEntry): string {
        const contextString = entry.context ? ` ${safeStringify(entry.context)}` : '';
        const errorString = entry.error ? `\n${entry.error.stack || entry.error.message}` : '';

        return this.formatter.format(entry, {
            context: contextString,
            error: errorString,
        });
    }
}
