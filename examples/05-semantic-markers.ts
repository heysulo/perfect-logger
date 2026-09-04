/**
 * Example 05: Semantic Markers & Categorization
 *
 * Demonstrates semantic markers modeled after SLF4J / Log4j Markers:
 * - Built-in markers: Markers.SECURITY, Markers.AUDIT, Markers.PERF
 * - Custom markers and parent-child marker hierarchies via MarkerManager
 * - Logging with markers: logger.info(marker, message, context)
 * - Using MarkerFilter to route or filter log events based on semantic tags
 *
 * Run with:
 *   npx ts-node examples/05-semantic-markers.ts
 */

import {
    LogManager,
    ConsoleAppender,
    LogLevel,
    Markers,
    MarkerManager,
    MarkerFilter,
    FilterResult,
    PatternLayout,
} from '../src';

console.log('=== Semantic Markers & Categorization Demo ===\n');

// 1. Create a custom marker hierarchy
// AUTH_FAILURE and SQL_INJECTION are specific children of SECURITY
const AUTH_FAILURE = MarkerManager.getMarker('AUTH_FAILURE', Markers.SECURITY);
const SQL_INJECTION = MarkerManager.getMarker('SQL_INJECTION', Markers.SECURITY);

console.log(`Marker Hierarchy: ${AUTH_FAILURE.toString()}`);
console.log(`AUTH_FAILURE is a SECURITY marker? ${AUTH_FAILURE.contains(Markers.SECURITY)}`); // true
console.log(`Markers.SECURITY is an AUTH_FAILURE? ${Markers.SECURITY.contains('AUTH_FAILURE')}`); // false

// 2. Configure two appenders:
//    - Appender A: General appender for standard operational logs
//    - Appender B: Dedicated Security SIEM appender (only logs events containing Markers.SECURITY)
const securityAppender = new ConsoleAppender({
    minLevel: LogLevel.DEBUG,
    layout: new PatternLayout({
        pattern: '[SECURITY AUDIT LOG] [%p] [%marker] %c: %m %X',
    }),
});
// Add a filter that only ACCEPTS markers containing 'SECURITY' and DENIES all others
securityAppender.addFilter(new MarkerFilter({
    marker: Markers.SECURITY,
    onMatch: FilterResult.ACCEPT,
    onMismatch: FilterResult.DENY,
}));

const generalAppender = new ConsoleAppender({
    minLevel: LogLevel.INFO,
    layout: new PatternLayout({
        pattern: '[GENERAL CONSOLE] [%p] %c: %m',
    }),
});

LogManager.configure({
    minLevel: LogLevel.DEBUG,
    appenders: [generalAppender, securityAppender],
});

const authLogger = LogManager.getLogger('com.enterprise.auth.LoginController');
const userLogger = LogManager.getLogger('com.enterprise.user.ProfileController');

// 3. Normal operational log (will appear only in GENERAL CONSOLE)
console.log('\n--- 1. Logging a standard message (no marker) ---');
userLogger.info('User viewed profile page', { userId: 'usr_42' });

// 4. Security events with hierarchical markers (will appear in GENERAL CONSOLE and SECURITY AUDIT LOG)
console.log('\n--- 2. Logging a security event with AUTH_FAILURE marker ---');
authLogger.warn(
    AUTH_FAILURE,
    'Failed password attempt exceeding threshold',
    { ipAddress: '198.51.100.24', username: 'admin', attemptNumber: 4 }
);

console.log('\n--- 3. Logging a critical SQL injection attack detection ---');
authLogger.error(
    SQL_INJECTION,
    'Detected SQL injection pattern in query param',
    { ipAddress: '203.0.113.195', payload: "' OR 1=1 --" }
);

console.log('\nSemantic markers example completed successfully.');
