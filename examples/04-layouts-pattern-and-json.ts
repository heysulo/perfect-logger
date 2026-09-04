/**
 * Example 04: Decoupled Layouts (PatternLayout vs JsonLayout)
 *
 * Demonstrates formatting log events with decoupled layouts:
 * - PatternLayout: Log4j conversion specifiers (%d, %p, %c, %m, %X, %ex)
 * - JsonLayout: Structured JSON for log aggregators (ELK, Datadog, CloudWatch)
 * - Customizing JSON field names (e.g. "@timestamp", "severity")
 * - Pretty printing vs compact newline-delimited JSON (NDJSON)
 *
 * Run with:
 *   npx ts-node examples/04-layouts-pattern-and-json.ts
 */

import {
    LogManager,
    ConsoleAppender,
    LogLevel,
    PatternLayout,
    JsonLayout,
    MDC,
} from '../src';

console.log('=== Decoupled Layouts Demo ===\n');

// 1. Setup sample log entry via logger
const loggerName = 'com.enterprise.billing.InvoiceService';

// --- DEMO 1: PatternLayout (Human-readable CLI format) ---
console.log('--- 1. PatternLayout Examples ---');

const cliPattern = new PatternLayout({
    pattern: '%d{YYYY-MM-DD HH:mm:ss.SSS} [%p] %c{2} - %m %X',
});

const minimalPattern = new PatternLayout({
    pattern: '[%p] %c: %m',
});

LogManager.configure({
    minLevel: LogLevel.DEBUG,
    appenders: [
        new ConsoleAppender({
            minLevel: LogLevel.DEBUG,
            layout: cliPattern,
        }),
    ],
});

const logger = LogManager.getLogger(loggerName);

MDC.run({ tenantId: 'tenant-42', invoiceId: 'inv-2026-001' }, () => {
    logger.info('Invoice generated and awaiting payment processing');
    logger.warn('Invoice currency mismatch detected', { expected: 'USD', actual: 'EUR' });
});

// --- DEMO 2: JsonLayout (Structured logging for CloudWatch / Datadog / ELK) ---
console.log('\n--- 2. JsonLayout (Production NDJSON) ---');

const productionJsonLayout = new JsonLayout({
    pretty: false,
    timestampFormat: 'iso',
    fieldNames: {
        timestamp: '@timestamp',
        level: 'severity',
        logger: 'logger_name',
    },
});

LogManager.configure({
    minLevel: LogLevel.INFO,
    appenders: [
        new ConsoleAppender({
            layout: productionJsonLayout,
        }),
    ],
});

const jsonLogger = LogManager.getLogger(loggerName);

MDC.run({ traceId: 'trace-abc-789', spanId: 'span-001' }, () => {
    jsonLogger.info('Payment processed successfully via Stripe', {
        amount: 250.0,
        currency: 'USD',
    });

    try {
        throw new Error('Receipt delivery webhook failed (HTTP 503)');
    } catch (err) {
        jsonLogger.error('Webhook notification failed', err as Error, {
            destination: 'https://hooks.client.com/receipt',
            retryAttempt: 2,
        });
    }
});

// --- DEMO 3: JsonLayout (Pretty printed for local debugging) ---
console.log('\n--- 3. JsonLayout (Pretty Printed) ---');

const prettyJsonLayout = new JsonLayout({
    pretty: true,
    timestampFormat: 'epoch',
});

LogManager.configure({
    minLevel: LogLevel.INFO,
    appenders: [
        new ConsoleAppender({
            layout: prettyJsonLayout,
        }),
    ],
});

const debugLogger = LogManager.getLogger('com.enterprise.debug');
debugLogger.info('Configuration reloaded from Consul', { loadedKeys: 14 });

console.log('\nLayouts example completed successfully.');
