import { Appender, AppenderConfig, LogEntry } from '../core/types';
import { LogLevel } from '../constants';
import { Layout } from '../layouts/layout';
import { Filter, FilterResult } from '../filters/filter';

export abstract class BaseAppender implements Appender {
    public readonly name: string;
    public readonly layout?: Layout;
    public readonly filters: Filter[] = [];
    protected readonly minLevel: LogLevel;
    protected readonly batchSize: number;
    protected readonly batchInterval: number;
    protected readonly timezone?: string;

    private buffer: LogEntry[] = [];
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(name: string, config: AppenderConfig, defaultConfig: Partial<AppenderConfig> = {}) {
        this.name = name;
        const finalConfig = { ...defaultConfig, ...config };
        this.minLevel = finalConfig.minLevel ?? LogLevel.INFO;
        this.layout = finalConfig.layout;
        this.batchSize = finalConfig.batchSize ?? 1;
        this.batchInterval = finalConfig.batchInterval ?? 1000;
        this.timezone = finalConfig.timezone;

        if (finalConfig.filters) {
            this.filters = Array.isArray(finalConfig.filters)
                ? [...finalConfig.filters]
                : [finalConfig.filters];
        }

        if (this.batchSize > 1) {
            this.startTimer();
        }
    }

    public async log(entry: LogEntry): Promise<void> {
        // Evaluate appender-level filters if present
        if (this.filters.length > 0) {
            let filterDecision = FilterResult.NEUTRAL;
            for (const filter of this.filters) {
                const res = filter.filter(entry);
                if (res !== FilterResult.NEUTRAL) {
                    filterDecision = res;
                    break;
                }
            }

            if (filterDecision === FilterResult.DENY) {
                return;
            }
            if (filterDecision === FilterResult.NEUTRAL && entry.level < this.minLevel) {
                return;
            }
        } else if (entry.level < this.minLevel) {
            return;
        }

        if (this.batchSize > 1) {
            this.buffer.push(entry);
            if (this.buffer.length >= this.batchSize) {
                await this.flush();
            }
        } else {
            await this.handle(entry);
        }
    }

    public async flush(): Promise<void> {
        this.stopTimer();
        if (this.buffer.length > 0) {
            const batch = this.buffer.slice();
            this.buffer = [];
            if (this.handleBatch) {
                await this.handleBatch(batch);
            } else {
                for (const entry of batch) {
                    await this.handle(entry);
                }
            }
        }
        if (this.batchSize > 1) {
            this.startTimer();
        }
    }

    /**
     * Clean up resources. Stops the batch timer and flushes any remaining entries.
     */
    public destroy(): void {
        this.stopTimer();
        // Synchronously clear the buffer — callers should flush() before destroy() if they need the data.
        this.buffer = [];
    }

    private startTimer(): void {
        if (this.batchSize > 1 && !this.timer) {
            this.timer = setInterval(() => this.flush(), this.batchInterval);
            // Prevent the timer from keeping the Node.js event loop alive
            if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
                this.timer.unref();
            }
        }
    }

    private stopTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    abstract handle(entry: LogEntry): Promise<void> | void;
    handleBatch?(entries: LogEntry[]): Promise<void> | void;
}
