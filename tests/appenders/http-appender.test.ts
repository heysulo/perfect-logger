import { HttpAppender } from '../../src/appenders/http-appender';
import { JsonLayout } from '../../src/layouts/json-layout';
import { PatternLayout } from '../../src/layouts/pattern-layout';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';

function makeEntry(level: LogLevel = LogLevel.INFO, message = 'http log'): LogEntry {
    return {
        timestamp: new Date('2023-10-28T14:30:05.123Z'),
        level,
        namespace: 'HttpTest',
        message,
    };
}

describe('HttpAppender', () => {
    it('should throw if url is missing', () => {
        expect(() => {
            new HttpAppender({ url: '' });
        }).toThrow('HttpAppender requires a `url` parameter.');
    });

    it('should send logs using custom sender with json array payload', async () => {
        let sentUrl = '';
        let sentPayload = '';
        let sentHeaders: Record<string, string> = {};

        const sender = async (url: string, payload: string, headers: Record<string, string>) => {
            sentUrl = url;
            sentPayload = payload;
            sentHeaders = headers;
        };

        const appender = new HttpAppender({
            url: 'https://logs.example.com/api/v1/logs',
            headers: { 'Authorization': 'Bearer secret-token' },
            sender,
            layout: new JsonLayout(),
        });

        await appender.handle(makeEntry(LogLevel.INFO, 'test log 1'));

        expect(sentUrl).toBe('https://logs.example.com/api/v1/logs');
        expect(sentHeaders['Authorization']).toBe('Bearer secret-token');
        expect(sentHeaders['Content-Type']).toBe('application/json');

        const parsed = JSON.parse(sentPayload);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(1);
        expect(parsed[0].message).toBe('test log 1');
    });

    it('should send multiple logs as JSON array in batch', async () => {
        let sentPayload = '';
        const sender = async (_url: string, payload: string) => {
            sentPayload = payload;
        };

        const appender = new HttpAppender({
            url: 'http://localhost:8080',
            sender,
            layout: new JsonLayout(),
        });

        await appender.handleBatch([
            makeEntry(LogLevel.INFO, 'item 1'),
            makeEntry(LogLevel.WARN, 'item 2'),
        ]);

        const parsed = JSON.parse(sentPayload);
        expect(parsed.length).toBe(2);
        expect(parsed[0].message).toBe('item 1');
        expect(parsed[1].message).toBe('item 2');
    });

    it('should send plain text lines when layout is non-JSON', async () => {
        let sentPayload = '';
        const sender = async (_url: string, payload: string) => {
            sentPayload = payload;
        };

        const appender = new HttpAppender({
            url: 'http://localhost:8080',
            sender,
            layout: new PatternLayout({ pattern: '%p - %m' }),
        });

        await appender.handleBatch([
            makeEntry(LogLevel.INFO, 'first'),
            makeEntry(LogLevel.ERROR, 'second'),
        ]);

        expect(sentPayload).toBe('INFO - first\nERROR - second\n');
    });

    it('should retry on failure and succeed when a retry works', async () => {
        let attempts = 0;
        const sender = async () => {
            attempts++;
            if (attempts < 2) {
                throw new Error('Network timeout');
            }
        };

        const appender = new HttpAppender({
            url: 'http://localhost:8080',
            sender,
            retries: 2,
            retryBackoffMs: 10,
        });

        await appender.handle(makeEntry());

        expect(attempts).toBe(2);
    });

    it('should log error when all retries are exhausted', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        let attempts = 0;
        const sender = async () => {
            attempts++;
            throw new Error('Fatal connection refused');
        };

        const appender = new HttpAppender({
            url: 'http://localhost:9999',
            sender,
            retries: 2,
            retryBackoffMs: 5,
        });

        await appender.handle(makeEntry());

        // Initial attempt + 2 retries = 3 attempts total
        expect(attempts).toBe(3);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[perfect-logger] HttpAppender failed to send logs to http://localhost:9999:'),
            expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
    });

    it('should return early on empty batch', async () => {
        let called = false;
        const sender = async () => {
            called = true;
        };

        const appender = new HttpAppender({
            url: 'http://localhost:8080',
            sender,
        });

        await appender.handleBatch([]);
        expect(called).toBe(false);
    });

    describe('native Node HTTP transport (sendNodeHttp)', () => {
        const http = require('http');
        let originalRequest: any;

        beforeEach(() => {
            originalRequest = http.request;
        });

        afterEach(() => {
            http.request = originalRequest;
        });

        it('should send logs over native Node http request with status 200', async () => {
            let capturedUrl: any;
            let capturedOptions: any;
            let writtenBody = '';

            http.request = jest.fn().mockImplementation((url: any, options: any, callback: any) => {
                capturedUrl = url;
                capturedOptions = options;

                const { EventEmitter } = require('events');
                const req = new EventEmitter();
                req.write = jest.fn().mockImplementation((chunk: any) => { writtenBody += chunk; });
                req.end = jest.fn().mockImplementation(() => {
                    const res = new EventEmitter();
                    (res as any).statusCode = 200;
                    (res as any).statusMessage = 'OK';
                    (res as any).resume = jest.fn();
                    callback(res);
                });
                return req;
            });

            const appender = new HttpAppender({
                url: 'http://127.0.0.1:8080/log-endpoint',
                headers: { 'X-Custom-Header': 'CustomValue' },
                layout: new JsonLayout(),
            });

            await appender.handle(makeEntry(LogLevel.INFO, 'node http test message'));

            expect(capturedUrl.toString()).toBe('http://127.0.0.1:8080/log-endpoint');
            expect(capturedOptions.method).toBe('POST');
            expect(capturedOptions.headers['X-Custom-Header']).toBe('CustomValue');
            expect(capturedOptions.headers['Content-Type']).toBe('application/json');

            const payload = JSON.parse(writtenBody);
            expect(payload[0].message).toBe('node http test message');
        });

        it('should retry on HTTP 500 status response', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            let attempts = 0;

            http.request = jest.fn().mockImplementation((_url: any, _options: any, callback: any) => {
                attempts++;
                const { EventEmitter } = require('events');
                const req = new EventEmitter();
                req.write = jest.fn();
                req.end = jest.fn().mockImplementation(() => {
                    const res = new EventEmitter();
                    (res as any).statusCode = 500;
                    (res as any).statusMessage = 'Internal Server Error';
                    (res as any).resume = jest.fn();
                    callback(res);
                });
                return req;
            });

            const appender = new HttpAppender({
                url: 'http://127.0.0.1:8080/log-endpoint',
                retries: 1,
                retryBackoffMs: 5,
            });

            await appender.handle(makeEntry(LogLevel.WARN, 'retry test'));

            expect(attempts).toBe(2);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[perfect-logger] HttpAppender failed to send logs to'),
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('should retry on request error event', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            let attempts = 0;

            http.request = jest.fn().mockImplementation(() => {
                attempts++;
                const { EventEmitter } = require('events');
                const req = new EventEmitter();
                req.write = jest.fn();
                req.end = jest.fn().mockImplementation(() => {
                    process.nextTick(() => {
                        req.emit('error', new Error('ECONNREFUSED'));
                    });
                });
                return req;
            });

            const appender = new HttpAppender({
                url: 'http://127.0.0.1:8080/log-endpoint',
                retries: 1,
                retryBackoffMs: 5,
            });

            await appender.handle(makeEntry(LogLevel.ERROR, 'connection refused test'));

            expect(attempts).toBe(2);
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('should catch and retry when client.request throws synchronously', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            let attempts = 0;

            http.request = jest.fn().mockImplementation(() => {
                attempts++;
                throw new Error('Synchronous socket creation failed');
            });

            const appender = new HttpAppender({
                url: 'http://127.0.0.1:8080/log-endpoint',
                retries: 1,
                retryBackoffMs: 5,
            });

            await appender.handle(makeEntry(LogLevel.ERROR, 'sync throw test'));

            expect(attempts).toBe(2);
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('browser fetch transport (sendBrowserFetch)', () => {
        const originalFetch = (global as any).fetch;

        afterEach(() => {
            (global as any).fetch = originalFetch;
        });

        it('should send logs using fetch when in browser environment', async () => {
            let fetchUrl = '';
            let fetchOptions: any = null;

            (global as any).fetch = jest.fn().mockImplementation(async (url: string, opts: any) => {
                fetchUrl = url;
                fetchOptions = opts;
                return { ok: true, status: 200 };
            });

            const appender = new HttpAppender({
                url: 'https://browser.example.com/logs',
            });

            // Force browser path by temporarily simulating non-node
            const isNodeModule = require('../../src/utils/environment');
            const originalIsNode = isNodeModule.isNode;
            jest.spyOn(isNodeModule, 'isNode').mockReturnValue(false);

            await appender.handle(makeEntry(LogLevel.INFO, 'browser log message'));

            expect(fetchUrl).toBe('https://browser.example.com/logs');
            expect(fetchOptions.method).toBe('POST');
            expect(fetchOptions.headers['Content-Type']).toBe('application/json');

            isNodeModule.isNode = originalIsNode;
        });

        it('should throw and trigger retry when fetch response is not ok', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            (global as any).fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
            });

            const appender = new HttpAppender({
                url: 'https://browser.example.com/logs',
                retries: 1,
                retryBackoffMs: 5,
            });

            const isNodeModule = require('../../src/utils/environment');
            const originalIsNode = isNodeModule.isNode;
            jest.spyOn(isNodeModule, 'isNode').mockReturnValue(false);

            await appender.handle(makeEntry());

            expect((global as any).fetch).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
            isNodeModule.isNode = originalIsNode;
        });
    });
});
