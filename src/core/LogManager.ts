import { LoggerConfig, LogEntry, Appender } from './types';
import { LogLevel } from '../constants';
import { Logger } from './Logger';
import { ConsoleAppender } from '../appenders/ConsoleAppender';
import { FileAppender } from '../appenders/FileAppender';

/**
 * The singleton LogManager class.
 * It holds the central configuration and dispatches log entries to the appenders.
 */
export class LogManager {
    private static instance: LogManager;
    private config: LoggerConfig;

    private constructor() {
        this.config = {
            minLevel: LogLevel.INFO,
            appenders: [],
            timezone: undefined,
        };
    }

    public static getInstance(): LogManager {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
        }
        return LogManager.instance;
    }

    /**
     * A convenience method to quickly configure the logger for a typical Node.js backend.
     * Includes a ConsoleAppender and a FileAppender with sensible defaults.
     * @param config Overrides for the default backend configuration.
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
     * @param config Overrides for the default backend configuration.
     */
    public static simpleFrontendConfig(config: Partial<LoggerConfig> = {}): void {
        const defaultConfig: LoggerConfig = {
            minLevel: LogLevel.INFO,
            appenders: [
                new ConsoleAppender()
            ],
        };
        LogManager.getInstance().configure({ ...defaultConfig, ...config });
    }

    /**
     * Configures the LogManager. This should be called once at application startup.
     * R6: Destroys existing appenders before replacing them to prevent orphaned timers.
     * @param config The configuration object.
     */
    public configure(config: Partial<LoggerConfig>): void {
        // R6: Clean up existing appenders before replacing them
        if (config.appenders && this.config.appenders.length > 0) {
            for (const appender of this.config.appenders) {
                try {
                    appender.destroy();
                } catch (e) {
                    // Ignore cleanup errors during reconfiguration
                }
            }
        }

        this.config = { ...this.config, ...config };

        // Pass the global timezone to appenders that don't have one
        this.config.appenders.forEach(appender => {
            if ('timezone' in appender && !(appender as any).timezone) {
                (appender as any).timezone = this.config.timezone;
            }
        });
    }

    /**
     * Creates a new Logger instance.
     * @param namespace The name of the logger.
     * @returns A new Logger.
     */
    public getLogger(namespace: string): Logger {
        return new Logger(this, namespace);
    }

    /**
     * Dispatches a log entry to all configured appenders.
     * B3: Each appender call is wrapped in try/catch to prevent unhandled rejections.
     * R3: The entry is frozen before dispatch to prevent mutation across appenders.
     * This is called by the Logger instances.
     * @param entry The log entry to dispatch.
     */
    public dispatch(entry: LogEntry): void {
        if (entry.level >= this.config.minLevel) {
            // R3: Freeze the entry to prevent mutation by one appender affecting others.
            // We freeze context separately since Object.freeze is shallow.
            if (entry.context) {
                Object.freeze(entry.context);
            }
            Object.freeze(entry);

            for (const appender of this.config.appenders) {
                try {
                    // B3: Catch both sync errors and unhandled promise rejections
                    const result = appender.log(entry);
                    if (result && typeof (result as any).catch === 'function') {
                        (result as Promise<void>).catch((e: unknown) => {
                            console.error(`[perfect-logger] Error in appender "${appender.name}":`, e);
                        });
                    }
                } catch (e) {
                    console.error(`[perfect-logger] Error in appender "${appender.name}":`, e);
                }
            }
        }
    }

    /**
     * R1: Flush all pending batched log entries across all appenders.
     * Call this before process exit to ensure no logs are lost.
     */
    public async flush(): Promise<void> {
        const flushPromises = this.config.appenders.map(async (appender) => {
            try {
                await appender.flush();
            } catch (e) {
                console.error(`[perfect-logger] Error flushing appender "${appender.name}":`, e);
            }
        });
        await Promise.allSettled(flushPromises);
    }

    /**
     * R1: Flush all appenders and then destroy them (clean up timers, file handles, etc.).
     * Call this during graceful application shutdown.
     */
    public async shutdown(): Promise<void> {
        await this.flush();
        for (const appender of this.config.appenders) {
            try {
                appender.destroy();
            } catch (e) {
                console.error(`[perfect-logger] Error destroying appender "${appender.name}":`, e);
            }
        }
        this.config.appenders = [];
    }
}
