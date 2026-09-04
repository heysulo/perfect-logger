import { CallbackAppender } from '../../src/appenders/CallbackAppender';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';

function makeEntry(level: LogLevel = LogLevel.INFO, message = 'test'): LogEntry {
    return {
        timestamp: new Date(),
        level,
        namespace: 'Test',
        message,
    };
}

describe('CallbackAppender', () => {
    it('should require a callback function', () => {
        expect(() => new CallbackAppender({} as any)).toThrow(
            'CallbackAppender requires a `callback` function in its configuration.'
        );
    });

    it('should call the callback for each log entry', () => {
        const callback = jest.fn();
        const appender = new CallbackAppender({ callback });

        appender.handle(makeEntry(LogLevel.INFO, 'hello'));

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'hello' })
        );
    });

    it('should pass the full LogEntry to the callback', () => {
        const callback = jest.fn();
        const appender = new CallbackAppender({ callback });
        const error = new Error('boom');
        const entry: LogEntry = {
            timestamp: new Date(),
            level: LogLevel.ERROR,
            namespace: 'Svc',
            message: 'failed',
            context: { key: 'val' },
            error,
        };

        appender.handle(entry);

        const received = callback.mock.calls[0][0];
        expect(received.level).toBe(LogLevel.ERROR);
        expect(received.namespace).toBe('Svc');
        expect(received.context).toEqual({ key: 'val' });
        expect(received.error).toBe(error);
    });

    it('should catch errors thrown by the callback', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const callback = jest.fn(() => {
            throw new Error('callback failed');
        });
        const appender = new CallbackAppender({ callback });

        // Should not throw
        expect(() => appender.handle(makeEntry())).not.toThrow();
        expect(errorSpy).toHaveBeenCalledWith(
            'Error executing callback in CallbackAppender:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('should respect minLevel via log()', async () => {
        const callback = jest.fn();
        const appender = new CallbackAppender({ callback, minLevel: LogLevel.ERROR });

        await appender.log(makeEntry(LogLevel.INFO, 'ignored'));
        expect(callback).not.toHaveBeenCalled();

        await appender.log(makeEntry(LogLevel.ERROR, 'logged'));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle batch entries individually', () => {
        const callback = jest.fn();
        const appender = new CallbackAppender({ callback });

        const entries = [
            makeEntry(LogLevel.INFO, 'msg1'),
            makeEntry(LogLevel.WARN, 'msg2'),
            makeEntry(LogLevel.ERROR, 'msg3'),
        ];

        appender.handleBatch(entries);

        expect(callback).toHaveBeenCalledTimes(3);
    });
});
