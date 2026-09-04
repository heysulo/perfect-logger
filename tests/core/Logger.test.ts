import { LogManager } from '../../src/core/log-manager';
import { Logger } from '../../src/core/logger';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';
import { BaseAppender } from '../../src/appenders/base-appender';

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

    describe('level guards', () => {
        it('should correctly report enabled levels based on effective level', () => {
            const testLogger = logManager.getLogger('guards');
            testLogger.setLevel(LogLevel.WARN);

            expect(testLogger.isTraceEnabled()).toBe(false);
            expect(testLogger.isDebugEnabled()).toBe(false);
            expect(testLogger.isInfoEnabled()).toBe(false);
            expect(testLogger.isWarnEnabled()).toBe(true);
            expect(testLogger.isErrorEnabled()).toBe(true);
            expect(testLogger.isFatalEnabled()).toBe(true);
            expect(testLogger.isLevelEnabled(LogLevel.INFO)).toBe(false);
            expect(testLogger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
        });
    });

    describe('accessors and mutators', () => {
        it('should get and set level', () => {
            const testLogger = logManager.getLogger('test-acc');
            expect(testLogger.getLevel()).toBeUndefined();
            testLogger.setLevel(LogLevel.DEBUG);
            expect(testLogger.getLevel()).toBe(LogLevel.DEBUG);
        });

        it('should get and set parent', () => {
            const childLogger = logManager.getLogger('child-acc');
            const parentLogger = logManager.getLogger('parent-acc');
            expect(childLogger.getParent()).toBeDefined(); // Root by default
            childLogger.setParent(parentLogger);
            expect(childLogger.getParent()).toBe(parentLogger);
        });

        it('should get and set additivity', () => {
            const testLogger = logManager.getLogger('test-additivity');
            expect(testLogger.getAdditivity()).toBe(true);
            testLogger.setAdditivity(false);
            expect(testLogger.getAdditivity()).toBe(false);
        });

        it('should add and manage appenders', () => {
            const testLogger = logManager.getLogger('test-appenders');
            expect(testLogger.getAppenders()).toEqual([]);

            const dummyAppender: any = { name: 'Dummy' };
            testLogger.addAppender(dummyAppender);
            expect(testLogger.getAppenders().length).toBe(1);

            testLogger.setAppenders([]);
            expect(testLogger.getAppenders().length).toBe(0);
        });
    });

    describe('error and fatal overloads', () => {
        it('should log error and fatal with Error object and optional context', () => {
            const err = new Error('Direct error');

            logger.error('Error occurred', err, { extra: 'data' });
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].message).toBe('Error occurred');
            expect(appender.entries[0].error).toBe(err);
            expect(appender.entries[0].context).toEqual({ extra: 'data' });

            logger.fatal('Fatal error occurred', err);
            expect(appender.entries).toHaveLength(2);
            expect(appender.entries[1].message).toBe('Fatal error occurred');
            expect(appender.entries[1].error).toBe(err);
        });
    });

    describe('edge case branches in Logger', () => {
        it('should default effective level to INFO when parent is null and level is undefined', () => {
            const orphanLogger = new Logger(logManager, 'orphan', {}, { parent: null });
            expect(orphanLogger.getEffectiveLevel()).toBe(LogLevel.INFO);
        });

        it('should catch synchronous errors thrown by an attached appender', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const throwingAppender: any = {
                name: 'ExplodingAppender',
                log: jest.fn().mockImplementation(() => { throw new Error('Boom'); }),
            };

            const testLogger = logManager.getLogger('throwing.logger');
            testLogger.addAppender(throwingAppender);

            testLogger.info('trigger explode');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[perfect-logger] Error in appender "ExplodingAppender":'),
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });

        it('should reject entry when logger filter returns NEUTRAL and level is not enabled', () => {
            const { FilterResult } = require('../../src/filters/filter');
            const neutralFilter = {
                name: 'NeutralFilter',
                filter: jest.fn().mockReturnValue(FilterResult.NEUTRAL),
            };

            const testLogger = logManager.getLogger('neutral.logger');
            testLogger.setLevel(LogLevel.ERROR);
            testLogger.addFilter(neutralFilter);

            testLogger.debug('debug should be rejected despite NEUTRAL');

            expect(neutralFilter.filter).toHaveBeenCalled();
            // Should not reach appender
            expect(appender.entries.some(e => e.message === 'debug should be rejected despite NEUTRAL')).toBe(false);
        });

        it('should wrap single filter option into array in constructor', () => {
            const { FilterResult } = require('../../src/filters/filter');
            const singleFilter = {
                name: 'SingleFilter',
                filter: () => FilterResult.ACCEPT,
            };
            const customLogger = new Logger(logManager, 'single.filter', {}, {
                filters: singleFilter,
            });
            expect(customLogger.filters).toHaveLength(1);
            expect(customLogger.filters[0]).toBe(singleFilter);
        });

        it('should support logging a marker without message', () => {
            const { MarkerManager } = require('../../src/core/marker');
            const m = MarkerManager.getMarker('TEST_MARKER');
            logger.info(m);
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].message).toBe('');
            expect(appender.entries[0].marker).toBe(m);
        });

        it('should support error and fatal with context as 2nd argument (omitting Error)', () => {
            logger.error('error without Error object', { ctxField: 'value1' });
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].error).toBeUndefined();
            expect(appender.entries[0].context).toEqual({ ctxField: 'value1' });

            logger.fatal('fatal without Error object', { ctxField: 'value2' });
            expect(appender.entries).toHaveLength(2);
            expect(appender.entries[1].error).toBeUndefined();
            expect(appender.entries[1].context).toEqual({ ctxField: 'value2' });
        });

        it('should support error and fatal with marker and context as 3rd argument', () => {
            const { MarkerManager } = require('../../src/core/marker');
            const m = MarkerManager.getMarker('ERR_MARKER');

            logger.error(m, 'error message', { role: 'admin' });
            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].marker).toBe(m);
            expect(appender.entries[0].error).toBeUndefined();
            expect(appender.entries[0].context).toEqual({ role: 'admin' });

            logger.fatal(m, 'fatal message', { role: 'superadmin' });
            expect(appender.entries).toHaveLength(2);
            expect(appender.entries[1].marker).toBe(m);
            expect(appender.entries[1].error).toBeUndefined();
            expect(appender.entries[1].context).toEqual({ role: 'superadmin' });
        });

        it('should handle constructor with default empty context', () => {
            const basicLogger = new Logger(logManager, 'basic');
            expect(basicLogger.namespace).toBe('basic');
        });

        it('should handle all dispatchErrorLog combinations', () => {
            const { MarkerManager } = require('../../src/core/marker');
            const m = MarkerManager.getMarker('DISPATCH_MARKER');
            const err = new Error('Test error');

            // 1. Marker with non-string message
            (logger as any).error(m, undefined);
            expect(appender.entries[appender.entries.length - 1].message).toBe('');

            // 2. Marker with error and explicit context (line 216 context ?? ...)
            logger.error(m, 'marker + err + ctx', err, { trace: '123' });
            expect(appender.entries[appender.entries.length - 1].context).toEqual({ trace: '123' });

            // 3. Marker with error and no context
            logger.error(m, 'marker + err', err);
            expect(appender.entries[appender.entries.length - 1].context).toBeUndefined();

            // 4. No marker, context object as 2nd arg and Error as 3rd arg (line 228)
            (logger as any).error('msg + ctx + err', { user: 'alice' }, err);
            expect(appender.entries[appender.entries.length - 1].error).toBe(err);
            expect(appender.entries[appender.entries.length - 1].context).toEqual({ user: 'alice' });

            // 5. No marker, only message string (line 230-231)
            logger.error('plain error message');
            expect(appender.entries[appender.entries.length - 1].error).toBeUndefined();
            expect(appender.entries[appender.entries.length - 1].context).toBeUndefined();

            // 6. No marker, undefined 2nd arg and Error as 3rd arg
            (logger as any).error('msg + err as 3rd', undefined, err);
            expect(appender.entries[appender.entries.length - 1].error).toBe(err);
        });
    });
});
