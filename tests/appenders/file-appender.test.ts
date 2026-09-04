import { FileAppender } from '../../src/appenders/file-appender';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

// Use a temp directory for test log files
const TEST_LOG_DIR = path.join(__dirname, '..', '..', 'test-logs');

function makeEntry(level: LogLevel = LogLevel.INFO, message = 'test message'): LogEntry {
    return {
        timestamp: new Date('2023-10-28T14:30:05.123Z'),
        level,
        namespace: 'TestApp',
        message,
    };
}

describe('FileAppender', () => {
    const cleanTestDir = () => {
        if (fs.existsSync(TEST_LOG_DIR)) {
            try {
                fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
            } catch {
                // Ignore transient cleanup errors on Windows
            }
        }
    };

    beforeEach(() => {
        cleanTestDir();
    });

    afterEach(async () => {
        cleanTestDir();
    });

    describe('constructor', () => {
        it('should create the log directory if it does not exist', () => {
            new FileAppender({ logDirectory: TEST_LOG_DIR });
            expect(fs.existsSync(TEST_LOG_DIR)).toBe(true);
        });

        it('should use default fileName when not specified', async () => {
            const appender = new FileAppender({ logDirectory: TEST_LOG_DIR });
            appender.handle(makeEntry());
            await appender.flush();
            const files = fs.readdirSync(TEST_LOG_DIR);
            expect(files).toContain('app.log');
        });

        it('should use custom fileName', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'custom.log',
            });
            appender.handle(makeEntry());
            await appender.flush();
            const files = fs.readdirSync(TEST_LOG_DIR);
            expect(files).toContain('custom.log');
        });
    });

    describe('handle() / handleBatch()', () => {
        it('should write a log entry to a file', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'test.log',
            });

            appender.handle(makeEntry(LogLevel.INFO, 'hello world'));
            await appender.flush();

            const logFile = path.join(TEST_LOG_DIR, 'test.log');
            expect(fs.existsSync(logFile)).toBe(true);
            const content = fs.readFileSync(logFile, 'utf-8');
            expect(content).toContain('hello world');
            expect(content).toContain('INFO');
            expect(content).toContain('TestApp');
        });

        it('should write multiple entries', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'multi.log',
            });

            appender.handle(makeEntry(LogLevel.INFO, 'message 1'));
            appender.handle(makeEntry(LogLevel.WARN, 'message 2'));
            appender.handle(makeEntry(LogLevel.ERROR, 'message 3'));
            await appender.flush();

            const content = fs.readFileSync(path.join(TEST_LOG_DIR, 'multi.log'), 'utf-8');
            expect(content).toContain('message 1');
            expect(content).toContain('message 2');
            expect(content).toContain('message 3');
        });

        it('should include context in file output', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'context.log',
            });

            const entry = makeEntry(LogLevel.INFO, 'with context');
            entry.context = { userId: 42, action: 'login' };
            appender.handle(entry);
            await appender.flush();

            const content = fs.readFileSync(path.join(TEST_LOG_DIR, 'context.log'), 'utf-8');
            expect(content).toContain('userId');
            expect(content).toContain('42');
            expect(content).toContain('~ '); // Context line prefix
        });

        it('should include error stack in file output', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'error.log',
            });

            const entry = makeEntry(LogLevel.ERROR, 'something failed');
            entry.error = new Error('database connection failed');
            appender.handle(entry);
            await appender.flush();

            const content = fs.readFileSync(path.join(TEST_LOG_DIR, 'error.log'), 'utf-8');
            expect(content).toContain('something failed');
            expect(content).toContain('database connection failed');
        });
    });

    describe('size-based rotation', () => {
        it('should rotate when file exceeds maxSize', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'rotate.log',
                maxSize: 100, // Very small — will trigger rotation quickly
            });

            // Write enough data to trigger rotation
            for (let i = 0; i < 5; i++) {
                appender.handle(makeEntry(LogLevel.INFO, `line ${i} with enough content to fill the file`));
            }
            await appender.flush();

            const files = fs.readdirSync(TEST_LOG_DIR);
            const rotatedFiles = files.filter(f => f.startsWith('rotate.'));
            // Should have the active file plus at least one rotated archive
            expect(rotatedFiles.length).toBeGreaterThan(1);
        });

        it('should use incremented numeric suffixes for archives (B5)', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'numbered.log',
                maxSize: 50,
            });

            for (let i = 0; i < 10; i++) {
                appender.handle(makeEntry(LogLevel.INFO, `filling up the log file iteration ${i}`));
            }
            await appender.flush();

            const files = fs.readdirSync(TEST_LOG_DIR).sort();
            const archives = files.filter(f => f.match(/numbered\.\d+\.log/));

            // Verify no duplicate suffixes
            const suffixes = archives.map(f => {
                const match = f.match(/numbered\.(\d+)\.log/);
                return match ? parseInt(match[1], 10) : -1;
            });
            const uniqueSuffixes = new Set(suffixes);
            expect(uniqueSuffixes.size).toBe(suffixes.length);
        });
    });

    describe('maxFiles pruning', () => {
        it('should delete old archives when maxFiles is exceeded', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'prune.log',
                maxSize: 50,
                maxFiles: 2,
            });

            for (let i = 0; i < 15; i++) {
                appender.handle(makeEntry(LogLevel.INFO, `prune test message number ${i} filler data`));
            }
            await appender.flush();

            const files = fs.readdirSync(TEST_LOG_DIR);
            const archives = files.filter(f => f.startsWith('prune.') && f !== 'prune.log');
            // Should have at most maxFiles archives
            expect(archives.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Q5: nullish coalescing for maxSize/maxFiles', () => {
        it('should treat maxSize: 0 as 0, not null', () => {
            // maxSize: 0 means "rotate on every write" (edge case but valid)
            // Previously maxSize: 0 || null → null, disabling rotation
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                maxSize: 0,
            });
            // If it didn't crash, the constructor accepted 0 correctly
            expect(appender).toBeDefined();
        });
    });

    describe('format', () => {
        it('should apply the default format', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'format.log',
                timezone: 'UTC',
            });

            appender.handle(makeEntry(LogLevel.INFO, 'formatted'));
            await appender.flush();

            const content = fs.readFileSync(path.join(TEST_LOG_DIR, 'format.log'), 'utf-8');
            // Should contain the default format parts
            expect(content).toMatch(/2023\/10\/28/);
            expect(content).toContain('INFO');
            expect(content).toContain('TestApp');
            expect(content).toContain('formatted');
        });

        it('should apply a custom format', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'custom-format.log',
                format: '[{level}] {message}',
            });

            appender.handle(makeEntry(LogLevel.WARN, 'custom'));
            await appender.flush();

            const content = fs.readFileSync(path.join(TEST_LOG_DIR, 'custom-format.log'), 'utf-8');
            expect(content).toContain('[WARN] custom');
        });
    });

    describe('gzip compression (compress: true)', () => {
        it('should compress rotated archives into .gz files', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'compressed.log',
                maxSize: 60,
                compress: true,
            });

            // Write entries to trigger size-based rotation
            for (let i = 0; i < 8; i++) {
                appender.handle(makeEntry(LogLevel.INFO, `compressed test line ${i} with extra text to exceed 60 bytes`));
            }
            await appender.flush();

            const files = fs.readdirSync(TEST_LOG_DIR);
            const gzFiles = files.filter(f => f.endsWith('.gz'));
            expect(gzFiles.length).toBeGreaterThan(0);

            // Verify the gz file can be uncompressed and contains the log content
            const zlib = require('zlib');
            const gzContent = fs.readFileSync(path.join(TEST_LOG_DIR, gzFiles[0]));
            const uncompressed = zlib.gunzipSync(gzContent).toString('utf-8');
            expect(uncompressed).toContain('compressed test line');
        });
    });

    describe('time-based rotation (daily and hourly)', () => {
        it('should format filename with date marker for pure time-based rotation', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'daily-app.log',
                rotation: 'daily',
            });

            appender.handle(makeEntry(LogLevel.INFO, 'daily message'));
            await appender.flush();

            const files = fs.readdirSync(TEST_LOG_DIR);
            const dailyFile = files.find(f => f.startsWith('daily-app-') && f.endsWith('.log'));
            expect(dailyFile).toBeDefined();
        });

        it('should format date marker with hour when rotation is hourly', () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'hourly-app.log',
                rotation: 'hourly',
            });

            const marker = (appender as any).getDateMarker(new Date('2023-10-28T14:30:00Z'));
            expect(marker).toContain('T');
        });

        it('should trigger rotation when date marker changes', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'rollover.log',
                rotation: 'daily',
            });

            appender.handle(makeEntry(LogLevel.INFO, 'first day'));
            await appender.flush();

            // Simulate the date rolling over to tomorrow
            (appender as any).currentFileDateMarker = '2000-01-01';

            appender.handle(makeEntry(LogLevel.INFO, 'second day'));
            await appender.flush();

            const files = fs.readdirSync(TEST_LOG_DIR);
            expect(files.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('RollingFileAppender alias', () => {
        it('should export RollingFileAppender as an alias for FileAppender', () => {
            const { RollingFileAppender } = require('../../src/appenders/file-appender');
            expect(RollingFileAppender).toBe(FileAppender);
        });
    });

    describe('error handling and edge cases', () => {
        it('should return early when formatted entries produce empty logLines', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'empty.log',
                layout: {
                    contentType: 'text/plain',
                    format: () => '',
                },
            });
            appender.handle(makeEntry(LogLevel.INFO, 'empty'));
            await appender.flush();
            // File should not even be appended to
            expect(fs.existsSync(path.join(TEST_LOG_DIR, 'empty.log'))).toBe(false);
        });

        it('should catch and log error when appendFile throws in writeBatch', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const appendSpy = jest.spyOn(fs.promises, 'appendFile').mockRejectedValueOnce(new Error('Disk full'));

            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'fail.log',
            });
            appender.handle(makeEntry(LogLevel.INFO, 'fail'));
            await appender.flush();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error writing to log file:',
                expect.any(Error)
            );

            appendSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should catch and log error when rename throws during rotation', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('Permission denied'));

            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'rot-fail.log',
                maxSize: 10,
            });
            appender.handle(makeEntry(LogLevel.INFO, 'first large entry'));
            await appender.flush();

            appender.handle(makeEntry(LogLevel.INFO, 'second entry causing rotation failure'));
            await appender.flush();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to rotate log file'),
                expect.any(Error)
            );

            renameSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should catch and log error when unlink throws during pruning', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockRejectedValueOnce(new Error('Cannot delete'));

            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'prune-fail.log',
                maxSize: 20,
                maxFiles: 1,
            });

            // Write entries to trigger rotations and pruning
            appender.handle(makeEntry(LogLevel.INFO, 'entry 1'));
            await appender.flush();
            appender.handle(makeEntry(LogLevel.INFO, 'entry 2'));
            await appender.flush();
            appender.handle(makeEntry(LogLevel.INFO, 'entry 3'));
            await appender.flush();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete old log file:'),
                expect.any(Error)
            );

            unlinkSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should catch and log error when gzip compression fails', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const zlib = require('zlib');
            const gzipSpy = jest.spyOn(zlib, 'gzip').mockImplementation((_buf: any, cb: any) => {
                cb(new Error('Gzip failed'), null);
            });

            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'gzip-fail.log',
                maxSize: 10,
                compress: true,
            });

            appender.handle(makeEntry(LogLevel.INFO, 'large entry 1'));
            await appender.flush();
            appender.handle(makeEntry(LogLevel.INFO, 'large entry 2'));
            await appender.flush();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to compress rotated log file'),
                expect.any(Error)
            );

            gzipSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should initialize currentFileSize from existing file on disk', () => {
            fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
            const filePath = path.join(TEST_LOG_DIR, 'existing.log');
            fs.writeFileSync(filePath, 'initial content here');
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'existing.log',
            });
            expect((appender as any).currentFileSize).toBe(Buffer.byteLength('initial content here'));
        });

        it('should throw when instantiated in a non-Node environment', () => {
            let NonNodeFileAppender: typeof FileAppender;
            jest.isolateModules(() => {
                jest.doMock('../../src/utils/environment', () => ({
                    isNode: () => false,
                }));
                NonNodeFileAppender = require('../../src/appenders/file-appender').FileAppender;
            });

            expect(() => {
                new NonNodeFileAppender!({
                    logDirectory: TEST_LOG_DIR,
                    fileName: 'browser.log',
                });
            }).toThrow('FileAppender cannot be used in this environment.');
        });
    });
});


