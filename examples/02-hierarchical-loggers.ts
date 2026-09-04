/**
 * Example 02: Hierarchical Loggers & Additivity
 *
 * Demonstrates the hierarchical logger tree modeled after Log4j:
 * - Dot-delimited logger namespaces (e.g. "api.services.auth")
 * - Log level inheritance (children inherit parent/root levels when not explicitly set)
 * - Appender additivity (logs bubble up through parent appenders by default)
 * - Disabling additivity (restricting logs to a child's private appender)
 *
 * Run with:
 *   npx ts-node examples/02-hierarchical-loggers.ts
 */

import { LogManager, ConsoleAppender, LogLevel } from '../src';

console.log('=== Hierarchical Loggers & Additivity ===\n');

// 1. Configure root and specific logger nodes
LogManager.configure({
    // Root logger level is WARN by default
    minLevel: LogLevel.WARN,
    appenders: [
        new ConsoleAppender({
            format: '[ROOT Console] [{level}] {namespace} - {message}',
        }),
    ],
    loggers: {
        // 'api' inherits from root, but we lower its level to INFO
        'api': {
            level: LogLevel.INFO,
        },
        // 'api.services.audit' has its own dedicated appender and disables additivity
        'api.services.audit': {
            level: LogLevel.DEBUG,
            additivity: false, // Do NOT bubble up to 'api' or root
            appenders: [
                new ConsoleAppender({
                    minLevel: LogLevel.DEBUG,
                    format: '[AUDIT Console] [{level}] {namespace} - {message}',
                }),
            ],
        },
    },
});

// 2. Obtain loggers at various points in the hierarchy
const rootLogger = LogManager.getRootLogger();
const apiLogger = LogManager.getLogger('api');
const authServiceLogger = LogManager.getLogger('api.services.auth');
const auditLogger = LogManager.getLogger('api.services.audit');

// 3. Root logger only logs WARN and above
console.log('--- Root Logger (level: WARN) ---');
rootLogger.info('This root INFO log will be ignored.');
rootLogger.warn('Root WARN message will be displayed.');

// 4. 'api' and 'api.services.auth' inherit the INFO level from 'api'
// 'api.services.auth' bubbles up to the root appender because additivity is true
console.log('\n--- Inherited Logger: api.services.auth (level: INFO, additivity: true) ---');
authServiceLogger.debug('This DEBUG log will be ignored (below INFO).');
authServiceLogger.info('User "alice" authenticated successfully.'); // Output via ROOT Console!

// 5. 'api.services.audit' has additivity = false, so it logs ONLY to AUDIT Console
console.log('\n--- Isolated Logger: api.services.audit (level: DEBUG, additivity: false) ---');
auditLogger.debug('Audit trail recording: user password changed.'); // Output via AUDIT Console ONLY!
auditLogger.info('Audit event captured.');

console.log('\nHierarchy and additivity example completed.');
