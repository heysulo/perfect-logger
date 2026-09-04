/**
 * Example 08: Declarative JSON Configuration
 *
 * Demonstrates zero-code setup using declarative configuration:
 * - Loading logger.config.json via LogManager.autoConfigure()
 * - Dynamic runtime environment variable interpolation (${env:LOG_LEVEL:-INFO})
 * - Declaratively attaching appenders, layouts, and hierarchical loggers
 * - Writing structured logs without programmatic wiring
 *
 * Run with:
 *   npx ts-node examples/08-declarative-config.ts
 */

import { LogManager, MDC } from '../src';
import * as path from 'path';
import * as fs from 'fs';

console.log('=== Declarative Configuration Demo ===\n');

async function main(): Promise<void> {
    // 1. Optionally simulate an environment variable override
    process.env.LOG_LEVEL = 'INFO';
    console.log(`Simulated Environment Variable: LOG_LEVEL = "${process.env.LOG_LEVEL}"`);

    // 2. Automatically discover and load logger.config.json in the current directory
    console.log('Loading configuration from logger.config.json via LogManager.autoConfigure()...');
    LogManager.autoConfigure(__dirname);

    // 3. Obtain loggers defined in the hierarchy
    const appLogger = LogManager.getLogger('com.enterprise.app.Server');
    const secLogger = LogManager.getLogger('com.enterprise.security.TokenValidator');

    // 4. Test root logger level (INFO)
    appLogger.debug('This debug log should be suppressed (root level is INFO)');
    appLogger.info('Web server started successfully', { port: 3000, host: '0.0.0.0' });

    // 5. Test logger-specific override (com.enterprise.security level is DEBUG in JSON config)
    MDC.run({ traceId: 'trc-config-99' }, () => {
        secLogger.debug('JWT signature verified successfully', { algorithm: 'RS256' });
        secLogger.info('Access granted for user token', { scope: ['read', 'write'] });
    });

    // 6. Flush pending I/O and verify file output
    await LogManager.flush();

    const logFilePath = path.join(process.cwd(), 'logs/declarative/application.log');
    if (fs.existsSync(logFilePath)) {
        const fileContent = fs.readFileSync(logFilePath, 'utf-8');
        console.log(`\nDeclarative file appender wrote to: ${logFilePath}`);
        console.log('Sample file content:\n' + fileContent.trim());
    }

    await LogManager.shutdown();

    console.log('\nDeclarative configuration example completed successfully.');
}

main().catch(console.error);
