import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './base-appender';
import { LogLevel } from '../constants';
import { Layout } from '../layouts/layout';
import { JsonLayout } from '../layouts/json-layout';
import { isNode } from '../utils/environment';

export interface HttpAppenderConfig extends AppenderConfig {
    /** Target HTTP or HTTPS URL */
    url: string;
    /** Custom headers (e.g., Authorization, X-API-Key). Default includes Content-Type */
    headers?: Record<string, string>;
    /** HTTP method: defaults to 'POST' */
    method?: 'POST' | 'PUT';
    /** Number of retry attempts on network error. Default: 2 */
    retries?: number;
    /** Base retry delay in milliseconds. Default: 200 */
    retryBackoffMs?: number;
    /** Custom sender function for testing or customized transports */
    sender?: (url: string, payload: string, headers: Record<string, string>) => Promise<void>;
}

/**
 * Zero-dependency HTTP/HTTPS batch transport appender for streaming logs
 * directly to external aggregators (OpenTelemetry, Loki, Elasticsearch, Datadog, Webhooks).
 * Uses native Node http/https in Node.js and fetch in browsers.
 */
export class HttpAppender extends BaseAppender {
    public readonly layout: Layout;
    private readonly url: string;
    private readonly headers: Record<string, string>;
    private readonly method: 'POST' | 'PUT';
    private readonly retries: number;
    private readonly retryBackoffMs: number;
    private readonly customSender?: (url: string, payload: string, headers: Record<string, string>) => Promise<void>;

    constructor(config: HttpAppenderConfig) {
        super('HttpAppender', config, {
            minLevel: LogLevel.INFO,
            batchSize: config.batchSize ?? 10,
            batchInterval: config.batchInterval ?? 2000,
        });

        if (!config.url) {
            throw new Error('HttpAppender requires a `url` parameter.');
        }

        this.url = config.url;
        this.layout = config.layout || new JsonLayout();
        this.method = config.method || 'POST';
        this.retries = config.retries ?? 2;
        this.retryBackoffMs = config.retryBackoffMs ?? 200;
        this.customSender = config.sender;

        this.headers = {
            'Content-Type': this.layout.contentType || 'application/json',
            ...(config.headers || {}),
        };
    }

    public async handle(entry: LogEntry): Promise<void> {
        await this.handleBatch([entry]);
    }

    public async handleBatch(entries: LogEntry[]): Promise<void> {
        if (!entries.length) return;

        let payload: string;
        if (this.layout.contentType === 'application/json') {
            payload = `[${entries.map(e => this.layout.format(e)).join(',')}]`;
        } else {
            payload = entries.map(e => this.layout.format(e)).join('\n') + '\n';
        }

        await this.sendWithRetry(payload, this.retries);
    }

    private async sendWithRetry(payload: string, remainingRetries: number): Promise<void> {
        try {
            if (this.customSender) {
                await this.customSender(this.url, payload, this.headers);
                return;
            }

            if (isNode()) {
                await this.sendNodeHttp(payload);
            } else if (typeof fetch !== 'undefined') {
                await this.sendBrowserFetch(payload);
            }
        } catch (error) {
            if (remainingRetries > 0) {
                const backoff = this.retryBackoffMs * Math.pow(2, this.retries - remainingRetries);
                await new Promise(resolve => setTimeout(resolve, backoff));
                await this.sendWithRetry(payload, remainingRetries - 1);
            } else {
                console.error(`[perfect-logger] HttpAppender failed to send logs to ${this.url}:`, error);
            }
        }
    }

    private sendNodeHttp(payload: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const parsedUrl = new URL(this.url);
                const isHttps = parsedUrl.protocol === 'https:';
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const httpModule = isHttps ? require('https') : require('http');

                const req = httpModule.request(
                    parsedUrl,
                    {
                        method: this.method,
                        headers: {
                            ...this.headers,
                            'Content-Length': Buffer.byteLength(payload, 'utf-8'),
                        },
                    },
                    (res: { statusCode?: number; statusMessage?: string; resume: () => void }) => {
                        res.resume(); // Consume response data to free up memory
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve();
                        } else {
                            reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
                        }
                    }
                );

                req.on('error', (err: Error) => reject(err));
                req.write(payload, 'utf-8');
                req.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    private async sendBrowserFetch(payload: string): Promise<void> {
        const response = await fetch(this.url, {
            method: this.method,
            headers: this.headers,
            body: payload,
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
    }
}
