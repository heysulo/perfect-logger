import { Layout } from './layout';
import { LogEntry } from '../core/types';
import { LogLevel } from '../constants';
import { safeStringify } from '../utils/safe-stringify';

export interface PatternLayoutOptions {
    /**
     * The pattern string defining the output format.
     * Supports Log4j conversion specifiers (%d, %p, %c, %m, %X, %ex, %n)
     * as well as legacy placeholders ({date}, {time}, {level}, {namespace}, {message}, {context}, {error}).
     * Default: '%d | %p | %c | %m'
     */
    pattern?: string;

    /**
     * IANA Timezone string (e.g., 'America/New_York', 'UTC').
     * Defaults to system timezone.
     */
    timezone?: string;

    /**
     * If true, append error stack traces automatically when %ex / {error} is not in the pattern.
     * Default: true.
     */
    alwaysAppendError?: boolean;

    /**
     * If true, append context object string automatically when %X / {context} is not in the pattern.
     * Default: false.
     */
    alwaysAppendContext?: boolean;
}

export const DEFAULT_PATTERN = '{date} | {time} | {level} | {namespace} | {message}';

export class PatternLayout implements Layout {
    public readonly contentType = 'text/plain';
    private readonly pattern: string;
    private readonly timezone?: string;
    private readonly alwaysAppendError: boolean;
    private readonly alwaysAppendContext: boolean;
    private readonly dateFormatter: Intl.DateTimeFormat;
    private readonly timeFormatter: Intl.DateTimeFormat;

    constructor(options: PatternLayoutOptions = {}) {
        this.pattern = options.pattern || DEFAULT_PATTERN;
        this.timezone = options.timezone;
        this.alwaysAppendError = options.alwaysAppendError ?? true;
        this.alwaysAppendContext = options.alwaysAppendContext ?? false;

        this.dateFormatter = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: this.timezone,
        });

        this.timeFormatter = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: this.timezone,
        });
    }

    public format(entry: LogEntry): string {
        let output = this.pattern;

        // 1. Format date/time
        // Supports %d, %d{ISO8601}, %d{date}, %d{time}, {date}, {time}
        const hasDatePattern = /%d(\{[^}]*\})?/.test(output);
        if (hasDatePattern) {
            output = output.replace(/%d(\{[^}]*\})?/g, (_, formatSpecifier) => {
                const spec = formatSpecifier ? formatSpecifier.slice(1, -1).trim() : '';
                return this.formatTimestamp(entry.timestamp, spec);
            });
        }

        // Legacy {date} and {time}
        if (output.includes('{date}')) {
            output = output.replace(/\{date\}/g, this.formatDateOnly(entry.timestamp));
        }
        if (output.includes('{time}')) {
            output = output.replace(/\{time\}/g, this.formatTimeOnly(entry.timestamp));
        }

        // 2. Log Level: %p, %level, {level}
        const levelStr = LogLevel[entry.level] || 'UNKNOWN';
        output = output
            .replace(/%p\b|%level\b|\{level\}/g, levelStr);

        // 3. Namespace / Logger name: %c, %c{n}, %logger, {namespace}
        output = output.replace(/%c(\{(\d+)\})?|%logger\b|\{namespace\}/g, (_, __, depthStr) => {
            if (depthStr) {
                const depth = parseInt(depthStr, 10);
                const parts = entry.namespace.split('.');
                return parts.slice(Math.max(0, parts.length - depth)).join('.');
            }
            return entry.namespace;
        });

        // 4. Message: %m, %msg, %message, {message}
        output = output.replace(/%m\b|%msg\b|%message\b|\{message\}/g, entry.message);

        // Marker: %marker, %markerSimpleName
        if (output.includes('%marker') || output.includes('%markerSimpleName')) {
            const markerStr = entry.marker ? entry.marker.toString() : '';
            const markerSimpleStr = entry.marker ? entry.marker.name : '';
            output = output
                .replace(/%markerSimpleName\b/g, markerSimpleStr)
                .replace(/%marker\b/g, markerStr);
        }

        // 5. Context: %X{key}, %X, {context}
        let handledContext = false;
        output = output.replace(/%X\{([^}]+)\}/g, (_, key) => {
            handledContext = true;
            if (entry.context && key in entry.context) {
                const val = entry.context[key];
                return typeof val === 'object' ? safeStringify(val) : String(val);
            }
            return '';
        });

        if (output.includes('%X') || output.includes('{context}')) {
            handledContext = true;
            const ctxStr = entry.context ? ` ${safeStringify(entry.context)}` : '';
            output = output.replace(/%X\b|\{context\}/g, ctxStr);
        }

        // 6. Error: %ex, %throwable, {error}
        let handledError = false;
        if (output.includes('%ex') || output.includes('%throwable')) {
            handledError = true;
            const errStr = entry.error ? (entry.error.stack || entry.error.message) : '';
            output = output.replace(/%ex\b|%throwable\b/g, errStr);
        }
        if (output.includes('{error}')) {
            handledError = true;
            const errStr = entry.error ? `\n${entry.error.stack || entry.error.message}` : '';
            output = output.replace(/\{error\}/g, errStr);
        }

        // 7. Newline: %n
        output = output.replace(/%n/g, '\n');

        // Append context if configured and not handled
        if (!handledContext && this.alwaysAppendContext && entry.context) {
            output += ` ${safeStringify(entry.context)}`;
        }

        // Append error stack if configured and not handled
        if (!handledError && this.alwaysAppendError && entry.error) {
            output += `\n${entry.error.stack || entry.error.message}`;
        }

        return output;
    }

    private formatDateOnly(timestamp: Date): string {
        const parts = this.dateFormatter.formatToParts(timestamp);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        return `${year}/${month}/${day}`;
    }

    private formatTimeOnly(timestamp: Date): string {
        const baseTime = this.timeFormatter.format(timestamp);
        const ms = timestamp.getMilliseconds().toString().padStart(3, '0');
        return `${baseTime}.${ms}`;
    }

    private formatTimestamp(timestamp: Date, specifier: string): string {
        if (!specifier || specifier === 'DEFAULT') {
            return `${this.formatDateOnly(timestamp)} ${this.formatTimeOnly(timestamp)}`;
        }
        if (specifier === 'ISO8601') {
            return timestamp.toISOString();
        }
        if (specifier.toLowerCase() === 'date') {
            return this.formatDateOnly(timestamp);
        }
        if (specifier.toLowerCase() === 'time') {
            return this.formatTimeOnly(timestamp);
        }

        // Custom token replacement: YYYY, MM, DD, HH, mm, ss, SSS
        const parts = this.dateFormatter.formatToParts(timestamp);
        const timeParts = this.timeFormatter.formatToParts(timestamp);

        const YYYY = parts.find(p => p.type === 'year')?.value || '';
        const MM = parts.find(p => p.type === 'month')?.value || '';
        const DD = parts.find(p => p.type === 'day')?.value || '';
        const HH = timeParts.find(p => p.type === 'hour')?.value || '';
        const mm = timeParts.find(p => p.type === 'minute')?.value || '';
        const ss = timeParts.find(p => p.type === 'second')?.value || '';
        const SSS = timestamp.getMilliseconds().toString().padStart(3, '0');

        return specifier
            .replace(/YYYY/g, YYYY)
            .replace(/MM/g, MM)
            .replace(/DD/g, DD)
            .replace(/HH/g, HH)
            .replace(/mm/g, mm)
            .replace(/ss/g, ss)
            .replace(/SSS/g, SSS);
    }
}
