import { LogManager } from './core/LogManager';
import { Logger } from './core/Logger';
import { LogLevel } from './constants';
import { ConsoleAppender } from './appenders/ConsoleAppender';
import { FileAppender, FileAppenderConfig } from './appenders/FileAppender';
import { LoggerConfig, AppenderConfig, LogEntry } from './core/types';

// Initialize the singleton LogManager
const logManager = LogManager.getInstance();

// Create a default logger instance for immediate use
const defaultLogger = logManager.getLogger('default');

export {
    logManager,
    defaultLogger,
    Logger,
    LogLevel,
    ConsoleAppender,
    FileAppender,
};

export type {
    LoggerConfig,
    AppenderConfig,
    FileAppenderConfig,
    LogEntry,
};
