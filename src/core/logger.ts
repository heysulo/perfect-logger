import { LogLevel } from '../constants';
import { LogManager } from './log-manager';
import { LogEntry, Appender } from './types';
import { Marker } from './marker';
import { MDC } from './mdc';
import { Filter, FilterResult } from '../filters/filter';

/**
 * Configuration options for creating or modifying a Logger instance.
 */
export interface LoggerOptions {
    /** Parent logger in the hierarchy. Defaults to root logger. */
    parent?: Logger | null;
    /** Explicit log level for this logger. If omitted, inherits from ancestor. */
    level?: LogLevel;
    /** Appenders directly attached to this logger. */
    appenders?: Appender[];
    /** Whether log events bubble up to parent logger appenders. Default: true. */
    additivity?: boolean;
    /** Filter or list of filters to evaluate before handling log events. */
    filters?: Filter[] | Filter;
}

/**
 * The user-facing hierarchical Logger class modeled after Log4j.
 * Supports level inheritance, additivity propagation, Markers, MDC, and contextual child loggers.
 */
export class Logger {
    private parent: Logger | null = null;
    private level?: LogLevel;
    private appenders: Appender[] = [];
    private additivity = true;
    public readonly filters: Filter[] = [];

    constructor(
        private readonly logManager: LogManager,
        public readonly namespace: string,
        private readonly context: Record<string, unknown> = {},
        options?: LoggerOptions
    ) {
        if (options) {
            this.parent = options.parent ?? null;
            this.level = options.level;
            this.appenders = options.appenders ? [...options.appenders] : [];
            this.additivity = options.additivity ?? true;
            if (options.filters) {
                this.filters = Array.isArray(options.filters) ? [...options.filters] : [options.filters];
            }
        }
    }

    /**
     * Resolves the effective log level by walking up the ancestor hierarchy.
     * If no ancestor specifies a level, defaults to INFO.
     */
    public getEffectiveLevel(): LogLevel {
        if (this.level !== undefined) {
            return this.level;
        }
        if (this.parent) {
            return this.parent.getEffectiveLevel();
        }
        return LogLevel.INFO;
    }

    /**
     * Checks if a given log level is enabled for this logger.
     */
    public isLevelEnabled(level: LogLevel): boolean {
        return level >= this.getEffectiveLevel();
    }

    /** Returns true if TRACE level logs are enabled for this logger. */
    public isTraceEnabled(): boolean { return this.isLevelEnabled(LogLevel.TRACE); }
    /** Returns true if DEBUG level logs are enabled for this logger. */
    public isDebugEnabled(): boolean { return this.isLevelEnabled(LogLevel.DEBUG); }
    /** Returns true if INFO level logs are enabled for this logger. */
    public isInfoEnabled(): boolean { return this.isLevelEnabled(LogLevel.INFO); }
    /** Returns true if WARN level logs are enabled for this logger. */
    public isWarnEnabled(): boolean { return this.isLevelEnabled(LogLevel.WARN); }
    /** Returns true if ERROR level logs are enabled for this logger. */
    public isErrorEnabled(): boolean { return this.isLevelEnabled(LogLevel.ERROR); }
    /** Returns true if FATAL level logs are enabled for this logger. */
    public isFatalEnabled(): boolean { return this.isLevelEnabled(LogLevel.FATAL); }

    /** Returns the parent logger in the hierarchy, or null if this is root. */
    public getParent(): Logger | null { return this.parent; }
    /** Sets the parent logger in the hierarchy. */
    public setParent(parent: Logger | null): void { this.parent = parent; }

    /** Returns the explicit log level configured directly on this logger, if any. */
    public getLevel(): LogLevel | undefined { return this.level; }
    /** Sets an explicit log level on this logger. Pass undefined to inherit from parent. */
    public setLevel(level?: LogLevel): void { this.level = level; }

    /** Returns a shallow copy of appenders attached to this logger. */
    public getAppenders(): Appender[] { return [...this.appenders]; }
    /** Replaces the list of appenders attached to this logger. */
    public setAppenders(appenders: Appender[]): void { this.appenders = [...appenders]; }
    /** Attaches an appender to this logger. */
    public addAppender(appender: Appender): void { this.appenders.push(appender); }

    /** Returns whether additivity (bubbling events to parent appenders) is enabled. */
    public getAdditivity(): boolean { return this.additivity; }
    /** Sets whether additivity is enabled for this logger. */
    public setAdditivity(additivity: boolean): void { this.additivity = additivity; }

    /** Adds a filter to be evaluated for events logged through this logger. */
    public addFilter(filter: Filter): void { this.filters.push(filter); }

    /**
     * Logs a message at TRACE level.
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public trace(message: string, context?: Record<string, unknown>): void;
    /**
     * Logs a message at TRACE level tagged with a Marker.
     * @param marker Semantic marker tag (e.g. Markers.PERF).
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public trace(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public trace(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.TRACE, markerOrMessage, messageOrContext, context);
    }

    /**
     * Logs a message at DEBUG level.
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public debug(message: string, context?: Record<string, unknown>): void;
    /**
     * Logs a message at DEBUG level tagged with a Marker.
     * @param marker Semantic marker tag (e.g. Markers.SQL).
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public debug(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public debug(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.DEBUG, markerOrMessage, messageOrContext, context);
    }

    /**
     * Logs a message at INFO level.
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public info(message: string, context?: Record<string, unknown>): void;
    /**
     * Logs a message at INFO level tagged with a Marker.
     * @param marker Semantic marker tag.
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public info(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public info(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.INFO, markerOrMessage, messageOrContext, context);
    }

    /**
     * Logs a message at WARN level.
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public warn(message: string, context?: Record<string, unknown>): void;
    /**
     * Logs a message at WARN level tagged with a Marker.
     * @param marker Semantic marker tag.
     * @param message The text message to log.
     * @param context Optional contextual key-value metadata.
     */
    public warn(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public warn(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.WARN, markerOrMessage, messageOrContext, context);
    }

    /**
     * Logs an error message at ERROR level with an Error object and optional context.
     * @param message The text message describing the error.
     * @param error An Error object whose stack and message will be captured.
     * @param context Optional contextual key-value metadata.
     */
    public error(message: string, error?: Error, context?: Record<string, unknown>): void;
    /**
     * Logs an error message at ERROR level with optional context (omitting Error).
     * @param message The text message describing the error.
     * @param context Optional contextual key-value metadata.
     */
    public error(message: string, context?: Record<string, unknown>): void;
    /**
     * Logs an error message at ERROR level tagged with a Marker.
     * @param marker Semantic marker tag (e.g. Markers.SECURITY).
     * @param message The text message describing the error.
     * @param error An Error object whose stack and message will be captured.
     * @param context Optional contextual key-value metadata.
     */
    public error(marker: Marker, message: string, error?: Error, context?: Record<string, unknown>): void;
    /**
     * Logs an error message at ERROR level tagged with a Marker and context (omitting Error).
     * @param marker Semantic marker tag.
     * @param message The text message describing the error.
     * @param context Optional contextual key-value metadata.
     */
    public error(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public error(
        markerOrMessage: Marker | string,
        messageOrError?: string | Error | Record<string, unknown>,
        errorOrContext?: Error | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchErrorLog(LogLevel.ERROR, markerOrMessage, messageOrError, errorOrContext, context);
    }

    /**
     * Logs a critical failure at FATAL level with an Error object and optional context.
     * @param message The text message describing the fatal condition.
     * @param error An Error object whose stack and message will be captured.
     * @param context Optional contextual key-value metadata.
     */
    public fatal(message: string, error?: Error, context?: Record<string, unknown>): void;
    /**
     * Logs a critical failure at FATAL level with optional context (omitting Error).
     * @param message The text message describing the fatal condition.
     * @param context Optional contextual key-value metadata.
     */
    public fatal(message: string, context?: Record<string, unknown>): void;
    /**
     * Logs a critical failure at FATAL level tagged with a Marker.
     * @param marker Semantic marker tag.
     * @param message The text message describing the fatal condition.
     * @param error An Error object whose stack and message will be captured.
     * @param context Optional contextual key-value metadata.
     */
    public fatal(marker: Marker, message: string, error?: Error, context?: Record<string, unknown>): void;
    /**
     * Logs a critical failure at FATAL level tagged with a Marker and context (omitting Error).
     * @param marker Semantic marker tag.
     * @param message The text message describing the fatal condition.
     * @param context Optional contextual key-value metadata.
     */
    public fatal(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public fatal(
        markerOrMessage: Marker | string,
        messageOrError?: string | Error | Record<string, unknown>,
        errorOrContext?: Error | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchErrorLog(LogLevel.FATAL, markerOrMessage, messageOrError, errorOrContext, context);
    }

    /**
     * Creates a child logger with merged context.
     * The child logger shares the same hierarchy configuration as this logger.
     */
    public child(context: Record<string, unknown>): Logger {
        const mergedContext = { ...this.context, ...context };
        return new Logger(this.logManager, this.namespace, mergedContext, {
            parent: this.parent,
            level: this.level,
            appenders: this.appenders,
            additivity: this.additivity,
            filters: this.filters,
        });
    }

    /**
     * Dispatches the log entry to this logger's appenders, and bubbles up to parent
     * appenders if additivity is enabled.
     */
    public dispatchToAppenders(entry: LogEntry): void {
        for (const appender of this.appenders) {
            try {
                const result = appender.log(entry);
                if (result instanceof Promise) {
                    result.catch((e: unknown) => {
                        console.error(`[perfect-logger] Error in appender "${appender.name}":`, e);
                    });
                }
            } catch (e) {
                console.error(`[perfect-logger] Error in appender "${appender.name}":`, e);
            }
        }

        if (this.additivity && this.parent) {
            this.parent.dispatchToAppenders(entry);
        }
    }

    private dispatchStandardLog(
        level: LogLevel,
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        if (markerOrMessage instanceof Marker) {
            const msg = typeof messageOrContext === 'string' ? messageOrContext : '';
            this.log(level, msg, context, undefined, markerOrMessage);
        } else {
            const ctx = typeof messageOrContext === 'object' && messageOrContext !== null ? messageOrContext : context;
            this.log(level, markerOrMessage, ctx);
        }
    }

    private dispatchErrorLog(
        level: LogLevel,
        markerOrMessage: Marker | string,
        messageOrError?: string | Error | Record<string, unknown>,
        errorOrContext?: Error | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        if (markerOrMessage instanceof Marker) {
            const msg = typeof messageOrError === 'string' ? messageOrError : '';
            const err = errorOrContext instanceof Error ? errorOrContext : undefined;
            const ctx = context ?? (errorOrContext && !(errorOrContext instanceof Error) ? errorOrContext : undefined);
            this.log(level, msg, ctx, err, markerOrMessage);
        } else {
            const msg = markerOrMessage;
            let err: Error | undefined;
            let ctx: Record<string, unknown> | undefined;

            if (messageOrError instanceof Error) {
                err = messageOrError;
                ctx = errorOrContext && !(errorOrContext instanceof Error) ? errorOrContext : context;
            } else if (typeof messageOrError === 'object' && messageOrError !== null) {
                ctx = messageOrError;
                err = errorOrContext instanceof Error ? errorOrContext : undefined;
            } else {
                err = errorOrContext instanceof Error ? errorOrContext : undefined;
                ctx = errorOrContext && !(errorOrContext instanceof Error) ? errorOrContext : context;
            }

            this.log(level, msg, ctx, err);
        }
    }

    private log(
        level: LogLevel,
        message: string,
        localContext?: Record<string, unknown>,
        error?: Error,
        marker?: Marker
    ): void {
        const mdcContext = MDC.getContext();
        const mergedContext = { ...mdcContext, ...this.context, ...localContext };
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            namespace: this.namespace,
            message,
            marker,
            context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
            error,
        };

        // 1. Evaluate global filters from LogManager
        const globalFilters = this.logManager.getFilters();
        let isGloballyAccepted = false;
        if (globalFilters.length > 0) {
            let globalDecision = FilterResult.NEUTRAL;
            for (const filter of globalFilters) {
                const res = filter.filter(entry);
                if (res !== FilterResult.NEUTRAL) {
                    globalDecision = res;
                    break;
                }
            }
            if (globalDecision === FilterResult.DENY) {
                return;
            }
            if (globalDecision === FilterResult.ACCEPT) {
                isGloballyAccepted = true;
            }
        }

        // 2. Evaluate logger-level filters
        if (this.filters.length > 0) {
            let decision = FilterResult.NEUTRAL;
            for (const filter of this.filters) {
                const res = filter.filter(entry);
                if (res !== FilterResult.NEUTRAL) {
                    decision = res;
                    break;
                }
            }

            if (decision === FilterResult.DENY) {
                return;
            }
            if (decision === FilterResult.NEUTRAL && !isGloballyAccepted && !this.isLevelEnabled(level)) {
                return;
            }
        } else if (!isGloballyAccepted && !this.isLevelEnabled(level)) {
            return;
        }

        if (entry.context) {
            Object.freeze(entry.context);
        }
        Object.freeze(entry);

        this.dispatchToAppenders(entry);
    }
}
