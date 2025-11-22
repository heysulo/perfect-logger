/**
 * Example Usage for perfect-logger
 *
 * To run this example, you will first need to build the project:
 * 1. npm install
 * 2. npm run build
 *
 * Then, you can run this file using ts-node:
 * 3. npx ts-node examples/basic-usage.ts
 */

import { logManager, ConsoleAppender, FileAppender, LogLevel } from '../src';

// 1. Configure the LogManager
// This is the central configuration for your entire application's logging.
logManager.configure({
    minLevel: LogLevel.INFO, // Ignore TRACE and DEBUG messages globally
    timezone: 'America/New_York', // Set a global default timezone
    appenders: [
        // A ConsoleAppender for real-time terminal output
        new ConsoleAppender({
            // Override the global minLevel for this appender
            minLevel: LogLevel.INFO,
            // Custom format for console logs
            format: '[{level}] {namespace} - {message}',
        }),
        // A FileAppender for persistent, organized logs
        new FileAppender({
            minLevel: LogLevel.DEBUG, // Log more detailed info to files
            logDirectory: 'example-app-logs', // Specify a custom directory
        }),
    ],
});

// 2. Get a logger for a specific module or namespace
const appLogger = logManager.getLogger('ExampleApp');

appLogger.info('Application starting up...');
appLogger.warn('Storage is getting low.', { remaining: '10%' });

// This message will be ignored by the ConsoleAppender but written by the FileAppender
appLogger.debug('Initializing subsystems.', { subsystem: 'Auth' });

// 3. Create a child logger for a specific context (e.g., a request)
const requestLogger = appLogger.child({ requestId: 'abc-123' });

requestLogger.info('Processing incoming request.');
requestLogger.error(
    'Failed to process user data.',
    new Error('User not found'),
    { userId: 12345 }
);

appLogger.info('Application shutdown complete.');

console.log('\nLog examples have been executed.');
console.log('Check the terminal for console output and the "my-app-logs" directory for file output.');
