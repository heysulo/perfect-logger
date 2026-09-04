import { LogEntry, ConsoleAppenderConfig } from '../core/types';
import { BaseAppender } from './base-appender';
import { LogLevel } from '../constants';
import { Layout } from '../layouts/layout';
import { PatternLayout, DEFAULT_PATTERN } from '../layouts/pattern-layout';

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
