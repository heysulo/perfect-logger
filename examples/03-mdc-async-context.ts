/**
 * Example 03: Mapped Diagnostic Context (MDC)
 *
 * Demonstrates context propagation across asynchronous boundaries:
 * - Using MDC.run() to establish a scoped execution context
 * - Setting and querying contextual values with MDC.put() and MDC.get()
 * - Concurrency isolation: multiple parallel async operations maintain their own context
 * - Injecting MDC values into log formats automatically
 *
 * Run with:
 *   npx ts-node examples/03-mdc-async-context.ts
 */

import { LogManager, ConsoleAppender, LogLevel, MDC } from '../src';

console.log('=== Mapped Diagnostic Context (MDC) Demo ===\n');

// 1. Configure the logger with a custom pattern showing MDC context
LogManager.configure({
    minLevel: LogLevel.DEBUG,
    appenders: [
        new ConsoleAppender({
            minLevel: LogLevel.DEBUG,
            format: '%d{HH:mm:ss.SSS} [%p] [%c] %X - %m',
        }),
    ],
});

const logger = LogManager.getLogger('api.http');

// Helper to simulate asynchronous processing
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// 2. Simulated asynchronous request handler
async function handleRequest(requestId: string, userId: string): Promise<void> {
    // Wrap the request lifecycle in an isolated MDC context
    await MDC.run({ requestId, userId }, async () => {
        logger.info('Request received and context initialized');

        // Context is automatically accessible anywhere down the async call stack
        await processDatabaseQuery();

        // Dynamically enrich the MDC context mid-flight
        MDC.put('transactionId', `tx_${Math.floor(Math.random() * 10000)}`);
        logger.info('Transaction created and linked to request');

        await delay(100);

        logger.info('Request processing completed successfully');
    });
}

async function processDatabaseQuery(): Promise<void> {
    // Notice we do NOT pass requestId or userId down as arguments!
    await delay(50);
    logger.debug(`Executing query for user (MDC userId = ${MDC.get('userId')})`);
}

// 3. Run two concurrent requests simultaneously to demonstrate context isolation
async function main(): Promise<void> {
    console.log('Launching two concurrent asynchronous requests in parallel...\n');

    await Promise.all([
        handleRequest('req-alpha-001', 'user-101'),
        handleRequest('req-beta-002', 'user-202'),
    ]);

    // Outside MDC.run, context is empty
    logger.info('All requests finished. MDC outside scope is empty:', { mdc: MDC.getCopyOfContextMap() });
}

main().catch(console.error);
