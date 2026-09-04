import { LoggerConfig, LogEntry, Appender } from './types';
import { LogLevel } from '../constants';
import { Logger } from './logger';
import { ConsoleAppender } from '../appenders/console-appender';
import { FileAppender } from '../appenders/file-appender';
import { Filter, FilterResult } from '../filters/filter';
import { ConfigLoader } from '../config/config-loader';

/**
 * The singleton LogManager class modeled after Log4j.
 * Central registry, hierarchy manager, and configuration repository.
 */
export class LogManager {
    private static instance: LogManager;
    private config: LoggerConfig;
    private readonly rootLogger: Logger;
    private readonly loggers = new Map<string, Logger>();
    private filters: Filter[] = [];

    private constructor() {
        this.config = {
            minLevel: LogLevel.INFO,
            appenders: [],
            timezone: undefined,
        };
        this.rootLogger = new Logger(this, 'root', {}, {
            level: LogLevel.INFO,
            appenders: [],
            additivity: false,
        });
    }

    public static getInstance(): LogManager {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
        }
        return LogManager.instance;
    }

    /**
     * Static convenience helper to retrieve a logger from the singleton LogManager.
     */
    public static getLogger(namespace: string): Logger {
        return LogManager.getInstance().getLogger(namespace);
    }

    /**
     * Static convenience helper to retrieve the root logger from the singleton LogManager.
     */
    public static getRootLogger(): Logger {
        return LogManager.getInstance().getRootLogger();
    }

    /**
     * Returns the root logger in the hierarchy.
     */
    public getRootLogger(): Logger {
        return this.rootLogger;
    }

    /**
     * Returns the global filters configured on LogManager.
     */
    public getFilters(): Filter[] {
        return [...this.filters];
    }

    /**
     * A convenience method to quickly configure the logger for a typical Node.js backend.
     * Includes a ConsoleAppender and a FileAppender with sensible defaults.
     */
    public static simpleBackendConfig(config: Partial<LoggerConfig> = {}): void {
        const defaultConfig: LoggerConfig = {
            minLevel: LogLevel.INFO,
            appenders: [
                new ConsoleAppender(),
                new FileAppender({
                    minLevel: LogLevel.DEBUG,
                    logDirectory: 'logs',
                }),
            ],
        };
        LogManager.getInstance().configure({ ...defaultConfig, ...config });
    }

    /**
     * A convenience method to quickly configure the logger for a typical frontend.
     * Includes a ConsoleAppender with sensible defaults.
     */
    public static simpleFrontendConfig(config: Partial<LoggerConfig> = {}): void {
        const defaultConfig: LoggerConfig = {
            minLevel: LogLevel.INFO,
            appenders: [
                new ConsoleAppender(),
            ],
        };
        LogManager.getInstance().configure({ ...defaultConfig, ...config });
    }

    /**
     * Automatically attempts to load configuration from logger.config.json or logger.config.js,
     * or applies sensible environment-dependent defaults (JSON in production, Pattern in dev).
     */
    public static autoConfigure(directory?: string): void {
        const fileConfig = ConfigLoader.loadConfigFile(directory);
        if (fileConfig) {
            const parsed = ConfigLoader.parseConfig(fileConfig);
            LogManager.getInstance().configure(parsed);
        } else {
            const defaults = ConfigLoader.getDefaultConfig();
            LogManager.getInstance().configure(defaults);
        }
    }

    /**
     * Configures the LogManager and applies logger hierarchy settings.
     * Destroys existing appenders before replacing them to prevent orphaned timers.
     */
    public configure(config: Partial<LoggerConfig>): void {
        // Clean up existing appenders before replacing them
        const allAppenders = this.getAllAppenders();
        for (const appender of allAppenders) {
            try {
                appender.destroy();
            } catch (e) {
                // Ignore cleanup errors during reconfiguration
            }
        }

        this.config = { ...this.config, ...config };

        // Configure Root Logger
        const rootLevel = config.root?.level ?? config.minLevel ?? LogLevel.INFO;
        const rootAppenders = config.root?.appenders ?? config.appenders ?? [];

        this.rootLogger.setLevel(rootLevel);
        this.rootLogger.setAppenders(rootAppenders);

        // Configure Global Filters
        if (config.filters) {
            this.filters = Array.isArray(config.filters) ? [...config.filters] : [config.filters];
        }

        // Pass global timezone to root appenders without one
        this.applyTimezone(rootAppenders);

        // Apply logger-specific configurations
        if (this.config.loggers) {
            for (const [namespace, nodeConfig] of Object.entries(this.config.loggers)) {
                const logger = this.getLogger(namespace);
                if (nodeConfig.level !== undefined) {
                    logger.setLevel(nodeConfig.level);
                }
                if (nodeConfig.appenders !== undefined) {
                    logger.setAppenders(nodeConfig.appenders);
                    this.applyTimezone(nodeConfig.appenders);
                }
                if (nodeConfig.additivity !== undefined) {
                    logger.setAdditivity(nodeConfig.additivity);
                }
                if (nodeConfig.filters !== undefined) {
                    const nodeFilters = Array.isArray(nodeConfig.filters) ? [...nodeConfig.filters] : [nodeConfig.filters];
                    for (const f of nodeFilters) {
                        logger.addFilter(f);
                    }
                }
            }
        }
    }

    /**
     * Retrieves or creates a canonical Logger instance for a dot-delimited namespace.
     * Caches instances so LogManager.getLogger('a.b') returns the same instance.
     */
    public getLogger(namespace: string): Logger {
        if (!namespace || namespace === 'root') {
            return this.rootLogger;
        }

        const cached = this.loggers.get(namespace);
        if (cached) {
            return cached;
        }

        // Determine parent logger in hierarchy
        const lastDotIndex = namespace.lastIndexOf('.');
        let parent: Logger;
        if (lastDotIndex > 0) {
            const parentNamespace = namespace.slice(0, lastDotIndex);
            parent = this.getLogger(parentNamespace);
        } else {
            parent = this.rootLogger;
        }

        const nodeConfig = this.config.loggers?.[namespace];
        const logger = new Logger(this, namespace, {}, {
            parent,
            level: nodeConfig?.level,
            appenders: nodeConfig?.appenders ?? [],
            additivity: nodeConfig?.additivity ?? true,
            filters: nodeConfig?.filters,
        });

        if (nodeConfig?.appenders) {
            this.applyTimezone(nodeConfig.appenders);
        }

        this.loggers.set(namespace, logger);
        return logger;
    }

    /**
     * Dispatches a log entry through the appropriate logger hierarchy.
     */
    public dispatch(entry: LogEntry): void {
        // Global filter check
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
        }

        const logger = this.loggers.get(entry.namespace) || this.rootLogger;

        if (entry.level >= logger.getEffectiveLevel()) {
            if (entry.context) {
                Object.freeze(entry.context);
            }
            Object.freeze(entry);

            logger.dispatchToAppenders(entry);
        }
    }

    /**
     * Flushes all pending buffered log entries across all appenders in the hierarchy.
     */
    public async flush(): Promise<void> {
        const appenders = this.getAllAppenders();
        const flushPromises = appenders.map(async (appender) => {
            try {
                await appender.flush();
            } catch (e) {
                console.error(`[perfect-logger] Error flushing appender "${appender.name}":`, e);
            }
        });
        await Promise.allSettled(flushPromises);
    }

    /**
     * Flushes and destroys all appenders across the entire logger hierarchy.
     */
    public async shutdown(): Promise<void> {
        await this.flush();
        const appenders = this.getAllAppenders();
        for (const appender of appenders) {
            try {
                appender.destroy();
            } catch (e) {
                console.error(`[perfect-logger] Error destroying appender "${appender.name}":`, e);
            }
        }
        this.rootLogger.setAppenders([]);
        for (const logger of this.loggers.values()) {
            logger.setAppenders([]);
        }
        this.loggers.clear();
        this.config.appenders = [];
    }

    private getAllAppenders(): Appender[] {
        const set = new Set<Appender>();
        for (const appender of this.rootLogger.getAppenders()) {
            set.add(appender);
        }
        for (const logger of this.loggers.values()) {
            for (const appender of logger.getAppenders()) {
                set.add(appender);
            }
        }
        return Array.from(set);
    }

    private applyTimezone(appenders: Appender[]): void {
        if (!this.config.timezone) return;
        for (const appender of appenders) {
            if ('timezone' in appender) {
                const tzAppender = appender as { timezone?: string };
                if (!tzAppender.timezone) {
                    tzAppender.timezone = this.config.timezone;
                }
            }
        }
    }
}
