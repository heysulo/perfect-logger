import { Appender, AppenderConfig, LogEntry } from '../core/types';
import { LogLevel } from '../constants';

export abstract class BaseAppender implements Appender {
    public readonly name: string;
    protected readonly minLevel: LogLevel;
    protected readonly batchSize: number;
    protected readonly batchInterval: number;
    protected readonly timezone?: string;

    private buffer: LogEntry[] = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(name: string, config: AppenderConfig, defaultConfig: Partial<AppenderConfig> = {}) {
        this.name = name;
        const finalConfig = { ...defaultConfig, ...config };
        this.minLevel = finalConfig.minLevel ?? LogLevel.INFO;
        this.batchSize = finalConfig.batchSize ?? 1;
        this.batchInterval = finalConfig.batchInterval ?? 1000;
        this.timezone = finalConfig.timezone;

        if (this.batchSize > 1) {
            this.startTimer();
        }
    }

    public async log(entry: LogEntry): Promise<void> {
        if (entry.level >= this.minLevel) {
            if (this.batchSize > 1) {
                this.buffer.push(entry);
                if (this.buffer.length >= this.batchSize) {
                    await this.flush();
                }
            } else {
                await this.handle(entry);
            }
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
        this.startTimer();
    }

    private startTimer(): void {
        if (this.batchSize > 1 && !this.timer) {
            this.timer = setInterval(() => this.flush(), this.batchInterval);
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
