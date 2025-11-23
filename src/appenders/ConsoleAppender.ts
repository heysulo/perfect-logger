import { LogEntry, ConsoleAppenderConfig } from '../core/types';
import { BaseAppender } from './BaseAppender';
import { LogLevel } from '../constants';
import { safeStringify } from '../utils/safeStringify';

const DEFAULT_FORMAT = '{date} | {time} | {level} | {namespace} | {message}';

export class ConsoleAppender extends BaseAppender {
    private readonly formatTemplate: string;
    private readonly dateFormatter: Intl.DateTimeFormat;
    private readonly timeFormatter: Intl.DateTimeFormat;

    constructor(config: ConsoleAppenderConfig = {}) {
        super('ConsoleAppender', config, { minLevel: LogLevel.INFO });
        this.formatTemplate = config.format || DEFAULT_FORMAT;

        this.dateFormatter = new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: this.timezone,
        });

        this.timeFormatter = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false,
            timeZone: this.timezone,
        });
    }

    public handle(entry: LogEntry): void {
        if (entry.level < this.minLevel) {
            return
        }

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
        // Use formatToParts for a guaranteed YYYY/MM/DD format
        const parts = this.dateFormatter.formatToParts(entry.timestamp);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        const date = `${year}/${month}/${day}`;

        // Manually construct time to include milliseconds for ES2019 compatibility
        const baseTime = this.timeFormatter.format(entry.timestamp);
        const milliseconds = entry.timestamp.getMilliseconds().toString().padStart(3, '0');
        const time = `${baseTime}.${milliseconds}`;

        const level = (LogLevel[entry.level] || 'UNKNOWN');
        
        const contextString = entry.context ? ` ${safeStringify(entry.context)}` : '';
        const errorString = entry.error ? `\n${entry.error.stack || entry.error.message}` : '';

        return this.formatTemplate
            .replace('{date}', date)
            .replace('{time}', time)
            .replace('{level}', level)
            .replace('{namespace}', entry.namespace)
            .replace('{message}', entry.message)
            .replace('{context}', contextString)
            .replace('{error}', errorString);
    }
}
