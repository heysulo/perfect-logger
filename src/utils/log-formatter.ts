import { LogLevel } from '../constants';
import { LogEntry } from '../core/types';

const DEFAULT_FORMAT = '{date} | {time} | {level} | {namespace} | {message}';

/**
 * Shared formatting utility used by appenders.
 * Extracts the duplicated date/time/level formatting logic into a single place.
 */
export class LogFormatter {
    public readonly formatTemplate: string;
    private readonly dateFormatter: Intl.DateTimeFormat;
    private readonly timeFormatter: Intl.DateTimeFormat;

    constructor(format?: string, timezone?: string) {
        this.formatTemplate = format || DEFAULT_FORMAT;

        this.dateFormatter = new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: timezone,
        });

        this.timeFormatter = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false,
            timeZone: timezone,
        });
    }

    /**
     * Formats a date as YYYY/MM/DD using the configured timezone.
     */
    public formatDate(timestamp: Date): string {
        const parts = this.dateFormatter.formatToParts(timestamp);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        return `${year}/${month}/${day}`;
    }

    /**
     * Formats a time as HH:MM:SS.mmm using the configured timezone.
     */
    public formatTime(timestamp: Date): string {
        const baseTime = this.timeFormatter.format(timestamp);
        const milliseconds = timestamp.getMilliseconds().toString().padStart(3, '0');
        return `${baseTime}.${milliseconds}`;
    }

    /**
     * Returns the string name for a LogLevel value.
     */
    public formatLevel(level: LogLevel): string {
        return LogLevel[level] || 'UNKNOWN';
    }

    /**
     * Applies the format template with all standard placeholders replaced.
     * Context and error placeholders are replaced with empty strings by default;
     * callers handle those separately based on their output needs.
     */
    public format(entry: LogEntry, overrides?: { context?: string; error?: string }): string {
        const date = this.formatDate(entry.timestamp);
        const time = this.formatTime(entry.timestamp);
        const level = this.formatLevel(entry.level);
        const context = overrides?.context ?? '';
        const error = overrides?.error ?? '';

        return this.formatTemplate
            .replace('{date}', date)
            .replace('{time}', time)
            .replace('{level}', level)
            .replace('{namespace}', entry.namespace)
            .replace('{message}', entry.message)
            .replace('{context}', context)
            .replace('{error}', error);
    }
}
