import { LogManager } from '../../src/core/LogManager';
import { Logger } from '../../src/core/Logger';
import { LogLevel } from '../../src/constants';
import { Appender, LogEntry } from '../../src/core/types';
import { BaseAppender } from '../../src/appenders/BaseAppender';

/**
 * A minimal test appender that records all entries it receives.
 */
class MockAppender extends BaseAppender {
    public entries: LogEntry[] = [];

    constructor(minLevel: LogLevel = LogLevel.TRACE) {
        super('MockAppender', { minLevel });
    }

    public handle(entry: LogEntry): void {
        this.entries.push(entry);
    }
}

/**
 * An appender that throws on every log to test error handling.
 */
class ThrowingAppender extends BaseAppender {
    constructor() {
        super('ThrowingAppender', { minLevel: LogLevel.TRACE });
    }

    public handle(_entry: LogEntry): void {
        throw new Error('Appender exploded');
    }
}

/**
 * An appender that rejects asynchronously.
 */
class AsyncThrowingAppender extends BaseAppender {
    constructor() {
        super('AsyncThrowingAppender', { minLevel: LogLevel.TRACE });
    }

    public async handle(_entry: LogEntry): Promise<void> {
        throw new Error('Async appender exploded');
    }
}

describe('LogManager', () => {
    let logManager: LogManager;

    beforeEach(() => {
        // Reset the singleton for each test
        (LogManager as any).instance = undefined;
        logManager = LogManager.getInstance();
    });

    afterEach(async () => {
        await logManager.shutdown();
    });

    describe('getInstance()', () => {
        it('should return the same instance on multiple calls', () => {
            const instance1 = LogManager.getInstance();
            const instance2 = LogManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('configure()', () => {
        it('should set the minLevel', () => {
            const appender = new MockAppender();
            logManager.configure({ minLevel: LogLevel.WARN, appenders: [appender] });

            const logger = logManager.getLogger('test');
            logger.info('should be ignored');
            logger.warn('should be logged');

            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].message).toBe('should be logged');
        });

        it('should destroy previous appenders on reconfigure (R6)', () => {
            const appender1 = new MockAppender();
            const destroySpy = jest.spyOn(appender1, 'destroy');

            logManager.configure({ appenders: [appender1] });
            logManager.configure({ appenders: [new MockAppender()] });

            expect(destroySpy).toHaveBeenCalledTimes(1);
        });

        it('should default to INFO minLevel', () => {
            const appender = new MockAppender();
            logManager.configure({ appenders: [appender] });

            const logger = logManager.getLogger('test');
            logger.debug('ignored');
            logger.info('logged');

            expect(appender.entries).toHaveLength(1);
        });
    });

    describe('getLogger()', () => {
        it('should return a Logger with the given namespace', () => {
            const logger = logManager.getLogger('MyService');
            expect(logger).toBeInstanceOf(Logger);
            expect(logger.namespace).toBe('MyService');
        });
    });

    describe('dispatch()', () => {
        it('should send entries to all configured appenders', () => {
            const appender1 = new MockAppender();
            const appender2 = new MockAppender();
            logManager.configure({
                minLevel: LogLevel.TRACE,
                appenders: [appender1, appender2],
            });

            const logger = logManager.getLogger('test');
            logger.info('hello');

            expect(appender1.entries).toHaveLength(1);
            expect(appender2.entries).toHaveLength(1);
        });

        it('should freeze entries to prevent mutation across appenders (R3)', () => {
            const appender = new MockAppender();
            logManager.configure({ minLevel: LogLevel.TRACE, appenders: [appender] });

            const logger = logManager.getLogger('test');
            logger.info('hello', { key: 'value' });

            expect(appender.entries).toHaveLength(1);
            expect(Object.isFrozen(appender.entries[0])).toBe(true);
        });

        it('should catch sync errors in appenders (B3)', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingAppender = new ThrowingAppender();
            const healthyAppender = new MockAppender();

            logManager.configure({
                minLevel: LogLevel.TRACE,
                appenders: [throwingAppender, healthyAppender],
            });

            const logger = logManager.getLogger('test');
            logger.info('test message');

            // Wait for the async error handler to fire
            await new Promise(resolve => setTimeout(resolve, 10));

            // The healthy appender should still receive the message
            expect(healthyAppender.entries).toHaveLength(1);
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        it('should catch async errors in appenders (B3)', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const asyncThrowing = new AsyncThrowingAppender();

            logManager.configure({
                minLevel: LogLevel.TRACE,
                appenders: [asyncThrowing],
            });

            const logger = logManager.getLogger('test');
            logger.info('test message');

            // Give the promise rejection handler time to fire
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        it('should filter entries below the global minLevel', () => {
            const appender = new MockAppender();
            logManager.configure({ minLevel: LogLevel.ERROR, appenders: [appender] });

            const logger = logManager.getLogger('test');
            logger.info('ignored');
            logger.warn('ignored');
            logger.error('logged');

            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].level).toBe(LogLevel.ERROR);
        });
    });

    describe('flush()', () => {
        it('should call flush on all appenders (R1)', async () => {
            const appender1 = new MockAppender();
            const appender2 = new MockAppender();
            const flush1 = jest.spyOn(appender1, 'flush');
            const flush2 = jest.spyOn(appender2, 'flush');

            logManager.configure({ appenders: [appender1, appender2] });
            await logManager.flush();

            expect(flush1).toHaveBeenCalledTimes(1);
            expect(flush2).toHaveBeenCalledTimes(1);
        });
    });

    describe('shutdown()', () => {
        it('should flush and destroy all appenders (R1)', async () => {
            const appender = new MockAppender();
            const flushSpy = jest.spyOn(appender, 'flush');
            const destroySpy = jest.spyOn(appender, 'destroy');

            logManager.configure({ appenders: [appender] });
            await logManager.shutdown();

            expect(flushSpy).toHaveBeenCalledTimes(1);
            expect(destroySpy).toHaveBeenCalledTimes(1);
        });

        it('should clear the appender list after shutdown', async () => {
            const appender = new MockAppender();
            logManager.configure({ appenders: [appender] });
            await logManager.shutdown();

            const logger = logManager.getLogger('test');
            logger.info('should go nowhere');
            expect(appender.entries).toHaveLength(0);
        });
    });

    describe('simpleBackendConfig()', () => {
        it('should configure with ConsoleAppender and FileAppender', () => {
            LogManager.simpleBackendConfig();
            // Just verify it doesn't throw — the appenders are internally created
        });
    });

    describe('simpleFrontendConfig()', () => {
        it('should configure with ConsoleAppender only', () => {
            LogManager.simpleFrontendConfig();
            // Just verify it doesn't throw
        });
    });
});
