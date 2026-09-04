import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './base-appender';
import { LogLevel } from '../constants';
import { Layout } from '../layouts/layout';
import { PatternLayout, DEFAULT_PATTERN } from '../layouts/pattern-layout';
import { isNode } from '../utils/environment';

export interface StreamAppenderConfig extends AppenderConfig {
    /**
     * Writable stream destination (e.g. process.stdout, process.stderr, or a network/file stream).
     * Defaults to process.stdout in Node.js environments.
     */
    stream?: NodeJS.WritableStream;

    /**
     * Character encoding for stream writes. Default: 'utf-8'.
     */
    encoding?: BufferEncoding;

    /**
     * Optional format pattern if layout is not explicitly provided.
     */
    format?: string;
}

/**
 * High-throughput appender that writes directly to Node.js Writable streams
 * (such as process.stdout or process.stderr), bypassing console.log overhead.
 */
export class StreamAppender extends BaseAppender {
    public readonly layout: Layout;
    private readonly stream: NodeJS.WritableStream | null;
    private readonly encoding: BufferEncoding;

    constructor(config: StreamAppenderConfig = {}) {
        super('StreamAppender', config, { minLevel: LogLevel.INFO });

        this.encoding = config.encoding || 'utf-8';
        this.layout = config.layout || new PatternLayout({
            pattern: config.format || DEFAULT_PATTERN,
            timezone: this.timezone,
            alwaysAppendContext: true,
            alwaysAppendError: true,
        });

        if (config.stream) {
            this.stream = config.stream;
        } else if (isNode() && typeof process !== 'undefined' && process.stdout) {
            this.stream = process.stdout;
        } else {
            this.stream = null;
        }
    }

    /**
     * Writes a formatted log line directly to the writable stream.
     * @param entry The log entry to write.
     */
    public handle(entry: LogEntry): void {
        const line = this.layout.format(entry) + '\n';
        if (this.stream && typeof this.stream.write === 'function') {
            this.stream.write(line, this.encoding);
        } else {
            // Fallback for non-stream or browser environments
            console.log(this.layout.format(entry));
        }
    }

    /**
     * Writes a batch of formatted log lines to the stream in a single chunk.
     * @param entries Array of log entries to format and write.
     */
    public handleBatch(entries: LogEntry[]): void {
        if (!entries.length) return;

        if (this.stream && typeof this.stream.write === 'function') {
            const chunk = entries.map(e => this.layout.format(e)).join('\n') + '\n';
            this.stream.write(chunk, this.encoding);
        } else {
            for (const entry of entries) {
                this.handle(entry);
            }
        }
    }
}
