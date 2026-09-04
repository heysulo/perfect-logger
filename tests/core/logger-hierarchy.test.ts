import { LogManager } from '../../src/core/log-manager';
import { LogLevel } from '../../src/constants';
import { BaseAppender } from '../../src/appenders/base-appender';
import { LogEntry } from '../../src/core/types';

class RecordingAppender extends BaseAppender {
    public entries: LogEntry[] = [];

    constructor(name: string = 'RecordingAppender', minLevel: LogLevel = LogLevel.TRACE) {
        super(name, { minLevel });
    }

    public handle(entry: LogEntry): void {
        this.entries.push(entry);
    }
}

describe('Logger Hierarchy & Additivity (Log4j Architecture)', () => {
    let logManager: LogManager;

    beforeEach(() => {
        (LogManager as any).instance = undefined;
        logManager = LogManager.getInstance();
    });

    afterEach(async () => {
        await logManager.shutdown();
    });

    describe('Logger Registry and Caching', () => {
        it('should return canonical cached instance on repeated calls', () => {
            const logger1 = logManager.getLogger('services.auth');
            const logger2 = logManager.getLogger('services.auth');
            expect(logger1).toBe(logger2);
        });

        it('should wire parent hierarchy correctly', () => {
            const leaf = logManager.getLogger('services.payment.stripe');
            const payment = logManager.getLogger('services.payment');
            const services = logManager.getLogger('services');
            const root = logManager.getRootLogger();

            expect(leaf.getParent()).toBe(payment);
            expect(payment.getParent()).toBe(services);
            expect(services.getParent()).toBe(root);
            expect(root.getParent()).toBeNull();
        });
    });

    describe('Effective Level Inheritance', () => {
        it('should inherit level from nearest ancestor', () => {
            logManager.configure({
                minLevel: LogLevel.INFO,
                loggers: {
                    'services.payment': { level: LogLevel.DEBUG },
                    'services.order': { level: LogLevel.WARN },
                },
            });

            const root = logManager.getRootLogger();
            const services = logManager.getLogger('services');
            const payment = logManager.getLogger('services.payment');
            const stripe = logManager.getLogger('services.payment.stripe');
            const order = logManager.getLogger('services.order');
            const orderCancel = logManager.getLogger('services.order.cancel');

            expect(root.getEffectiveLevel()).toBe(LogLevel.INFO);
            expect(services.getEffectiveLevel()).toBe(LogLevel.INFO); // inherited from root
            expect(payment.getEffectiveLevel()).toBe(LogLevel.DEBUG); // explicit
            expect(stripe.getEffectiveLevel()).toBe(LogLevel.DEBUG); // inherited from services.payment
            expect(order.getEffectiveLevel()).toBe(LogLevel.WARN); // explicit
            expect(orderCancel.getEffectiveLevel()).toBe(LogLevel.WARN); // inherited from services.order
        });

        it('should filter log calls according to effective level', () => {
            const appender = new RecordingAppender();
            logManager.configure({
                minLevel: LogLevel.INFO,
                appenders: [appender],
                loggers: {
                    'debug.service': { level: LogLevel.DEBUG },
                    'warn.service': { level: LogLevel.WARN },
                },
            });

            const debugLogger = logManager.getLogger('debug.service');
            const warnLogger = logManager.getLogger('warn.service');

            debugLogger.debug('debug message logged');
            warnLogger.info('info message ignored');
            warnLogger.warn('warn message logged');

            expect(appender.entries).toHaveLength(2);
            expect(appender.entries[0].message).toBe('debug message logged');
            expect(appender.entries[1].message).toBe('warn message logged');
        });
    });

    describe('Additivity and Appender Propagation', () => {
        it('should bubble up log events to ancestor appenders by default (additivity = true)', () => {
            const rootAppender = new RecordingAppender('RootAppender');
            const paymentAppender = new RecordingAppender('PaymentAppender');

            logManager.configure({
                minLevel: LogLevel.INFO,
                appenders: [rootAppender],
                loggers: {
                    'services.payment': {
                        appenders: [paymentAppender],
                        additivity: true,
                    },
                },
            });

            const stripeLogger = logManager.getLogger('services.payment.stripe');
            stripeLogger.info('Stripe charge created');

            // Received by paymentAppender and bubbles up to rootAppender
            expect(paymentAppender.entries).toHaveLength(1);
            expect(paymentAppender.entries[0].message).toBe('Stripe charge created');

            expect(rootAppender.entries).toHaveLength(1);
            expect(rootAppender.entries[0].message).toBe('Stripe charge created');
        });

        it('should stop propagation when additivity = false', () => {
            const rootAppender = new RecordingAppender('RootAppender');
            const auditAppender = new RecordingAppender('AuditAppender');

            logManager.configure({
                minLevel: LogLevel.INFO,
                appenders: [rootAppender],
                loggers: {
                    'security.audit': {
                        appenders: [auditAppender],
                        additivity: false, // Do not propagate to root!
                    },
                },
            });

            const auditLogger = logManager.getLogger('security.audit');
            auditLogger.info('Audit event captured');

            expect(auditAppender.entries).toHaveLength(1);
            expect(rootAppender.entries).toHaveLength(0); // Additivity false prevented root from receiving
        });
    });

    describe('Contextual Child Loggers in Hierarchy', () => {
        it('should maintain hierarchy and effective levels when child() is called', () => {
            const appender = new RecordingAppender();
            logManager.configure({
                minLevel: LogLevel.INFO,
                appenders: [appender],
                loggers: {
                    'api.checkout': { level: LogLevel.DEBUG },
                },
            });

            const parentLogger = logManager.getLogger('api.checkout');
            const requestLogger = parentLogger.child({ requestId: 'req-42' });

            expect(requestLogger.getEffectiveLevel()).toBe(LogLevel.DEBUG);
            requestLogger.debug('Processing cart');

            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].context).toEqual({ requestId: 'req-42' });
        });
    });
});
