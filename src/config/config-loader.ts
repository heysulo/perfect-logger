import { LoggerConfig, LoggerNodeConfig, Appender } from '../core/types';
import { LogLevel } from '../constants';
import { ConsoleAppender } from '../appenders/console-appender';
import { FileAppender } from '../appenders/file-appender';
import { StreamAppender } from '../appenders/stream-appender';
import { HttpAppender } from '../appenders/http-appender';
import { AsyncAppender } from '../appenders/async-appender';
import { Layout } from '../layouts/layout';
import { PatternLayout } from '../layouts/pattern-layout';
import { JsonLayout } from '../layouts/json-layout';
import { isNode } from '../utils/environment';
import type * as fs from 'fs';
import type * as path from 'path';

export interface DeclarativeLayoutConfig {
    type: 'Pattern' | 'Json';
    pattern?: string;
    timezone?: string;
    pretty?: boolean;
    timestampFormat?: 'iso' | 'epoch';
    fieldNames?: Record<string, string>;
}

export interface DeclarativeAppenderConfig {
    type: 'Console' | 'File' | 'RollingFile' | 'Stream' | 'Http' | 'Async';
    minLevel?: string | LogLevel;
    layout?: DeclarativeLayoutConfig;
    logDirectory?: string;
    fileName?: string;
    rotation?: 'daily' | 'hourly';
    maxSize?: number;
    maxFiles?: number;
    compress?: boolean;
    url?: string;
    headers?: Record<string, string>;
    method?: 'POST' | 'PUT';
    appender?: string; // For AsyncAppender reference
    queueSize?: number;
    overflowPolicy?: 'DISCARD' | 'DISCARD_OLDEST' | 'BLOCK';
}

export interface DeclarativeConfig {
    appenders?: Record<string, DeclarativeAppenderConfig>;
    root?: {
        level?: string | LogLevel;
        appenders?: string[];
    };
    loggers?: Record<string, {
        level?: string | LogLevel;
        appenders?: string[];
        additivity?: boolean;
    }>;
    timezone?: string;
}

export class ConfigLoader {
    /**
     * Parses a declarative configuration object, instantiating layouts and appenders,
     * resolving ${env:VAR} interpolations and string log levels.
     */
    public static parseConfig(rawConfig: DeclarativeConfig): LoggerConfig {
        const interpolated = this.interpolateEnvVariables(rawConfig) as DeclarativeConfig;

        // 1. Build appenders map
        const builtAppenders = new Map<string, Appender>();
        const appendersConfig = interpolated.appenders || {};

        // First pass: build non-Async appenders
        for (const [name, cfg] of Object.entries(appendersConfig)) {
            if (cfg.type !== 'Async') {
                builtAppenders.set(name, this.createAppender(name, cfg));
            }
        }

        // Second pass: build Async appenders that reference existing ones
        for (const [name, cfg] of Object.entries(appendersConfig)) {
            if (cfg.type === 'Async') {
                const targetName = cfg.appender;
                const target = targetName ? builtAppenders.get(targetName) : undefined;
                if (!target) {
                    throw new Error(`AsyncAppender "${name}" references unknown target appender "${targetName}".`);
                }
                const asyncAppender = new AsyncAppender({
                    appender: target,
                    queueSize: cfg.queueSize,
                    overflowPolicy: cfg.overflowPolicy,
                    minLevel: this.resolveLevel(cfg.minLevel),
                });
                builtAppenders.set(name, asyncAppender);
            }
        }

        // 2. Build root logger node config
        const rootAppenders: Appender[] = [];
        if (interpolated.root?.appenders) {
            for (const appenderName of interpolated.root.appenders) {
                const app = builtAppenders.get(appenderName);
                if (app) rootAppenders.push(app);
            }
        }

        const rootConfig: LoggerNodeConfig = {
            level: this.resolveLevel(interpolated.root?.level, LogLevel.INFO),
            appenders: rootAppenders,
        };

        // 3. Build hierarchical loggers config
        const loggersConfig: Record<string, LoggerNodeConfig> = {};
        if (interpolated.loggers) {
            for (const [ns, node] of Object.entries(interpolated.loggers)) {
                const nodeAppenders: Appender[] = [];
                if (node.appenders) {
                    for (const appenderName of node.appenders) {
                        const app = builtAppenders.get(appenderName);
                        if (app) nodeAppenders.push(app);
                    }
                }
                loggersConfig[ns] = {
                    level: node.level ? this.resolveLevel(node.level) : undefined,
                    appenders: nodeAppenders,
                    additivity: node.additivity ?? true,
                };
            }
        }

        return {
            minLevel: rootConfig.level,
            appenders: rootAppenders,
            root: rootConfig,
            loggers: loggersConfig,
            timezone: interpolated.timezone,
        };
    }

    /**
     * Creates environment-sensing default configuration.
     * In production (NODE_ENV === 'production'): High-performance JsonLayout on StreamAppender.
     * In development / test: PatternLayout on ConsoleAppender.
     */
    public static getDefaultConfig(): LoggerConfig {
        const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';

        if (isProd) {
            const streamAppender = new StreamAppender({
                minLevel: LogLevel.INFO,
                layout: new JsonLayout(),
            });
            return {
                minLevel: LogLevel.INFO,
                appenders: [streamAppender],
                root: { level: LogLevel.INFO, appenders: [streamAppender] },
            };
        }

        const consoleAppender = new ConsoleAppender({
            minLevel: LogLevel.INFO,
            layout: new PatternLayout(),
        });
        return {
            minLevel: LogLevel.INFO,
            appenders: [consoleAppender],
            root: { level: LogLevel.INFO, appenders: [consoleAppender] },
        };
    }

    /**
     * Attempts to find and load logger.config.json or logger.config.js from project directory.
     */
    public static loadConfigFile(directory: string = (typeof process !== 'undefined' ? process.cwd() : '')): DeclarativeConfig | null {
        if (!isNode() || typeof process === 'undefined') {
            return null;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fsModule: typeof fs = require('fs');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pathModule: typeof path = require('path');

            const jsonPath = pathModule.join(directory, 'logger.config.json');
            if (fsModule.existsSync(jsonPath)) {
                const content = fsModule.readFileSync(jsonPath, 'utf-8');
                return JSON.parse(content);
            }

            const jsPath = pathModule.join(directory, 'logger.config.js');
            if (fsModule.existsSync(jsPath)) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const jsConfig = require(jsPath);
                return jsConfig.default || jsConfig;
            }
        } catch (e) {
            console.error('[perfect-logger] Failed to load config file:', e);
        }

        return null;
    }

    /**
     * Recursively resolves ${env:VAR_NAME} or ${env:VAR_NAME:-default} strings.
     */
    public static interpolateEnvVariables<T = unknown>(obj: T): T {
        if (typeof obj === 'string') {
            return obj.replace(/\$\{env:([A-Za-z0-9_]+)(?::-([^}]*))?\}/g, (_, varName, defaultValue) => {
                if (typeof process !== 'undefined' && process.env) {
                    const envVal = process.env[varName];
                    if (envVal !== undefined) {
                        return envVal;
                    }
                }
                return defaultValue !== undefined ? defaultValue : '';
            }) as unknown as T;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.interpolateEnvVariables(item)) as unknown as T;
        }
        if (typeof obj === 'object' && obj !== null) {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.interpolateEnvVariables(value);
            }
            return result as unknown as T;
        }
        return obj;
    }

    private static createAppender(_name: string, cfg: DeclarativeAppenderConfig): Appender {
        const layout = cfg.layout ? this.createLayout(cfg.layout) : undefined;
        const minLevel = this.resolveLevel(cfg.minLevel);

        switch (cfg.type) {
            case 'Console':
                return new ConsoleAppender({ minLevel, layout });
            case 'File':
            case 'RollingFile':
                return new FileAppender({
                    minLevel,
                    layout,
                    logDirectory: cfg.logDirectory,
                    fileName: cfg.fileName,
                    rotation: cfg.rotation,
                    maxSize: cfg.maxSize,
                    maxFiles: cfg.maxFiles,
                    compress: cfg.compress,
                });
            case 'Stream':
                return new StreamAppender({ minLevel, layout });
            case 'Http':
                return new HttpAppender({
                    url: cfg.url || 'http://localhost',
                    minLevel,
                    layout,
                    headers: cfg.headers,
                    method: cfg.method,
                });
            default:
                return new ConsoleAppender({ minLevel, layout });
        }
    }

    private static createLayout(cfg: DeclarativeLayoutConfig): Layout {
        if (cfg.type === 'Json') {
            return new JsonLayout({
                pretty: cfg.pretty,
                timestampFormat: cfg.timestampFormat,
                fieldNames: cfg.fieldNames,
            });
        }
        return new PatternLayout({
            pattern: cfg.pattern,
            timezone: cfg.timezone,
        });
    }

    private static resolveLevel(level?: string | LogLevel, defaultLevel: LogLevel = LogLevel.INFO): LogLevel {
        if (typeof level === 'number') {
            return level;
        }
        if (typeof level === 'string') {
            const upper = level.toUpperCase();
            if (upper in LogLevel) {
                return (LogLevel as unknown as Record<string, LogLevel>)[upper];
            }
        }
        return defaultLevel;
    }
}
