/**
 * Example 07: Advanced Appenders & Asynchronous I/O
 *
 * Demonstrates high-throughput and specialized appenders:
 * - StreamAppender: Direct streaming to process.stdout/stderr bypassing console overhead
 * - AsyncAppender: Non-blocking buffered queue isolating the event loop from I/O latency
 * - CallbackAppender: Programmatic in-memory listener for telemetry, metrics, or alerts
 * - RollingFileAppender: Size and time-based rotation with auto-cleanup
 *
 * Run with:
 *   npx ts-node examples/07-advanced-appenders.ts
 */

import {
    LogManager,
    StreamAppender,
    AsyncAppender,
    CallbackAppender,
    RollingFileAppender,
    JsonLayout,
    PatternLayout,
    LogLevel,
    LogEntry,
} from '../src';
import * as path from 'path';
import * as fs from 'fs';

console.log('=== Advanced Appenders & Async I/O Demo ===\n');

async function main(): Promise<void> {
    // 1. In-memory metrics counter via CallbackAppender
    console.log('--- 1. CallbackAppender (Telemetry / Metrics Collector) ---');
    const levelCounts: Record<string, number> = {};
    const metricAppender = new CallbackAppender({
        minLevel: LogLevel.DEBUG,
        callback: (entry: LogEntry) => {
            const levelName = LogLevel[entry.level];
            levelCounts[levelName] = (levelCounts[levelName] || 0) + 1;
        },
    });

    // 2. High-performance direct StreamAppender with custom PatternLayout
    console.log('--- 2. StreamAppender (process.stdout) ---');
    const stdoutAppender = new StreamAppender({
        minLevel: LogLevel.INFO,
        layout: new PatternLayout({
            pattern: '%d{HH:mm:ss.SSS} [%p] %c - %m %X',
        }),
    });

    // 3. Non-blocking AsyncAppender wrapping stdoutAppender
    // Uses a bounded queue with DISCARD_OLDEST policy
    console.log('--- 3. AsyncAppender (Non-blocking background worker) ---');
    const asyncAppender = new AsyncAppender({
        appender: stdoutAppender,
        queueSize: 500,
        overflowPolicy: 'DISCARD_OLDEST',
    });

    // 4. RollingFileAppender with size/date rotation and JSON layout
    console.log('--- 4. RollingFileAppender (File rotation) ---');
    const logDir = path.join(__dirname, '../logs/examples');
    const rollingFileAppender = new RollingFileAppender({
        logDirectory: logDir,
        fileName: 'example-rolling.log',
        minLevel: LogLevel.DEBUG,
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        layout: new JsonLayout({ pretty: false }),
    });

    // Configure LogManager with our multi-appender architecture
    LogManager.configure({
        minLevel: LogLevel.DEBUG,
        appenders: [asyncAppender, metricAppender, rollingFileAppender],
    });

    const logger = LogManager.getLogger('com.enterprise.order.CheckoutWorker');

    logger.debug('Starting checkout worker pipeline', { workerId: 'w-01' });
    logger.info('Processing order items', { orderId: 'ord-8831', itemCount: 3 });
    logger.warn('Inventory low for SKU item', { sku: 'WIDGET-99', remaining: 2 });
    logger.info('Payment captured successfully', { amount: 149.50 });

    // Flush any pending async queues before reading metrics or exiting
    await LogManager.flush();

    console.log('\n--- Metrics Recorded by CallbackAppender ---');
    console.log(levelCounts);

    // Verify rolling log file was written
    const targetFilePath = path.join(logDir, 'example-rolling.log');
    if (fs.existsSync(targetFilePath)) {
        const fileContent = fs.readFileSync(targetFilePath, 'utf-8');
        const lines = fileContent.trim().split('\n').length;
        console.log(`\nRollingFileAppender successfully wrote ${lines} JSON lines to: ${targetFilePath}`);
    }

    // Cleanly shutdown all appenders (closes file descriptors and stops timers)
    await LogManager.shutdown();

    console.log('\nAdvanced appenders example completed successfully.');
}

main().catch(console.error);
