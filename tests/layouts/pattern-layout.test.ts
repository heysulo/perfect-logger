import { PatternLayout } from '../../src/layouts/pattern-layout';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';

describe('PatternLayout', () => {
    const baseEntry: LogEntry = {
        timestamp: new Date('2026-09-05T12:30:45.678Z'),
        level: LogLevel.INFO,
        namespace: 'services.auth.token',
        message: 'Token generated successfully',
    };

    it('should format with default pattern', () => {
        const layout = new PatternLayout({ timezone: 'UTC' });
        const result = layout.format(baseEntry);
        expect(result).toBe('2026/09/05 | 12:30:45.678 | INFO | services.auth.token | Token generated successfully');
    });

    it('should support ISO8601 in %d{ISO8601}', () => {
        const layout = new PatternLayout({ pattern: '[%d{ISO8601}] [%p] %c: %m' });
        const result = layout.format(baseEntry);
        expect(result).toBe('[2026-09-05T12:30:45.678Z] [INFO] services.auth.token: Token generated successfully');
    });

    it('should support custom date pattern %d{YYYY-MM-DD}', () => {
        const layout = new PatternLayout({ pattern: '%d{YYYY-MM-DD} - %m', timezone: 'UTC' });
        const result = layout.format(baseEntry);
        expect(result).toBe('2026-09-05 - Token generated successfully');
    });

    it('should support truncated category %c{1} and %c{2}', () => {
        const layout1 = new PatternLayout({ pattern: '%c{1} - %m' });
        expect(layout1.format(baseEntry)).toBe('token - Token generated successfully');

        const layout2 = new PatternLayout({ pattern: '%c{2} - %m' });
        expect(layout2.format(baseEntry)).toBe('auth.token - Token generated successfully');
    });

    it('should support %X{key} for context values', () => {
        const entry: LogEntry = {
            ...baseEntry,
            context: { userId: 'u123', orgId: 456 },
        };
        const layout = new PatternLayout({ pattern: '[user=%X{userId}] [org=%X{orgId}] %m' });
        expect(layout.format(entry)).toBe('[user=u123] [org=456] Token generated successfully');
    });

    it('should append error stack when error is present and alwaysAppendError is true', () => {
        const error = new Error('Database down');
        const entry: LogEntry = {
            ...baseEntry,
            level: LogLevel.ERROR,
            error,
        };
        const layout = new PatternLayout({ pattern: '[%p] %m' });
        const result = layout.format(entry);
        expect(result).toContain('[ERROR] Token generated successfully');
        expect(result).toContain('Error: Database down');
    });

    it('should support %ex explicitly in pattern', () => {
        const error = new Error('Validation failed');
        error.stack = 'Error: Validation failed\n  at check (/app.js:10)';
        const entry: LogEntry = {
            ...baseEntry,
            error,
        };
        const layout = new PatternLayout({ pattern: '%m | Error: %ex' });
        const result = layout.format(entry);
        expect(result).toBe('Token generated successfully | Error: Error: Validation failed\n  at check (/app.js:10)');
    });

    it('should support legacy tokens {date}, {time}, {level}, {namespace}, {message}', () => {
        const layout = new PatternLayout({
            pattern: '{date} - {time} [{level}] {namespace} - {message}',
            timezone: 'UTC',
        });
        const result = layout.format(baseEntry);
        expect(result).toBe('2026/09/05 - 12:30:45.678 [INFO] services.auth.token - Token generated successfully');
    });

    it('should support %d{date}, %d{time}, and %d{DEFAULT}', () => {
        const layoutDate = new PatternLayout({ pattern: '%d{date} %m', timezone: 'UTC' });
        expect(layoutDate.format(baseEntry)).toBe('2026/09/05 Token generated successfully');

        const layoutTime = new PatternLayout({ pattern: '%d{time} %m', timezone: 'UTC' });
        expect(layoutTime.format(baseEntry)).toBe('12:30:45.678 Token generated successfully');

        const layoutDefault = new PatternLayout({ pattern: '%d{DEFAULT} %m', timezone: 'UTC' });
        expect(layoutDefault.format(baseEntry)).toBe('2026/09/05 12:30:45.678 Token generated successfully');
    });

    it('should return empty string for non-existent %X{missingKey}', () => {
        const layout = new PatternLayout({ pattern: 'Key=[%X{notHere}] %m' });
        expect(layout.format(baseEntry)).toBe('Key=[] Token generated successfully');
    });

    it('should automatically append context when alwaysAppendContext is true and %X is absent', () => {
        const layout = new PatternLayout({
            pattern: '[%p] %m',
            alwaysAppendContext: true,
        });
        const entry: LogEntry = {
            ...baseEntry,
            context: { requestId: 'req-42' },
        };
        expect(layout.format(entry)).toBe('[INFO] Token generated successfully {"requestId":"req-42"}');
    });

    it('should support %throwable and handle error without stack', () => {
        const errorWithoutStack = new Error('No stack error');
        delete (errorWithoutStack as any).stack;

        const layout = new PatternLayout({ pattern: '%m | %throwable' });
        const entry: LogEntry = {
            ...baseEntry,
            error: errorWithoutStack,
        };
        expect(layout.format(entry)).toBe('Token generated successfully | No stack error');
    });

    it('should support %marker and %markerSimpleName with and without marker', () => {
        const { MarkerManager } = require('../../src/core/marker');
        const layout = new PatternLayout({ pattern: '%marker - %markerSimpleName - %m' });
        const marker = MarkerManager.getMarker('CHILD', MarkerManager.getMarker('PARENT'));
        const entryWithMarker: LogEntry = {
            ...baseEntry,
            marker,
        };
        expect(layout.format(entryWithMarker)).toBe('CHILD [ PARENT ] - CHILD - Token generated successfully');
        expect(layout.format(baseEntry)).toBe(' -  - Token generated successfully');
    });

    it('should format object context values with safeStringify in %X{key}', () => {
        const layout = new PatternLayout({ pattern: 'User=%X{user} %m' });
        const entry: LogEntry = {
            ...baseEntry,
            context: { user: { id: 123, role: 'admin' } },
        };
        expect(layout.format(entry)).toBe('User={"id":123,"role":"admin"} Token generated successfully');
    });

    it('should support %X and {context} placeholders with and without context', () => {
        const layoutX = new PatternLayout({ pattern: '%m%X' });
        const layoutCtx = new PatternLayout({ pattern: '%m{context}' });
        const entry: LogEntry = {
            ...baseEntry,
            context: { traceId: 'abc' },
        };
        expect(layoutX.format(entry)).toBe('Token generated successfully {"traceId":"abc"}');
        expect(layoutCtx.format(entry)).toBe('Token generated successfully {"traceId":"abc"}');
        expect(layoutX.format(baseEntry)).toBe('Token generated successfully');
    });

    it('should support {error} placeholder with and without error', () => {
        const layout = new PatternLayout({ pattern: '%m{error}' });
        expect(layout.format(baseEntry)).toBe('Token generated successfully');
        const err = new Error('Failure');
        err.stack = 'Failure at test.js:1';
        expect(layout.format({ ...baseEntry, error: err })).toBe('Token generated successfully\nFailure at test.js:1');
    });

    it('should support custom date tokens like %d{YYYY-MM-DD HH:mm:ss.SSS}', () => {
        const layout = new PatternLayout({ pattern: '%d{YYYY-MM-DD HH:mm:ss.SSS} %m', timezone: 'UTC' });
        expect(layout.format(baseEntry)).toBe('2026-09-05 12:30:45.678 Token generated successfully');
    });

    it('should output UNKNOWN when log level is unrecognized', () => {
        const layout = new PatternLayout({ pattern: '[%p] %m' });
        expect(layout.format({ ...baseEntry, level: 99 as any })).toBe('[UNKNOWN] Token generated successfully');
    });

    it('should handle %d without specifier and %d{DEFAULT}', () => {
        const layout1 = new PatternLayout({ pattern: '%d %m', timezone: 'UTC' });
        const layout2 = new PatternLayout({ pattern: '%d{DEFAULT} %m', timezone: 'UTC' });
        const result1 = layout1.format(baseEntry);
        const result2 = layout2.format(baseEntry);
        expect(result1).toBe(result2);
        expect(result1).toContain('2026/09/05');
    });

    it('should handle %ex and %throwable placeholders with and without error or stack', () => {
        const layoutEx = new PatternLayout({ pattern: '%m%ex' });
        const layoutThrowable = new PatternLayout({ pattern: '%m%throwable' });
        
        // Without error
        expect(layoutEx.format(baseEntry)).toBe('Token generated successfully');
        expect(layoutThrowable.format(baseEntry)).toBe('Token generated successfully');

        // Error with message but no stack
        const errNoStack = { name: 'Error', message: 'No stack error' } as unknown as Error;
        expect(layoutEx.format({ ...baseEntry, error: errNoStack })).toBe('Token generated successfullyNo stack error');
        expect(layoutThrowable.format({ ...baseEntry, error: errNoStack })).toBe('Token generated successfullyNo stack error');
    });

    it('should handle {error} when error has no stack', () => {
        const layout = new PatternLayout({ pattern: '%m{error}' });
        const errNoStack = { name: 'Error', message: 'No stack error' } as unknown as Error;
        expect(layout.format({ ...baseEntry, error: errNoStack })).toBe('Token generated successfully\nNo stack error');
    });

    it('should append context and error automatically when alwaysAppend flags are true and pattern does not include them', () => {
        const layout = new PatternLayout({
            pattern: '[%p] %m',
            alwaysAppendContext: true,
            alwaysAppendError: true,
        });

        const entryWithBoth: LogEntry = {
            ...baseEntry,
            context: { requestId: 'req-123' },
            error: new Error('Database down'),
        };

        const output = layout.format(entryWithBoth);
        expect(output).toContain('[INFO] Token generated successfully {"requestId":"req-123"}\n');
        expect(output).toContain('Database down');

        // With error lacking stack
        const errNoStack = { name: 'Error', message: 'Simple failure' } as unknown as Error;
        const outputNoStack = layout.format({ ...baseEntry, error: errNoStack });
        expect(outputNoStack).toBe('[INFO] Token generated successfully\nSimple failure');
    });

    it('should handle empty date parts gracefully in custom date formatting', () => {
        const layout = new PatternLayout({ pattern: '%d{YYYY-MM-DD HH:mm:ss.SSS} %m', timezone: 'UTC' });
        const mockDateFormatter = {
            formatToParts: () => [],
        };
        const mockTimeFormatter = {
            formatToParts: () => [],
        };
        (layout as any).dateFormatter = mockDateFormatter;
        (layout as any).timeFormatter = mockTimeFormatter;

        const output = layout.format(baseEntry);
        expect(output).toBe('-- ::.678 Token generated successfully');
    });
});

