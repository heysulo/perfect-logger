import { LogManager } from '../../src/core/log-manager';
import { Logger } from '../../src/core/logger';
import { LogLevel } from '../../src/constants';
import { Appender, LogEntry } from '../../src/core/types';
import { BaseAppender } from '../../src/appenders/base-appender';
import { FilterResult } from '../../src/filters/filter';

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

        it('should return root logger when namespace is empty or root', () => {
            expect(logManager.getLogger('')).toBe(logManager.getRootLogger());
            expect(logManager.getLogger('root')).toBe(logManager.getRootLogger());
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

        it('should dispatch raw entry directly via logManager.dispatch()', () => {
            const appender = new MockAppender();
            logManager.configure({ minLevel: LogLevel.INFO, appenders: [appender] });
            logManager.dispatch({
                timestamp: new Date(),
                level: LogLevel.INFO,
                namespace: 'direct',
                message: 'direct message',
                context: { key: 'val' },
            });
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].message).toBe('direct message');
            expect(Object.isFrozen(appender.entries[0].context)).toBe(true);
        });

        it('should drop entry in logManager.dispatch() if global filter returns DENY', () => {
            const appender = new MockAppender();
            logManager.configure({
                minLevel: LogLevel.INFO,
                appenders: [appender],
                filters: [{
                    name: 'DenyAll',
                    filter: () => FilterResult.DENY,
                }],
            });
            logManager.dispatch({
                timestamp: new Date(),
                level: LogLevel.INFO,
                namespace: 'direct',
                message: 'drop me',
            });
            expect(appender.entries).toHaveLength(0);
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

    describe('static convenience helpers', () => {
        it('should retrieve root logger and named loggers via static methods', () => {
            const root = LogManager.getRootLogger();
            expect(root).toBeDefined();
            expect(root.namespace).toBe('root');

            const named = LogManager.getLogger('static.test');
            expect(named).toBeDefined();
            expect(named.namespace).toBe('static.test');
        });
    });

    describe('global filters and timezone', () => {
        it('should drop log entries when a global filter returns DENY', () => {
            const appender = new MockAppender();
            const { FilterResult } = require('../../src/filters/filter');

            const denyFilter = {
                name: 'DenyAll',
                filter: jest.fn().mockReturnValue(FilterResult.DENY),
            };

            logManager.configure({
                minLevel: LogLevel.TRACE,
                appenders: [appender],
                filters: [denyFilter],
            });

            const logger = logManager.getLogger('test');
            logger.info('this should be denied globally');

            expect(denyFilter.filter).toHaveBeenCalled();
            expect(appender.entries).toHaveLength(0);
        });

        it('should propagate global timezone to appenders without a timezone', () => {
            const appender = new MockAppender();
            logManager.configure({
                timezone: 'America/New_York',
                appenders: [appender],
            });

            expect((appender as any).timezone).toBe('America/New_York');
        });

        it('should support single filter instance in global config and per-logger node config', () => {
            const singleFilter = {
                name: 'SingleGlobal',
                filter: jest.fn().mockReturnValue(0),
            };
            const singleNodeFilter = {
                name: 'SingleNode',
                filter: jest.fn().mockReturnValue(0),
            };

            logManager.configure({
                filters: singleFilter as any,
                loggers: {
                    'single.node': {
                        filters: singleNodeFilter as any,
                    },
                },
            });

            const logger = logManager.getLogger('single.node');
            expect((logManager as any).filters).toHaveLength(1);
            expect((logManager as any).filters[0]).toBe(singleFilter);
            expect(logger.filters).toContain(singleNodeFilter);
        });
    });

    describe('appender error resilience during flush and shutdown', () => {
        it('should catch errors when an appender throws during flush', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const failingAppender = new MockAppender();
            failingAppender.flush = jest.fn().mockRejectedValue(new Error('Flush error'));

            logManager.configure({ appenders: [failingAppender] });
            await logManager.flush();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[perfect-logger] Error flushing appender'),
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });

        it('should catch errors when an appender throws during shutdown', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const failingAppender = new MockAppender();
            failingAppender.destroy = jest.fn().mockImplementation(() => {
                throw new Error('Destroy error');
            });

            logManager.configure({ appenders: [failingAppender] });
            await logManager.shutdown();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[perfect-logger] Error destroying appender'),
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });
    });
});
