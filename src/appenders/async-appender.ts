import { Appender, AppenderConfig, LogEntry } from '../core/types';
import { BaseAppender } from './base-appender';
import { LogLevel } from '../constants';

export type OverflowPolicy = 'DISCARD' | 'DISCARD_OLDEST' | 'BLOCK';

export interface AsyncAppenderConfig extends AppenderConfig {
    /** Target destination appender to wrap */
    appender: Appender;
    /** Maximum queue capacity. Default: 1024 */
    queueSize?: number;
    /** Overflow strategy when queue reaches maximum capacity. Default: 'DISCARD_OLDEST' */
    overflowPolicy?: OverflowPolicy;
}

/**
 * High-throughput asynchronous wrapper for appenders.
 * Enqueues log entries onto a bounded in-memory buffer and drains them
 * asynchronously, isolating the calling thread from I/O latency.
 */
export class AsyncAppender extends BaseAppender {
    public readonly targetAppender: Appender;
    private readonly queueSize: number;
    private readonly overflowPolicy: OverflowPolicy;
    private queue: LogEntry[] = [];
    private isProcessing = false;
    private blockWaiters: (() => void)[] = [];

    constructor(config: AsyncAppenderConfig) {
        super(`Async[${config.appender.name}]`, config, { minLevel: LogLevel.TRACE });
        this.targetAppender = config.appender;
        this.queueSize = config.queueSize ?? 1024;
        this.overflowPolicy = config.overflowPolicy ?? 'DISCARD_OLDEST';
    }

    public async handle(entry: LogEntry): Promise<void> {
        if (this.queue.length >= this.queueSize) {
            switch (this.overflowPolicy) {
                case 'DISCARD':
                    return; // Drop current entry
                case 'DISCARD_OLDEST':
                    this.queue.shift(); // Drop oldest entry
                    break;
                case 'BLOCK':
                    await new Promise<void>(resolve => {
                        this.blockWaiters.push(resolve);
                    });
                    break;
            }
        }

        this.queue.push(entry);
        this.triggerProcessing();
    }

    private triggerProcessing(): void {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        this.isProcessing = true;

        Promise.resolve().then(async () => {
            while (this.queue.length > 0) {
                const batch = this.queue.splice(0, 50);

                while (this.blockWaiters.length > 0 && this.queue.length < this.queueSize) {
                    const waiter = this.blockWaiters.shift();
                    if (waiter) waiter();
                }

                try {
                    if (this.targetAppender.handleBatch) {
                        await this.targetAppender.handleBatch(batch);
                    } else {
                        for (const item of batch) {
                            await this.targetAppender.handle(item);
                        }
                    }
                } catch (e) {
                    console.error('[perfect-logger] Error in AsyncAppender worker:', e);
                }
            }

            this.isProcessing = false;
            if (this.queue.length > 0) {
                this.triggerProcessing();
            }
        });
    }

    public async flush(): Promise<void> {
        while (this.queue.length > 0 || this.isProcessing) {
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        await this.targetAppender.flush();
    }

    public destroy(): void {
        super.destroy();
        this.queue = [];
        this.targetAppender.destroy();
    }
}
