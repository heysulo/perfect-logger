import { LogLevel } from '../constants';
import { LogManager } from './log-manager';
import { LogEntry, Appender } from './types';
import { Marker } from './marker';
import { MDC } from './mdc';
import { Filter, FilterResult } from '../filters/filter';

export interface LoggerOptions {
    parent?: Logger | null;
    level?: LogLevel;
    appenders?: Appender[];
    additivity?: boolean;
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

    public isTraceEnabled(): boolean { return this.isLevelEnabled(LogLevel.TRACE); }
    public isDebugEnabled(): boolean { return this.isLevelEnabled(LogLevel.DEBUG); }
    public isInfoEnabled(): boolean { return this.isLevelEnabled(LogLevel.INFO); }
    public isWarnEnabled(): boolean { return this.isLevelEnabled(LogLevel.WARN); }
    public isErrorEnabled(): boolean { return this.isLevelEnabled(LogLevel.ERROR); }
    public isFatalEnabled(): boolean { return this.isLevelEnabled(LogLevel.FATAL); }

    public getParent(): Logger | null { return this.parent; }
    public setParent(parent: Logger | null): void { this.parent = parent; }

    public getLevel(): LogLevel | undefined { return this.level; }
    public setLevel(level?: LogLevel): void { this.level = level; }

    public getAppenders(): Appender[] { return [...this.appenders]; }
    public setAppenders(appenders: Appender[]): void { this.appenders = [...appenders]; }
    public addAppender(appender: Appender): void { this.appenders.push(appender); }

    public getAdditivity(): boolean { return this.additivity; }
    public setAdditivity(additivity: boolean): void { this.additivity = additivity; }

    public addFilter(filter: Filter): void { this.filters.push(filter); }

    public trace(message: string, context?: Record<string, unknown>): void;
    public trace(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public trace(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.TRACE, markerOrMessage, messageOrContext, context);
    }

    public debug(message: string, context?: Record<string, unknown>): void;
    public debug(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public debug(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.DEBUG, markerOrMessage, messageOrContext, context);
    }

    public info(message: string, context?: Record<string, unknown>): void;
    public info(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public info(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.INFO, markerOrMessage, messageOrContext, context);
    }

    public warn(message: string, context?: Record<string, unknown>): void;
    public warn(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public warn(
        markerOrMessage: Marker | string,
        messageOrContext?: string | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchStandardLog(LogLevel.WARN, markerOrMessage, messageOrContext, context);
    }

    public error(message: string, error?: Error, context?: Record<string, unknown>): void;
    public error(message: string, context?: Record<string, unknown>): void;
    public error(marker: Marker, message: string, error?: Error, context?: Record<string, unknown>): void;
    public error(marker: Marker, message: string, context?: Record<string, unknown>): void;
    public error(
        markerOrMessage: Marker | string,
        messageOrError?: string | Error | Record<string, unknown>,
        errorOrContext?: Error | Record<string, unknown>,
        context?: Record<string, unknown>
    ): void {
        this.dispatchErrorLog(LogLevel.ERROR, markerOrMessage, messageOrError, errorOrContext, context);
    }

    public fatal(message: string, error?: Error, context?: Record<string, unknown>): void;
    public fatal(message: string, context?: Record<string, unknown>): void;
    public fatal(marker: Marker, message: string, error?: Error, context?: Record<string, unknown>): void;
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
            if (decision === FilterResult.NEUTRAL && !this.isLevelEnabled(level)) {
                return;
            }
        } else if (!this.isLevelEnabled(level)) {
            return;
        }

        if (entry.context) {
            Object.freeze(entry.context);
        }
        Object.freeze(entry);

        this.dispatchToAppenders(entry);
    }
}
