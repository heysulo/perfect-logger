import { ConfigLoader, DeclarativeConfig } from '../../src/config/config-loader';
import { LogLevel } from '../../src/constants';
import { LogManager } from '../../src/core/log-manager';
import { ConsoleAppender } from '../../src/appenders/console-appender';
import { StreamAppender } from '../../src/appenders/stream-appender';
import { FileAppender } from '../../src/appenders/file-appender';
import { HttpAppender } from '../../src/appenders/http-appender';
import { AsyncAppender } from '../../src/appenders/async-appender';
import * as fs from 'fs';
import * as path from 'path';

const TEST_CONFIG_DIR = path.join(__dirname, '..', '..', 'test-config-dir');

describe('ConfigLoader', () => {
    const originalEnv = process.env;

    const cleanConfigDir = () => {
        if (fs.existsSync(TEST_CONFIG_DIR)) {
            try {
                fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
            } catch {
                // Ignore transient cleanup errors on Windows
            }
        }
    };

    beforeEach(() => {
        process.env = { ...originalEnv };
        cleanConfigDir();
    });

    afterEach(() => {
        process.env = originalEnv;
        cleanConfigDir();
    });

    describe('interpolateEnvVariables', () => {
        it('should interpolate defined environment variables', () => {
            process.env.APP_NAME = 'MyAwesomeApp';
            const input = {
                app: '${env:APP_NAME}',
                unmodified: 'static-value',
            };

            const result = ConfigLoader.interpolateEnvVariables(input);
            expect(result.app).toBe('MyAwesomeApp');
            expect(result.unmodified).toBe('static-value');
        });

        it('should use default values when env var is undefined', () => {
            delete process.env.NON_EXISTENT_VAR;
            const input = {
                val: '${env:NON_EXISTENT_VAR:-fallback_value}',
            };

            const result = ConfigLoader.interpolateEnvVariables(input);
            expect(result.val).toBe('fallback_value');
        });

        it('should use empty string if env var is undefined and no default provided', () => {
            delete process.env.NON_EXISTENT_VAR;
            const input = '${env:NON_EXISTENT_VAR}';
            const result = ConfigLoader.interpolateEnvVariables(input);
            expect(result).toBe('');
        });

        it('should handle nested arrays and objects', () => {
            process.env.VAR1 = 'val1';
            process.env.VAR2 = 'val2';
            const input = {
                list: ['${env:VAR1}', { nested: '${env:VAR2}' }],
            };

            const result = ConfigLoader.interpolateEnvVariables(input);
            expect(result.list[0]).toBe('val1');
            expect((result.list[1] as { nested: string }).nested).toBe('val2');
        });
    });

    describe('parseConfig', () => {
        it('should parse declarative config with appenders, root and logger nodes', () => {
            process.env.LOG_LEVEL = 'DEBUG';

            const declarative: DeclarativeConfig = {
                appenders: {
                    console: {
                        type: 'Console',
                        minLevel: '${env:LOG_LEVEL:-INFO}',
                        layout: {
                            type: 'Pattern',
                            pattern: '%p [%c] %m',
                        },
                    },
                    streamOut: {
                        type: 'Stream',
                        minLevel: 'INFO',
                        layout: {
                            type: 'Json',
                            pretty: false,
                        },
                    },
                    file: {
                        type: 'File',
                        fileName: 'app.log',
                        rotation: 'daily',
                        compress: true,
                    },
                    http: {
                        type: 'Http',
                        url: 'http://localhost:8080/logs',
                    },
                    asyncConsole: {
                        type: 'Async',
                        appender: 'console',
                        queueSize: 500,
                    },
                },
                root: {
                    level: 'INFO',
                    appenders: ['asyncConsole', 'file'],
                },
                loggers: {
                    'com.example.db': {
                        level: 'TRACE',
                        appenders: ['console'],
                        additivity: false,
                    },
                },
            };

            const parsed = ConfigLoader.parseConfig(declarative);

            expect(parsed.root).toBeDefined();
            expect(parsed.root?.level).toBe(LogLevel.INFO);
            expect(parsed.root?.appenders?.length).toBe(2);
            expect(parsed.root?.appenders?.[0]).toBeInstanceOf(AsyncAppender);
            expect(parsed.root?.appenders?.[1]).toBeInstanceOf(FileAppender);

            expect(parsed.loggers?.['com.example.db']).toBeDefined();
            expect(parsed.loggers?.['com.example.db'].level).toBe(LogLevel.TRACE);
            expect(parsed.loggers?.['com.example.db'].additivity).toBe(false);
            expect(parsed.loggers?.['com.example.db'].appenders?.[0]).toBeInstanceOf(ConsoleAppender);
        });

        it('should throw when AsyncAppender references unknown target', () => {
            const declarative: DeclarativeConfig = {
                appenders: {
                    asyncBad: {
                        type: 'Async',
                        appender: 'doesNotExist',
                    },
                },
            };

            expect(() => {
                ConfigLoader.parseConfig(declarative);
            }).toThrow('AsyncAppender "asyncBad" references unknown target appender "doesNotExist".');
        });
    });

    describe('getDefaultConfig', () => {
        it('should return ConsoleAppender in development mode', () => {
            process.env.NODE_ENV = 'development';
            const config = ConfigLoader.getDefaultConfig();

            expect(config.appenders?.length).toBe(1);
            expect(config.appenders?.[0]).toBeInstanceOf(ConsoleAppender);
        });

        it('should return StreamAppender with JsonLayout in production mode', () => {
            process.env.NODE_ENV = 'production';
            const config = ConfigLoader.getDefaultConfig();

            expect(config.appenders?.length).toBe(1);
            expect(config.appenders?.[0]).toBeInstanceOf(StreamAppender);
            expect((config.appenders?.[0] as StreamAppender).layout.contentType).toBe('application/json');
        });
    });

    describe('loadConfigFile', () => {
        it('should load logger.config.json if it exists', () => {
            fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            const jsonPath = path.join(TEST_CONFIG_DIR, 'logger.config.json');
            fs.writeFileSync(jsonPath, JSON.stringify({
                root: { level: 'WARN' },
            }));

            const config = ConfigLoader.loadConfigFile(TEST_CONFIG_DIR);
            expect(config).toBeDefined();
            expect(config?.root?.level).toBe('WARN');
        });

        it('should load logger.config.js if it exists', () => {
            fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            const jsPath = path.join(TEST_CONFIG_DIR, 'logger.config.js');
            fs.writeFileSync(jsPath, 'module.exports = { root: { level: "DEBUG" } };');

            const config = ConfigLoader.loadConfigFile(TEST_CONFIG_DIR);
            expect(config).toBeDefined();
            expect(config?.root?.level).toBe('DEBUG');

            try {
                delete require.cache[require.resolve(jsPath)];
            } catch {
                // Ignore
            }
        });

        it('should return null if no config file exists', () => {
            fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            const config = ConfigLoader.loadConfigFile(TEST_CONFIG_DIR);
            expect(config).toBeNull();
        });

        it('should return null and log error when config file contains invalid JSON', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            const jsonPath = path.join(TEST_CONFIG_DIR, 'logger.config.json');
            fs.writeFileSync(jsonPath, '{ invalid json syntax !!!');

            const config = ConfigLoader.loadConfigFile(TEST_CONFIG_DIR);
            expect(config).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[perfect-logger] Failed to load config file:'),
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });

        it('should return null when simulated in non-node environment', () => {
            const envModule = require('../../src/utils/environment');
            const originalIsNode = envModule.isNode;
            jest.spyOn(envModule, 'isNode').mockReturnValue(false);

            const config = ConfigLoader.loadConfigFile(TEST_CONFIG_DIR);
            expect(config).toBeNull();

            envModule.isNode = originalIsNode;
        });

        it('should resolve numeric level and fallback unknown appender type to Console', () => {
            const parsed = ConfigLoader.parseConfig({
                appenders: {
                    unknownType: {
                        type: 'CustomNonExistent' as any,
                        minLevel: LogLevel.DEBUG, // Numeric level
                    },
                },
                root: {
                    level: LogLevel.WARN,
                    appenders: ['unknownType'],
                },
            });

            expect(parsed.root?.appenders?.[0]).toBeInstanceOf(ConsoleAppender);
            expect(parsed.root?.level).toBe(LogLevel.WARN);
        });

        it('should handle config without root section and loggers without explicit level', () => {
            const parsed = ConfigLoader.parseConfig({
                appenders: {
                    httpApp: {
                        type: 'Http',
                        // url omitted: defaults to http://localhost
                    },
                },
                loggers: {
                    'no.level': {
                        appenders: ['httpApp'],
                    },
                },
            });
            expect(parsed.root?.level).toBe(LogLevel.INFO);
            expect(parsed.loggers?.['no.level'].level).toBeUndefined();
            expect(parsed.loggers?.['no.level'].appenders?.[0]).toBeInstanceOf(HttpAppender);
        });

        it('should call loadConfigFile with default directory argument', () => {
            const config = ConfigLoader.loadConfigFile();
            expect(config === null || typeof config === 'object').toBe(true);
        });

        it('should throw when Async appender is missing target appender name', () => {
            expect(() => {
                ConfigLoader.parseConfig({
                    appenders: {
                        asyncApp: {
                            type: 'Async',
                        } as any,
                    },
                });
            }).toThrow('AsyncAppender "asyncApp" references unknown target appender "undefined".');
        });
    });

    describe('LogManager.autoConfigure', () => {
        it('should auto-configure from default config when no config file exists', () => {
            fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            process.env.NODE_ENV = 'development';

            LogManager.autoConfigure(TEST_CONFIG_DIR);

            const root = LogManager.getRootLogger();
            expect(root.getEffectiveLevel()).toBe(LogLevel.INFO);
            expect(root.getAppenders()[0]).toBeInstanceOf(ConsoleAppender);
        });

        it('should auto-configure from file if present in directory', () => {
            fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
            const jsonPath = path.join(TEST_CONFIG_DIR, 'logger.config.json');
            fs.writeFileSync(jsonPath, JSON.stringify({
                root: { level: 'ERROR' },
            }));

            LogManager.autoConfigure(TEST_CONFIG_DIR);

            const root = LogManager.getRootLogger();
            expect(root.getEffectiveLevel()).toBe(LogLevel.ERROR);
        });
    });
});
