import { AsyncAppender } from '../../src/appenders/async-appender';
import { BaseAppender } from '../../src/appenders/base-appender';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';

class MockAppender extends BaseAppender {
    public received: LogEntry[] = [];
    public batches: LogEntry[][] = [];
    public delayMs = 0;
    public destroyed = false;

    constructor() {
        super('MockAppender', {});
    }

    public async handle(entry: LogEntry): Promise<void> {
        if (this.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delayMs));
        }
        this.received.push(entry);
    }

    public async handleBatch(entries: LogEntry[]): Promise<void> {
        if (this.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delayMs));
        }
        this.batches.push(entries);
        this.received.push(...entries);
    }

    public destroy(): void {
        super.destroy();
        this.destroyed = true;
    }
}

function makeEntry(msg: string): LogEntry {
    return {
        timestamp: new Date(),
        level: LogLevel.INFO,
        namespace: 'AsyncTest',
        message: msg,
    };
}

describe('AsyncAppender', () => {
    it('should process log entries asynchronously and flush them', async () => {
        const mock = new MockAppender();
        const asyncAppender = new AsyncAppender({
            appender: mock,
            queueSize: 100,
        });

        await asyncAppender.handle(makeEntry('msg 1'));
        await asyncAppender.handle(makeEntry('msg 2'));
        await asyncAppender.handle(makeEntry('msg 3'));

        await asyncAppender.flush();

        expect(mock.received.length).toBe(3);
        expect(mock.received.map(e => e.message)).toEqual(['msg 1', 'msg 2', 'msg 3']);
    });

    it('should discard newest entries on overflow when policy is DISCARD', async () => {
        const mock = new MockAppender();
        mock.delayMs = 50; // slow down processing
        const asyncAppender = new AsyncAppender({
            appender: mock,
            queueSize: 2,
            overflowPolicy: 'DISCARD',
        });

        // Push 4 entries rapidly
        const p1 = asyncAppender.handle(makeEntry('first'));
        const p2 = asyncAppender.handle(makeEntry('second'));
        const p3 = asyncAppender.handle(makeEntry('third')); // should be discarded
        const p4 = asyncAppender.handle(makeEntry('fourth')); // should be discarded

        await Promise.all([p1, p2, p3, p4]);
        await asyncAppender.flush();

        const messages = mock.received.map(e => e.message);
        expect(messages).toContain('first');
        expect(messages.length).toBeLessThanOrEqual(2);
    });

    it('should discard oldest entries on overflow when policy is DISCARD_OLDEST', async () => {
        const mock = new MockAppender();
        mock.delayMs = 100;
        const asyncAppender = new AsyncAppender({
            appender: mock,
            queueSize: 2,
            overflowPolicy: 'DISCARD_OLDEST',
        });

        // Queue has room for 2 entries
        // First entry starts processing immediately and gets spliced
        // Next entries will fill and overflow the queue
        await asyncAppender.handle(makeEntry('1'));
        await asyncAppender.handle(makeEntry('2'));
        await asyncAppender.handle(makeEntry('3'));
        await asyncAppender.handle(makeEntry('4'));

        await asyncAppender.flush();

        const messages = mock.received.map(e => e.message);
        // '4' must be kept because it is newest
        expect(messages).toContain('4');
    });

    it('should block until buffer has space when policy is BLOCK', async () => {
        const mock = new MockAppender();
        mock.delayMs = 20;
        const asyncAppender = new AsyncAppender({
            appender: mock,
            queueSize: 2,
            overflowPolicy: 'BLOCK',
        });

        const items = ['a', 'b', 'c', 'd'];
        for (const item of items) {
            await asyncAppender.handle(makeEntry(item));
        }

        await asyncAppender.flush();

        expect(mock.received.length).toBe(4);
        expect(mock.received.map(e => e.message)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should call destroy on target appender and clear queue', () => {
        const mock = new MockAppender();
        const asyncAppender = new AsyncAppender({
            appender: mock,
        });

        asyncAppender.destroy();
        expect(mock.destroyed).toBe(true);
    });

    it('should fall back to sequential handle() when target lacks handleBatch()', async () => {
        const received: string[] = [];
        const noBatchAppender: any = {
            name: 'NoBatchAppender',
            handle: jest.fn().mockImplementation(async (e: LogEntry) => {
                received.push(e.message);
            }),
            flush: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn(),
        };

        const asyncAppender = new AsyncAppender({
            appender: noBatchAppender,
        });

        await asyncAppender.handle(makeEntry('m1'));
        await asyncAppender.handle(makeEntry('m2'));
        await asyncAppender.flush();

        expect(noBatchAppender.handle).toHaveBeenCalledTimes(2);
        expect(received).toEqual(['m1', 'm2']);
    });

    it('should catch errors thrown by target appender inside worker', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const failingAppender: any = {
            name: 'FailingAppender',
            handle: jest.fn().mockRejectedValue(new Error('Sink unavailable')),
            flush: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn(),
        };

        const asyncAppender = new AsyncAppender({
            appender: failingAppender,
        });

        await asyncAppender.handle(makeEntry('failing message'));
        await asyncAppender.flush();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[perfect-logger] Error in AsyncAppender worker:'),
            expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
    });

    it('should drain more than 50 items across multiple batches', async () => {
        const mock = new MockAppender();
        const asyncAppender = new AsyncAppender({
            appender: mock,
            queueSize: 200,
        });

        for (let i = 0; i < 75; i++) {
            await asyncAppender.handle(makeEntry(`item-${i}`));
        }

        await asyncAppender.flush();
        expect(mock.received.length).toBe(75);
    });
});
