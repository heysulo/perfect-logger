import { BenchmarkSuite } from '../harness';
import { LogManager, LogLevel, CallbackAppender } from '../../src';

export function createCoreSuite(): BenchmarkSuite {
    const suite = new BenchmarkSuite(
        'Core Dispatch Pipeline',
        'Measures logger dispatch overhead, entry construction, Object.freeze, and argument handling without I/O.'
    );

    // Single no-op appender
    const singleAppender = new CallbackAppender({ callback: () => {} });
    LogManager.configure({
        minLevel: LogLevel.DEBUG,
        appenders: [singleAppender],
    });

    const logger = LogManager.getInstance().getLogger('benchmark.core');

    suite.add('logger.info("plain message")', () => {
        logger.info('User authentication succeeded');
    });

    suite.add('logger.info(interpolated string)', () => {
        logger.info(`User auth for id ${42} completed at ${100}ms`);
    });

    suite.add('logger.info(message, smallContext)', () => {
        logger.info('Order processed', { orderId: 'ord_12345', amount: 99.95 });
    });

    const nestedContext = {
        transaction: {
            id: 'tx_998877',
            status: 'COMPLETED',
            metadata: {
                region: 'us-east-1',
                attempts: 2,
                client: { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' },
            },
        },
    };

    suite.add('logger.info(message, nestedContext)', () => {
        logger.info('Transaction processed', nestedContext);
    });

    const sampleError = new Error('Database connection reset by peer');

    suite.add('logger.error(message, error)', () => {
        logger.error('Query execution failed', sampleError);
    });

    suite.add('logger.error(message, error, context)', () => {
        logger.error('Handled payment error', sampleError, { retryable: false, code: 'PAY_500' });
    });

    // Multi-appender scenario
    const multiLogger = LogManager.getInstance().getLogger('benchmark.core.multi');
    const threeAppenders = [
        new CallbackAppender({ callback: () => {} }),
        new CallbackAppender({ callback: () => {} }),
        new CallbackAppender({ callback: () => {} }),
    ];
    // Create dedicated LogManager child/config test
    suite.add('logger.info() to 3 appenders', () => {
        for (let i = 0; i < 3; i++) {
            threeAppenders[i].log({
                timestamp: new Date(1725880000000),
                level: LogLevel.INFO,
                namespace: 'benchmark.core.multi',
                message: 'Broadcasting entry',
            });
        }
    });

    return suite;
}
