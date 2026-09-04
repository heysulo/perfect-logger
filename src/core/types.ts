import { LogLevel } from '../constants';
import { Layout } from '../layouts/layout';
import { Marker } from './marker';
import { Filter, FilterResult } from '../filters/filter';

export type { Layout, Marker, Filter };
export { FilterResult };

/**
 * The standardized data structure for a log message.
 * Every appender receives this object.
 */
export interface LogEntry {
    /** Date object representing when the log occurred */
    timestamp: Date;
    /** Numeric severity level */
    level: LogLevel;
    /** The name of the logger (e.g. "services.auth") */
    namespace: string;
    /** The main log message */
    message: string;
    /** Optional Marker tag for semantic categorisation (e.g. SECURITY, AUDIT) */
    marker?: Marker;
    /**
     * Contextual metadata (user IDs, request IDs, etc.)
     * Result of merging MDC + Logger Context + Local Context.
     */
    context?: Record<string, unknown>;
    /** Optional error object if one was passed */
    error?: Error;
}

/**
 * Per-logger configuration in the hierarchy tree.
 */
export interface LoggerNodeConfig {
    /** Minimum level for this logger. If omitted, inherits from parent or root. */
    level?: LogLevel;
    /** List of appenders specific to this logger */
    appenders?: Appender[];
    /**
     * Whether log events bubble up to ancestor loggers and their appenders.
     * Default: true.
     */
    additivity?: boolean;
    /** Filters specific to this logger */
    filters?: Filter[] | Filter;
}

/**
 * Configuration options for the entire LogManager.
 */
export interface LoggerConfig {
    /** Minimum level to process globally. Default: INFO */
    minLevel?: LogLevel;
    /** Root appenders list */
    appenders?: Appender[];
    /** Global filters applied before dispatching to loggers */
    filters?: Filter[] | Filter;
    /**
     * Global default timezone for all appenders.
     * Uses the IANA Time Zone Database format (e.g., "America/New_York", "UTC").
     */
    timezone?: string;
    /** Explicit root logger configuration */
    root?: LoggerNodeConfig;
    /** Hierarchical logger configurations keyed by namespace (e.g. "api.auth") */
    loggers?: Record<string, LoggerNodeConfig>;
}

/**
 * Configuration for an individual Appender.
 */
export interface AppenderConfig {
    /**
     * Optional override. If set, this appender only logs if level >= minLevel (or filter accepts).
     */
    minLevel?: LogLevel;

    /**
     * The layout to use for formatting log entries.
     */
    layout?: Layout;

    /**
     * Optional filter or list of filters to evaluate for each log entry before handling.
     */
    filters?: Filter[] | Filter;

    /**
     * If batchSize > 1, logs are buffered and written in batches.
     */
    batchSize?: number;
    batchInterval?: number;

    /**
     * Optional override for this appender's timezone.
     * Uses the IANA Time Zone Database format (e.g., "America/New_York", "UTC").
     */
    timezone?: string;
}

/**
 * Configuration specific to the ConsoleAppender.
 */
export interface ConsoleAppenderConfig extends AppenderConfig {
    /**
     * Optional format pattern string.
     * If provided without an explicit layout, creates a PatternLayout.
     */
    format?: string;
}

/**
 * The Interface all appender plugins (Console, File, Stream, etc.) must implement.
 */
export interface Appender {
    name: string;
    layout?: Layout;
    filters?: Filter[];

    /**
     * The main entry point called by LogManager / Logger for each log entry.
     * Handles filter evaluation, level filtering, and optional batching before delegating to handle().
     */
    log(entry: LogEntry): Promise<void> | void;

    /**
     * Called internally by the log() pipeline after filtering/batching.
     * Implementations should write the log to their destination.
     */
    handle(entry: LogEntry): Promise<void> | void;

    /**
     * Optional: Handle a batch of logs at once.
     * If batching is enabled, this is called instead of handle().
     */
    handleBatch?(entries: LogEntry[]): Promise<void> | void;

    /**
     * Flush any buffered log entries immediately.
     */
    flush(): Promise<void>;

    /**
     * Clean up resources (timers, file handles, etc.).
     * Called during LogManager.shutdown() or when appenders are replaced.
     */
    destroy(): void;
}
