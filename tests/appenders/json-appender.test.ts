import { JsonAppender } from '../../src/appenders/json-appender';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';

describe('JsonAppender', () => {
    const spies: jest.SpyInstance[] = [];

    beforeEach(() => {
        spies.push(jest.spyOn(console, 'log').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'info').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'warn').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'error').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'debug').mockImplementation(() => {}));
        spies.push(jest.spyOn(console, 'trace').mockImplementation(() => {}));
    });

    afterEach(() => {
        spies.forEach(spy => spy.mockRestore());
        spies.length = 0;
    });

    it('should output valid JSON', () => {
        const appender = new JsonAppender();
        const entry: LogEntry = {
            timestamp: new Date('2023-10-28T14:30:05.123Z'),
            level: LogLevel.INFO,
            namespace: 'TestApp',
            message: 'Hello JSON',
        };

        appender.handle(entry);

        expect(console.info).toHaveBeenCalledTimes(1);
        const output = (console.info as jest.Mock).mock.calls[0][0];
        const parsed = JSON.parse(output);

        expect(parsed.timestamp).toBe('2023-10-28T14:30:05.123Z');
        expect(parsed.level).toBe('INFO');
        expect(parsed.namespace).toBe('TestApp');
        expect(parsed.message).toBe('Hello JSON');
    });

    it('should include context when present', () => {
        const appender = new JsonAppender();
        const entry: LogEntry = {
            timestamp: new Date(),
            level: LogLevel.INFO,
            namespace: 'Test',
            message: 'with context',
            context: { userId: 42, action: 'login' },
        };

        appender.handle(entry);

        const output = (console.info as jest.Mock).mock.calls[0][0];
        const parsed = JSON.parse(output);

        expect(parsed.context).toEqual({ userId: 42, action: 'login' });
    });

    it('should include error details when present', () => {
        const appender = new JsonAppender();
        const error = new Error('something broke');
        const entry: LogEntry = {
            timestamp: new Date(),
            level: LogLevel.ERROR,
            namespace: 'Test',
            message: 'failure',
            error,
        };

        appender.handle(entry);

        const output = (console.error as jest.Mock).mock.calls[0][0];
        const parsed = JSON.parse(output);

        expect(parsed.error).toBeDefined();
        expect(parsed.error.name).toBe('Error');
        expect(parsed.error.message).toBe('something broke');
        expect(parsed.error.stack).toBeDefined();
    });

    it('should not include context or error when absent', () => {
        const appender = new JsonAppender();
        const entry: LogEntry = {
            timestamp: new Date(),
            level: LogLevel.INFO,
            namespace: 'Test',
            message: 'clean',
        };

        appender.handle(entry);

        const output = (console.info as jest.Mock).mock.calls[0][0];
        const parsed = JSON.parse(output);

        expect(parsed.context).toBeUndefined();
        expect(parsed.error).toBeUndefined();
    });

    it('should route to correct console methods for each level', () => {
        const appender = new JsonAppender({ minLevel: LogLevel.TRACE });

        appender.handle({ timestamp: new Date(), level: LogLevel.TRACE, namespace: 'N', message: 'M' });
        appender.handle({ timestamp: new Date(), level: LogLevel.DEBUG, namespace: 'N', message: 'M' });
        appender.handle({ timestamp: new Date(), level: LogLevel.INFO, namespace: 'N', message: 'M' });
        appender.handle({ timestamp: new Date(), level: LogLevel.WARN, namespace: 'N', message: 'M' });
        appender.handle({ timestamp: new Date(), level: LogLevel.ERROR, namespace: 'N', message: 'M' });
        appender.handle({ timestamp: new Date(), level: LogLevel.FATAL, namespace: 'N', message: 'M' });

        expect(console.trace).toHaveBeenCalledTimes(1);
        expect(console.debug).toHaveBeenCalledTimes(1);
        expect(console.info).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(2); // ERROR + FATAL
    });
});
