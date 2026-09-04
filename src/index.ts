import { LogManager } from './core/log-manager';
import { Logger, LoggerOptions } from './core/logger';
import { LogLevel } from './constants';
import { MDC } from './core/mdc';
import { Marker, MarkerManager, Markers } from './core/marker';
import { Filter, FilterResult } from './filters/filter';
import { ThresholdFilter, ThresholdFilterOptions } from './filters/threshold-filter';
import { MarkerFilter, MarkerFilterOptions } from './filters/marker-filter';
import { RegexFilter, RegexFilterOptions } from './filters/regex-filter';
import { ContextFilter, ContextFilterOptions } from './filters/context-filter';
import { CompositeFilter } from './filters/composite-filter';
import { BaseAppender } from './appenders/base-appender';
import { ConsoleAppender } from './appenders/console-appender';
import { FileAppender, RollingFileAppender, FileAppenderConfig } from './appenders/file-appender';
import { StreamAppender, StreamAppenderConfig } from './appenders/stream-appender';
import { HttpAppender, HttpAppenderConfig } from './appenders/http-appender';
import { AsyncAppender, AsyncAppenderConfig, OverflowPolicy } from './appenders/async-appender';
import { CallbackAppender, CallbackAppenderConfig, LogCallback } from './appenders/callback-appender';
import { JsonAppender, JsonAppenderConfig } from './appenders/json-appender';
import { Layout } from './layouts/layout';
import { PatternLayout, PatternLayoutOptions, DEFAULT_PATTERN } from './layouts/pattern-layout';
import { JsonLayout, JsonLayoutOptions, JsonLayoutFieldNames } from './layouts/json-layout';
import { ConfigLoader, DeclarativeConfig, DeclarativeAppenderConfig, DeclarativeLayoutConfig } from './config/config-loader';
import { LogFormatter } from './utils/log-formatter';
import { LoggerConfig, LoggerNodeConfig, AppenderConfig, LogEntry, Appender, ConsoleAppenderConfig } from './core/types';

/**
 * Singleton instance of the central LogManager.
 */
const logManager = LogManager.getInstance();

/**
 * Pre-configured default logger instance ready for immediate use.
 *
 * @example
 * ```ts
 * import { defaultLogger } from 'perfect-logger';
 * defaultLogger.info('Hello world');
 * ```
 */
const defaultLogger = logManager.getLogger('default');

export {
    logManager,
    defaultLogger,
    Logger,
    LogManager,
    LogLevel,
    MDC,
    Marker,
    MarkerManager,
    Markers,
    FilterResult,
    ThresholdFilter,
    MarkerFilter,
    RegexFilter,
    ContextFilter,
    CompositeFilter,
    BaseAppender,
    ConsoleAppender,
    FileAppender,
    RollingFileAppender,
    StreamAppender,
    HttpAppender,
    AsyncAppender,
    CallbackAppender,
    JsonAppender,
    PatternLayout,
    JsonLayout,
    DEFAULT_PATTERN,
    ConfigLoader,
    LogFormatter,
};

export type {
    Appender,
    Layout,
    Filter,
    ThresholdFilterOptions,
    MarkerFilterOptions,
    RegexFilterOptions,
    ContextFilterOptions,
    PatternLayoutOptions,
    JsonLayoutOptions,
    JsonLayoutFieldNames,
    LoggerOptions,
    LoggerConfig,
    LoggerNodeConfig,
    AppenderConfig,
    ConsoleAppenderConfig,
    FileAppenderConfig,
    StreamAppenderConfig,
    HttpAppenderConfig,
    AsyncAppenderConfig,
    OverflowPolicy,
    CallbackAppenderConfig,
    JsonAppenderConfig,
    DeclarativeConfig,
    DeclarativeAppenderConfig,
    DeclarativeLayoutConfig,
    LogCallback,
    LogEntry,
};
