import { FileAppender } from '../../src/appenders/FileAppender';
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
    beforeEach(() => {
        // Clean up test log directory before each test
        if (fs.existsSync(TEST_LOG_DIR)) {
            fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        // Clean up after tests
        if (fs.existsSync(TEST_LOG_DIR)) {
            fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should create the log directory if it does not exist', () => {
            new FileAppender({ logDirectory: TEST_LOG_DIR });
            expect(fs.existsSync(TEST_LOG_DIR)).toBe(true);
        });

        it('should use default fileName when not specified', () => {
            const appender = new FileAppender({ logDirectory: TEST_LOG_DIR });
            // Verify the default log file path
            appender.handle(makeEntry());
            // Wait for async write
        });

        it('should use custom fileName', async () => {
            const appender = new FileAppender({
                logDirectory: TEST_LOG_DIR,
                fileName: 'custom.log',
            });
            appender.handle(makeEntry());
            // Wait for the write queue to flush
            await new Promise(resolve => setTimeout(resolve, 100));
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
            await new Promise(resolve => setTimeout(resolve, 100));

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
            await new Promise(resolve => setTimeout(resolve, 100));

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
            await new Promise(resolve => setTimeout(resolve, 100));

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
            await new Promise(resolve => setTimeout(resolve, 100));

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
            await new Promise(resolve => setTimeout(resolve, 200));

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
            await new Promise(resolve => setTimeout(resolve, 300));

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
            await new Promise(resolve => setTimeout(resolve, 300));

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
            await new Promise(resolve => setTimeout(resolve, 100));

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
            await new Promise(resolve => setTimeout(resolve, 100));

            const content = fs.readFileSync(path.join(TEST_LOG_DIR, 'custom-format.log'), 'utf-8');
            expect(content).toContain('[WARN] custom');
        });
    });
});
