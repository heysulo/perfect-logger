/**
 * Example 01: Quick Start
 *
 * Demonstrates basic usage of perfect-logger:
 * - Configuring LogManager with a ConsoleAppender
 * - Using the pre-configured defaultLogger
 * - Creating a named logger for a component
 * - Logging at various severity levels
 * - Logging structured metadata and Error instances
 *
 * Run with:
 *   npx ts-node examples/01-quick-start.ts
 */

import { LogManager, ConsoleAppender, LogLevel, defaultLogger } from '../src';

// 1. Central LogManager Configuration
console.log('--- 1. Central LogManager Configuration ---');
LogManager.configure({
    minLevel: LogLevel.DEBUG,
    appenders: [
        new ConsoleAppender({
            minLevel: LogLevel.DEBUG,
        }),
    ],
});

// 2. Immediate out-of-the-box logging with defaultLogger
console.log('\n--- 2. Default Logger ---');
defaultLogger.info('Hello from the pre-configured default logger!');

// 3. Obtain a named logger for your component or service
console.log('\n--- 3. Named Component Logger ---');
const logger = LogManager.getLogger('app.service.PaymentService');

// 4. Logging across all standard severity levels
logger.trace('Entering processPayment() with arguments', { orderId: 'ord_98765' });
logger.debug('Connecting to payment gateway API', { endpoint: 'https://api.gateway.com/v1' });
logger.info('Processing payment authorization', { orderId: 'ord_98765', amount: 99.99, currency: 'USD' });
logger.warn('Payment gateway response latency is high', { latencyMs: 2450 });

// 5. Logging errors with structured context and full stack trace
try {
    throw new Error('Payment gateway timeout: connection dropped after 30s');
} catch (error) {
    logger.error('Failed to authorize payment transaction', error as Error, {
        orderId: 'ord_98765',
        retryCount: 3,
    });
}

logger.fatal('Payment service crashed unexpectedly due to fatal error');

console.log('\nQuick start example executed successfully.');
