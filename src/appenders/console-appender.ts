import { LogEntry, ConsoleAppenderConfig } from '../core/types';
import { BaseAppender } from './base-appender';
import { LogLevel } from '../constants';
import { Layout } from '../layouts/layout';
import { PatternLayout, DEFAULT_PATTERN } from '../layouts/pattern-layout';

/**
 * Appender that writes formatted log events to the console/terminal.
 * Directs entries to the corresponding console level methods (`console.trace`, `console.debug`,
 * `console.info`, `console.warn`, `console.error`).
 *
 * @example
 * ```ts
 * const appender = new ConsoleAppender({
 *   minLevel: LogLevel.DEBUG,
 *   format: '%d [%p] %c: %m%X',
 * });
 * ```
 */
export class ConsoleAppender extends BaseAppender {
    public readonly layout: Layout;

    constructor(config: ConsoleAppenderConfig = {}) {
        super('ConsoleAppender', config, { minLevel: LogLevel.INFO });
        this.layout = config.layout || new PatternLayout({
            pattern: config.format || DEFAULT_PATTERN,
            timezone: this.timezone,
            alwaysAppendContext: true,
            alwaysAppendError: true,
        });
    }

    /**
     * Formats and writes a log entry to the console.
     * @param entry The log entry to write.
     */
    public handle(entry: LogEntry): void {
        const logLine = this.layout.format(entry);

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
}
