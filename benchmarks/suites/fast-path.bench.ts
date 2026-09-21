import { BenchmarkSuite } from '../harness';
import { LogManager, LogLevel, CallbackAppender } from '../../src';

export function createFastPathSuite(): BenchmarkSuite {
    const suite = new BenchmarkSuite(
        'Fast-Path & Level Checks',
        'Measures early-exit overhead when log calls are below the configured minimum level (zero allocations).'
    );

    // Setup logger with minLevel = INFO and a no-op appender
    LogManager.configure({
        minLevel: LogLevel.INFO,
        appenders: [
            new CallbackAppender({
                callback: () => {},
            }),
        ],
    });

    const infoLogger = LogManager.getInstance().getLogger('benchmark.fastpath.info');
    const fatalLogger = LogManager.getInstance().getLogger('benchmark.fastpath.fatal');
    fatalLogger.setLevel(LogLevel.FATAL);

    // 1. Level check queries
    suite.add('logger.isLevelEnabled(TRACE) [false]', () => {
        infoLogger.isLevelEnabled(LogLevel.TRACE);
    });

    suite.add('logger.isLevelEnabled(INFO) [true]', () => {
        infoLogger.isLevelEnabled(LogLevel.INFO);
    });

    // 2. Disabled log methods
    suite.add('logger.trace() [disabled]', () => {
        infoLogger.trace('This trace message should be discarded immediately');
    });

    suite.add('logger.debug() [disabled]', () => {
        infoLogger.debug('This debug message should be discarded immediately');
    });

    suite.add('logger.debug() with context [disabled]', () => {
        infoLogger.debug('Discarded with context', { userId: 12345, query: 'SELECT 1' });
    });

    // 3. Logger set to FATAL (suppressing ERROR)
    suite.add('logger.error() on FATAL logger [disabled]', () => {
        fatalLogger.error('This error is muted because logger level is FATAL');
    });

    return suite;
}
