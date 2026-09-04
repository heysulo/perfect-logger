import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';
import { BaseAppender } from '../../src/appenders/BaseAppender';

/**
 * A concrete test subclass of BaseAppender to test the abstract class's behavior.
 */
class TestAppender extends BaseAppender {
    public handledEntries: LogEntry[] = [];
    public batchedEntries: LogEntry[][] = [];

    constructor(config: { minLevel?: LogLevel; batchSize?: number; batchInterval?: number } = {}) {
        super('TestAppender', config);
    }

    public handle(entry: LogEntry): void {
        this.handledEntries.push(entry);
    }

    // Optionally test batch handling
    public handleBatch(entries: LogEntry[]): void {
        this.batchedEntries.push(entries);
        for (const entry of entries) {
            this.handledEntries.push(entry);
        }
    }
}

class TestAppenderNoBatch extends BaseAppender {
    public handledEntries: LogEntry[] = [];

    constructor(config: { minLevel?: LogLevel; batchSize?: number; batchInterval?: number } = {}) {
        super('TestAppenderNoBatch', config);
    }

    public handle(entry: LogEntry): void {
        this.handledEntries.push(entry);
    }
}

function makeEntry(level: LogLevel = LogLevel.INFO, message = 'test'): LogEntry {
    return {
        timestamp: new Date(),
        level,
        namespace: 'Test',
        message,
    };
}

describe('BaseAppender', () => {
    describe('log() — level filtering', () => {
        it('should pass entries at or above minLevel', async () => {
            const appender = new TestAppender({ minLevel: LogLevel.WARN });
            await appender.log(makeEntry(LogLevel.WARN));
            await appender.log(makeEntry(LogLevel.ERROR));
            expect(appender.handledEntries).toHaveLength(2);
        });

        it('should filter entries below minLevel', async () => {
            const appender = new TestAppender({ minLevel: LogLevel.WARN });
            await appender.log(makeEntry(LogLevel.DEBUG));
            await appender.log(makeEntry(LogLevel.INFO));
            expect(appender.handledEntries).toHaveLength(0);
        });

        it('should default minLevel to INFO', async () => {
            const appender = new TestAppender();
            await appender.log(makeEntry(LogLevel.DEBUG));
            expect(appender.handledEntries).toHaveLength(0);

            await appender.log(makeEntry(LogLevel.INFO));
            expect(appender.handledEntries).toHaveLength(1);
        });
    });

    describe('batching', () => {
        it('should call handle() directly when batchSize is 1 (default)', async () => {
            const appender = new TestAppender();
            await appender.log(makeEntry());
            expect(appender.handledEntries).toHaveLength(1);
            expect(appender.batchedEntries).toHaveLength(0);
        });

        it('should buffer entries until batchSize is reached', async () => {
            const appender = new TestAppender({ batchSize: 3 });

            await appender.log(makeEntry(LogLevel.INFO, 'msg1'));
            await appender.log(makeEntry(LogLevel.INFO, 'msg2'));
            expect(appender.handledEntries).toHaveLength(0);

            // Third entry triggers flush
            await appender.log(makeEntry(LogLevel.INFO, 'msg3'));
            expect(appender.handledEntries).toHaveLength(3);
            expect(appender.batchedEntries).toHaveLength(1);
            expect(appender.batchedEntries[0]).toHaveLength(3);
        });

        it('should fall back to handle() one-by-one if handleBatch is not implemented', async () => {
            const appender = new TestAppenderNoBatch({ batchSize: 2 });

            await appender.log(makeEntry(LogLevel.INFO, 'msg1'));
            await appender.log(makeEntry(LogLevel.INFO, 'msg2'));
            expect(appender.handledEntries).toHaveLength(2);
        });
    });

    describe('flush()', () => {
        it('should flush buffered entries immediately', async () => {
            const appender = new TestAppender({ batchSize: 10 });

            await appender.log(makeEntry(LogLevel.INFO, 'msg1'));
            await appender.log(makeEntry(LogLevel.INFO, 'msg2'));
            expect(appender.handledEntries).toHaveLength(0);

            await appender.flush();
            expect(appender.handledEntries).toHaveLength(2);
        });

        it('should be a no-op when buffer is empty', async () => {
            const appender = new TestAppender({ batchSize: 10 });
            await appender.flush();
            expect(appender.handledEntries).toHaveLength(0);
            expect(appender.batchedEntries).toHaveLength(0);
        });
    });

    describe('destroy()', () => {
        it('should clear the buffer', async () => {
            const appender = new TestAppender({ batchSize: 10 });

            await appender.log(makeEntry(LogLevel.INFO, 'msg1'));
            expect(appender.handledEntries).toHaveLength(0);

            appender.destroy();

            // Buffer was cleared, so flush should have nothing
            await appender.flush();
            expect(appender.handledEntries).toHaveLength(0);
        });
    });
});
