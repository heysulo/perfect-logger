import {ConsoleAppender} from '../../src/appenders/ConsoleAppender';
import {LogLevel} from '../../src/constants';
import {LogEntry} from '../../src/core/types';

describe('ConsoleAppender', () => {
    const spies: jest.SpyInstance[] = [];

    beforeEach(() => {
        // Spy on all console methods
        spies.push(jest.spyOn(console, 'log').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'info').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'warn').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'error').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'debug').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'trace').mockImplementation(() => {}));
        
        // Use fake timers to control the timestamp
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-02-21T18:26:00.321Z'));
    });

    afterEach(() => {
        // Restore all spies
        spies.forEach(spy => spy.mockRestore());
        spies.length = 0;
        jest.useRealTimers();
    });

    it('should log a simple message with the default format in UTC', () => {
        // Explicitly set timezone to UTC to make test deterministic
        const appender = new ConsoleAppender({ timezone: 'UTC' });
        const entry: LogEntry = {
            level: LogLevel.INFO,
            namespace: 'Test',
            message: 'This is an information',
            timestamp: new Date(),
        };

        appender.handle(entry);

        expect(console.info).toHaveBeenCalledTimes(1);
        const logOutput = (console.info as jest.Mock).mock.calls[0][0];
        
        // Expect the UTC time from jest.setSystemTime()
        const expectedPattern = /2020\/02\/21 \| 18:26:00.321 \| INFO \| Test \| This is an information/;
        expect(logOutput).toMatch(expectedPattern);
    });

    it('should use the custom format string when provided', () => {
        const appender = new ConsoleAppender({
            format: '[{level}] {namespace}: {message}',
            timezone: 'UTC', // Make this test deterministic as well
        });
        const entry: LogEntry = {
            level: LogLevel.WARN,
            namespace: 'Custom',
            message: 'A custom format',
            timestamp: new Date(),
        };

        appender.handle(entry);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('[WARN] Custom: A custom format');
    });

    it('should not log messages below the minimum level', () => {
        const appender = new ConsoleAppender({ minLevel: LogLevel.WARN });
        const entry: LogEntry = {
            level: LogLevel.INFO,
            namespace: 'Test',
            message: 'This should be ignored',
            timestamp: new Date(),
        };

        appender.handle(entry);

        expect(console.info).not.toHaveBeenCalled();
    });

    it('should include context and error information when present', () => {
        const appender = new ConsoleAppender({
            format: '{message}{context}{error}',
        });
        const error = new Error('Something went wrong');
        error.stack = 'stack trace';
        const entry: LogEntry = {
            level: LogLevel.ERROR,
            namespace: 'Test',
            message: 'An error occurred',
            context: { userId: 123 },
            error,
            timestamp: new Date(),
        };

        appender.handle(entry);

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith('An error occurred {"userId":123}\nstack trace');
    });

    it('should call the correct console method for each log level', () => {
        const appender = new ConsoleAppender({ timezone: 'UTC', minLevel: LogLevel.TRACE }); // Deterministic
        appender.handle({ level: LogLevel.TRACE, namespace: 'N', message: 'M', timestamp: new Date() });
        appender.handle({ level: LogLevel.DEBUG, namespace: 'N', message: 'M', timestamp: new Date() });
        appender.handle({ level: LogLevel.INFO, namespace: 'N', message: 'M', timestamp: new Date() });
        appender.handle({ level: LogLevel.WARN, namespace: 'N', message: 'M', timestamp: new Date() });
        appender.handle({ level: LogLevel.ERROR, namespace: 'N', message: 'M', timestamp: new Date() });
        appender.handle({ level: LogLevel.FATAL, namespace: 'N', message: 'M', timestamp: new Date() });

        expect(console.trace).toHaveBeenCalledTimes(1);
        expect(console.debug).toHaveBeenCalledTimes(1);
        expect(console.info).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(2); // ERROR and FATAL both map to console.error
    });

    it('should respect the timezone configuration', () => {
        // Test with a timezone that is significantly different from UTC
        const appender = new ConsoleAppender({ timezone: 'America/New_York' });
        const entry: LogEntry = {
            level: LogLevel.INFO,
            namespace: 'Test',
            message: 'Timezone test',
            timestamp: new Date('2020-02-21T18:26:00.321Z'), // UTC time
        };

        appender.handle(entry);

        expect(console.info).toHaveBeenCalledTimes(1);
        const logOutput = (console.info as jest.Mock).mock.calls[0][0];

        // 18:26 UTC is 13:26 in America/New_York on that date
        const expectedPattern = /2020\/02\/21 \| 13:26:00.321 \| INFO \| Test \| Timezone test/;
        expect(logOutput).toMatch(expectedPattern);
    });
});
