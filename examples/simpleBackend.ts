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
import {LogManager} from "../src/core/LogManager";

LogManager.simpleBackendConfig();

const logger = logManager.getLogger('BackendApp');

logger.info('Application starting up...');
logger.warn('Storage is getting low.', { remaining: '10%' });
logger.debug('Initializing subsystems.', { subsystem: 'Auth' });
logger.info('Processing incoming request.');
logger.error(
    'Failed to process user data.',
    new Error('User not found'),
    { userId: 12345 }
);
logger.info('Application shutdown complete.');
