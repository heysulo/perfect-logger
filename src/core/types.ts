import { LogLevel } from '../constants';

/**
 * The standardized data structure for a log message.
 * Every appender receives this object.
 */
export interface LogEntry {
    /** Date object representing when the log occurred */
    timestamp: Date;
    /** Numeric severity level */
    level: LogLevel;
    /** The name of the logger (e.g. "AuthService") */
    namespace: string;
    /** The main log message */
    message: string;
    /** * Contextual metadata (user IDs, request IDs, etc.)
     * This is the result of merging Global + Child + Local context.
     */
    context?: Record<string, any>;
    /** Optional error object if one was passed */
    error?: Error;
}

/**
 * Configuration options for the entire LogManager.
 */
export interface LoggerConfig {
    /** Minimum level to process. Logs below this are ignored immediately. Default: INFO */
    minLevel: LogLevel;
    /** List of appenders to dispatch logs to */
    appenders: Appender[];
    /**
     * Global default timezone for all appenders.
     * Can be overridden by individual appenders.
     * Uses the IANA Time Zone Database format (e.g., "America/New_York", "UTC").
     */
    timezone?: string;
}

/**
 * Configuration for an individual Appender.
 */
export interface AppenderConfig {
    /** * Optional override. If set, this appender only logs if level >= minLevel.
     * Allows having a "File" appender for everything and "Console" only for Errors.
     */
    minLevel?: LogLevel;

    /**
     * If true, logs are buffered and written in batches.
     */
    batchSize?: number;
    batchInterval?: number;
    /**
     * Optional override for this appender's timezone.
     * If not set, the global `LoggerConfig.timezone` is used.
     * Uses the IANA Time Zone Database format (e.g., "America/New_York", "UTC").
     */
    timezone?: string;
}

/**
 * Configuration specific to the ConsoleAppender.
 */
export interface ConsoleAppenderConfig extends AppenderConfig {
    /**
     * A template string for formatting log messages.
     * Placeholders like {date}, {time}, {level}, {namespace}, {message}, {context}, and {error} will be replaced.
     * Default: "{date} | {time} | {level} | {message}"
     */
    format?: string;
}


/**
 * The Interface all plugins (Console, File, Memory) must implement.
 */
export interface Appender {
    name: string;
    /**
     * Called internally by the BaseAppender logic.
     * Implementations should write the logs to their destination.
     */
    handle(entry: LogEntry): Promise<void> | void;

    /**
     * Optional: Handle a batch of logs at once.
     * If batching is enabled, this is called instead of handle().
     */
    handleBatch?(entries: LogEntry[]): Promise<void> | void;
}
