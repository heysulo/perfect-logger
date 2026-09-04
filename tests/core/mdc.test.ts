import { MDC } from '../../src/core/mdc';
import { LogManager } from '../../src/core/log-manager';
import { LogLevel } from '../../src/constants';
import { BaseAppender } from '../../src/appenders/base-appender';
import { LogEntry } from '../../src/core/types';

class MemoryAppender extends BaseAppender {
    public entries: LogEntry[] = [];
    constructor() {
        super('MemoryAppender', { minLevel: LogLevel.TRACE });
    }
    public handle(entry: LogEntry): void {
        this.entries.push(entry);
    }
}

describe('Mapped Diagnostic Context (MDC)', () => {
    let appender: MemoryAppender;
    let logManager: LogManager;

    beforeEach(() => {
        (LogManager as any).instance = undefined;
        logManager = LogManager.getInstance();
        appender = new MemoryAppender();
        logManager.configure({
            minLevel: LogLevel.TRACE,
            appenders: [appender],
        });
        MDC.clear();
    });

    afterEach(async () => {
        await logManager.shutdown();
        MDC.clear();
    });

    it('should set, get, remove, and clear context in MDC', () => {
        MDC.put('userId', 'user-42');
        MDC.put('role', 'admin');

        expect(MDC.get('userId')).toBe('user-42');
        expect(MDC.getContext()).toEqual({ userId: 'user-42', role: 'admin' });

        MDC.remove('role');
        expect(MDC.get('role')).toBeUndefined();

        MDC.clear();
        expect(MDC.getContext()).toEqual({});
    });

    it('should automatically attach MDC context to logs inside MDC.run()', () => {
        const logger = logManager.getLogger('order.processor');

        MDC.run({ traceId: 'tr-100', tenant: 'acme' }, () => {
            logger.info('Processing payment');
        });

        expect(appender.entries).toHaveLength(1);
        expect(appender.entries[0].context).toEqual({
            traceId: 'tr-100',
            tenant: 'acme',
        });
    });

    it('should merge MDC context with logger child context and local context', () => {
        const baseLogger = logManager.getLogger('api');
        const childLogger = baseLogger.child({ service: 'auth' });

        MDC.run({ traceId: 'tr-200' }, () => {
            childLogger.info('Login attempt', { ip: '127.0.0.1' });
        });

        expect(appender.entries).toHaveLength(1);
        expect(appender.entries[0].context).toEqual({
            traceId: 'tr-200',
            service: 'auth',
            ip: '127.0.0.1',
        });
    });

    it('should maintain isolated contexts across concurrent async tasks', async () => {
        const logger = logManager.getLogger('async.worker');

        const task1 = async () => {
            await MDC.run({ requestId: 'req-1' }, async () => {
                await new Promise(resolve => setTimeout(resolve, 20));
                logger.info('Task 1 completed');
            });
        };

        const task2 = async () => {
            await MDC.run({ requestId: 'req-2' }, async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                logger.info('Task 2 completed');
            });
        };

        await Promise.all([task1(), task2()]);

        expect(appender.entries).toHaveLength(2);
        const req1Entry = appender.entries.find(e => e.message === 'Task 1 completed');
        const req2Entry = appender.entries.find(e => e.message === 'Task 2 completed');

        expect(req1Entry?.context?.requestId).toBe('req-1');
        expect(req2Entry?.context?.requestId).toBe('req-2');
    });

    it('should support nested MDC.run() scopes with context inheritance and shadowing', () => {
        const logger = logManager.getLogger('nested');

        MDC.run({ level: 'outer', shared: 'original' }, () => {
            logger.info('In outer');

            MDC.run({ level: 'inner' }, () => {
                logger.info('In inner');
            });

            logger.info('Back in outer');
        });

        expect(appender.entries).toHaveLength(3);
        expect(appender.entries[0].context).toEqual({ level: 'outer', shared: 'original' });
        expect(appender.entries[1].context).toEqual({ level: 'inner', shared: 'original' });
        expect(appender.entries[2].context).toEqual({ level: 'outer', shared: 'original' });
    });

    it('should support put, get, remove, and clear inside active MDC.run() scope', () => {
        MDC.run({ initial: 'yes', temp: 'to-delete' }, () => {
            MDC.put('dynamicallyAdded', 'value123');
            expect(MDC.get('dynamicallyAdded')).toBe('value123');
            expect(MDC.get('initial')).toBe('yes');

            MDC.remove('temp');
            expect(MDC.get('temp')).toBeUndefined();

            MDC.clear();
            expect(MDC.getContext()).toEqual({});
        });
    });

    describe('browser fallback store when AsyncLocalStorage is unavailable', () => {
        it('should use fallbackStore when asyncLocalStorageInstance is null', () => {
            const originalInstance = MDC._getStorage();
            MDC._setStorage(null);

            try {
                MDC.clear();
                expect(MDC.getContext()).toEqual({});

                MDC.put('k1', 'v1');
                expect(MDC.get('k1')).toBe('v1');
                expect(MDC.getContext()).toEqual({ k1: 'v1' });

                MDC.remove('k1');
                expect(MDC.get('k1')).toBeUndefined();

                const result = MDC.run({ inFallbackRun: true }, () => {
                    expect(MDC.get('inFallbackRun')).toBe(true);
                    return 'done';
                });
                expect(result).toBe('done');
            } finally {
                MDC._setStorage(originalInstance);
            }
        });
    });
});
