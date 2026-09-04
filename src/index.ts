import { LogManager } from './core/LogManager';
import { Logger } from './core/Logger';
import { LogLevel } from './constants';
import { BaseAppender } from './appenders/BaseAppender';
import { ConsoleAppender } from './appenders/ConsoleAppender';
import { FileAppender, FileAppenderConfig } from './appenders/FileAppender';
import { CallbackAppender, CallbackAppenderConfig, LogCallback } from './appenders/CallbackAppender';
import { JsonAppender, JsonAppenderConfig } from './appenders/JsonAppender';
import { LogFormatter } from './utils/LogFormatter';
import { LoggerConfig, AppenderConfig, LogEntry, Appender, ConsoleAppenderConfig } from './core/types';

// Initialize the singleton LogManager
const logManager = LogManager.getInstance();

// Create a default logger instance for immediate use
const defaultLogger = logManager.getLogger('default');

export {
    logManager,
    defaultLogger,
    Logger,
    LogManager,
    LogLevel,
    BaseAppender,
    ConsoleAppender,
    FileAppender,
    CallbackAppender,
    JsonAppender,
    LogFormatter,
};

export type {
    Appender,
    LoggerConfig,
    AppenderConfig,
    ConsoleAppenderConfig,
    FileAppenderConfig,
    CallbackAppenderConfig,
    JsonAppenderConfig,
    LogCallback,
    LogEntry,
};
