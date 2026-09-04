import { StreamAppender } from '../../src/appenders/stream-appender';
import { JsonLayout } from '../../src/layouts/json-layout';
import { PatternLayout } from '../../src/layouts/pattern-layout';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';
import { Writable } from 'stream';

function makeEntry(level: LogLevel = LogLevel.INFO, message = 'stream test message'): LogEntry {
    return {
        timestamp: new Date('2023-10-28T14:30:05.123Z'),
        level,
        namespace: 'StreamApp',
        message,
    };
}

describe('StreamAppender', () => {
    let outputData: string[];
    let mockStream: Writable;

    beforeEach(() => {
        outputData = [];
        mockStream = new Writable({
            write(chunk, encoding, callback) {
                outputData.push(chunk.toString());
                callback();
            },
        });
    });

    it('should write formatted log entry to writable stream', () => {
        const appender = new StreamAppender({
            stream: mockStream,
            layout: new PatternLayout({ pattern: '%p [%c] %m' }),
        });

        appender.handle(makeEntry(LogLevel.INFO, 'hello stream'));

        expect(outputData.length).toBe(1);
        expect(outputData[0]).toBe('INFO [StreamApp] hello stream\n');
    });

    it('should support JsonLayout', () => {
        const appender = new StreamAppender({
            stream: mockStream,
            layout: new JsonLayout(),
        });

        appender.handle(makeEntry(LogLevel.WARN, 'json stream warning'));

        expect(outputData.length).toBe(1);
        const parsed = JSON.parse(outputData[0].trim());
        expect(parsed.level).toBe('WARN');
        expect(parsed.message).toBe('json stream warning');
        expect(parsed.namespace).toBe('StreamApp');
    });

    it('should write batch of entries', () => {
        const appender = new StreamAppender({
            stream: mockStream,
            layout: new PatternLayout({ pattern: '%m' }),
        });

        appender.handleBatch([
            makeEntry(LogLevel.INFO, 'item 1'),
            makeEntry(LogLevel.INFO, 'item 2'),
            makeEntry(LogLevel.INFO, 'item 3'),
        ]);

        expect(outputData.length).toBe(1);
        expect(outputData[0]).toBe('item 1\nitem 2\nitem 3\n');
    });

    it('should handle empty batch gracefully', () => {
        const appender = new StreamAppender({ stream: mockStream });
        appender.handleBatch([]);
        expect(outputData.length).toBe(0);
    });

    it('should fall back to console.log when stream is null or unavailable', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const appender = new StreamAppender({
            stream: undefined,
            layout: new PatternLayout({ pattern: '%m' }),
        });
        // Force stream to null
        (appender as any).stream = null;

        appender.handle(makeEntry(LogLevel.INFO, 'fallback test'));

        expect(consoleSpy).toHaveBeenCalledWith('fallback test');
        consoleSpy.mockRestore();
    });

    it('should fall back to handle in handleBatch when stream is null', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const appender = new StreamAppender({
            stream: undefined,
            layout: new PatternLayout({ pattern: '%m' }),
        });
        (appender as any).stream = null;

        appender.handleBatch([
            makeEntry(LogLevel.INFO, 'fallback 1'),
            makeEntry(LogLevel.INFO, 'fallback 2'),
        ]);

        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenNthCalledWith(1, 'fallback 1');
        expect(consoleSpy).toHaveBeenNthCalledWith(2, 'fallback 2');
        consoleSpy.mockRestore();
    });

    it('should set stream to null in constructor when stdout is not available', () => {
        const originalStdout = process.stdout;
        try {
            // @ts-expect-error - testing environment without stdout
            delete process.stdout;
            const appender = new StreamAppender({});
            expect((appender as any).stream).toBeNull();
        } finally {
            process.stdout = originalStdout;
        }
    });

    it('should instantiate with default empty config', () => {
        const appender = new StreamAppender();
        expect(appender.name).toBe('StreamAppender');
    });
});
