import { LogFormatter } from '../../src/utils/LogFormatter';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';

describe('LogFormatter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-10-28T14:30:05.123Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('formatDate()', () => {
        it('should format date as YYYY/MM/DD in UTC', () => {
            const formatter = new LogFormatter(undefined, 'UTC');
            expect(formatter.formatDate(new Date())).toBe('2023/10/28');
        });

        it('should respect timezone', () => {
            // 14:30 UTC on Oct 28 is still Oct 28 in New York (10:30 AM)
            const formatter = new LogFormatter(undefined, 'America/New_York');
            expect(formatter.formatDate(new Date())).toBe('2023/10/28');
        });
    });

    describe('formatTime()', () => {
        it('should format time with milliseconds in UTC', () => {
            const formatter = new LogFormatter(undefined, 'UTC');
            expect(formatter.formatTime(new Date())).toBe('14:30:05.123');
        });

        it('should respect timezone', () => {
            const formatter = new LogFormatter(undefined, 'America/New_York');
            // 14:30 UTC → 10:30 EDT
            expect(formatter.formatTime(new Date())).toBe('10:30:05.123');
        });
    });

    describe('formatLevel()', () => {
        it('should return string names for known levels', () => {
            const formatter = new LogFormatter();
            expect(formatter.formatLevel(LogLevel.TRACE)).toBe('TRACE');
            expect(formatter.formatLevel(LogLevel.DEBUG)).toBe('DEBUG');
            expect(formatter.formatLevel(LogLevel.INFO)).toBe('INFO');
            expect(formatter.formatLevel(LogLevel.WARN)).toBe('WARN');
            expect(formatter.formatLevel(LogLevel.ERROR)).toBe('ERROR');
            expect(formatter.formatLevel(LogLevel.FATAL)).toBe('FATAL');
        });

        it('should return UNKNOWN for unknown levels', () => {
            const formatter = new LogFormatter();
            expect(formatter.formatLevel(999 as LogLevel)).toBe('UNKNOWN');
        });
    });

    describe('format()', () => {
        it('should apply the default format template', () => {
            const formatter = new LogFormatter(undefined, 'UTC');
            const entry: LogEntry = {
                timestamp: new Date(),
                level: LogLevel.INFO,
                namespace: 'MyApp',
                message: 'hello world',
            };

            const result = formatter.format(entry);
            expect(result).toBe('2023/10/28 | 14:30:05.123 | INFO | MyApp | hello world');
        });

        it('should apply a custom format template', () => {
            const formatter = new LogFormatter('[{level}] {namespace}: {message}', 'UTC');
            const entry: LogEntry = {
                timestamp: new Date(),
                level: LogLevel.WARN,
                namespace: 'Svc',
                message: 'warning!',
            };

            expect(formatter.format(entry)).toBe('[WARN] Svc: warning!');
        });

        it('should inject context and error overrides', () => {
            const formatter = new LogFormatter('{message}{context}{error}', 'UTC');
            const entry: LogEntry = {
                timestamp: new Date(),
                level: LogLevel.ERROR,
                namespace: 'Test',
                message: 'fail',
            };

            const result = formatter.format(entry, {
                context: ' {"key":"val"}',
                error: '\nError: boom',
            });

            expect(result).toBe('fail {"key":"val"}\nError: boom');
        });

        it('should default context and error to empty strings', () => {
            const formatter = new LogFormatter('{message}{context}{error}', 'UTC');
            const entry: LogEntry = {
                timestamp: new Date(),
                level: LogLevel.INFO,
                namespace: 'Test',
                message: 'clean',
            };

            expect(formatter.format(entry)).toBe('clean');
        });
    });
});
