import { LogManager } from '../../src/core/LogManager';
import { Logger } from '../../src/core/Logger';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';
import { BaseAppender } from '../../src/appenders/BaseAppender';

class MockAppender extends BaseAppender {
    public entries: LogEntry[] = [];

    constructor(minLevel: LogLevel = LogLevel.TRACE) {
        super('MockAppender', { minLevel });
    }

    public handle(entry: LogEntry): void {
        this.entries.push(entry);
    }
}

describe('Logger', () => {
    let logManager: LogManager;
    let appender: MockAppender;
    let logger: Logger;

    beforeEach(() => {
        (LogManager as any).instance = undefined;
        logManager = LogManager.getInstance();
        appender = new MockAppender();
        logManager.configure({ minLevel: LogLevel.TRACE, appenders: [appender] });
        logger = logManager.getLogger('TestNamespace');
    });

    afterEach(async () => {
        await logManager.shutdown();
    });

    describe('log level methods', () => {
        it('should log trace messages', () => {
            logger.trace('trace message');
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.TRACE);
            expect(appender.entries[0].message).toBe('trace message');
        });

        it('should log debug messages', () => {
            logger.debug('debug message');
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.DEBUG);
        });

        it('should log info messages', () => {
            logger.info('info message');
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.INFO);
        });

        it('should log warn messages', () => {
            logger.warn('warn message');
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.WARN);
        });

        it('should log error messages with an Error object', () => {
            const error = new Error('test error');
            logger.error('error message', error);
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.ERROR);
            expect(appender.entries[0].error).toBe(error);
        });

        it('should log fatal messages with an Error object', () => {
            const error = new Error('fatal error');
            logger.fatal('fatal message', error);
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.FATAL);
            expect(appender.entries[0].error).toBe(error);
        });
    });

    describe('namespace', () => {
        it('should include the namespace in log entries', () => {
            logger.info('test');
            expect(appender.entries[0].namespace).toBe('TestNamespace');
        });
    });

    describe('context', () => {
        it('should include local context in log entries', () => {
            logger.info('test', { requestId: 'abc' });
            expect(appender.entries[0].context).toEqual({ requestId: 'abc' });
        });

        it('should omit empty context objects', () => {
            logger.info('test');
            expect(appender.entries[0].context).toBeUndefined();
        });

        it('should merge context passed directly to log methods', () => {
            logger.info('test', { key1: 'value1' });
            expect(appender.entries[0].context).toEqual({ key1: 'value1' });
        });
    });

    describe('child()', () => {
        it('should create a child logger with merged context', () => {
            const child = logger.child({ userId: 123 });
            child.info('child message');

            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].context).toEqual({ userId: 123 });
            expect(appender.entries[0].namespace).toBe('TestNamespace');
        });

        it('should merge parent and child context', () => {
            const parent = logger.child({ service: 'auth' });
            const child = parent.child({ requestId: 'xyz' });
            child.info('nested child');

            expect(appender.entries[0].context).toEqual({
                service: 'auth',
                requestId: 'xyz',
            });
        });

        it('should let child context override parent context', () => {
            const parent = logger.child({ env: 'staging' });
            const child = parent.child({ env: 'production' });
            child.info('override');

            expect(appender.entries[0].context).toEqual({ env: 'production' });
        });

        it('should merge local context with child context', () => {
            const child = logger.child({ userId: 123 });
            child.info('with local', { action: 'login' });

            expect(appender.entries[0].context).toEqual({
                userId: 123,
                action: 'login',
            });
        });
    });

    describe('timestamp', () => {
        it('should include a timestamp in the log entry', () => {
            const before = new Date();
            logger.info('test');
            const after = new Date();

            const timestamp = appender.entries[0].timestamp;
            expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });
});
