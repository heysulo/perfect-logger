import { Marker, MarkerManager, Markers } from '../../src/core/marker';
import { LogManager } from '../../src/core/log-manager';
import { LogLevel } from '../../src/constants';
import { BaseAppender } from '../../src/appenders/base-appender';
import { LogEntry } from '../../src/core/types';
import { PatternLayout } from '../../src/layouts/pattern-layout';
import { JsonLayout } from '../../src/layouts/json-layout';

class MemoryAppender extends BaseAppender {
    public entries: LogEntry[] = [];
    constructor() {
        super('MemoryAppender', { minLevel: LogLevel.TRACE });
    }
    public handle(entry: LogEntry): void {
        this.entries.push(entry);
    }
}

describe('First-Class Markers (Log4j Architecture)', () => {
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
        MarkerManager.clear();
    });

    afterEach(async () => {
        await logManager.shutdown();
    });

    describe('Marker Hierarchy', () => {
        it('should verify direct and ancestor marker containment', () => {
            const security = MarkerManager.getMarker('SECURITY');
            const auth = MarkerManager.getMarker('AUTH', security);
            const login = MarkerManager.getMarker('LOGIN', auth);

            expect(login.contains('LOGIN')).toBe(true);
            expect(login.contains('AUTH')).toBe(true);
            expect(login.contains('SECURITY')).toBe(true);
            expect(login.contains('PERF')).toBe(false);

            expect(auth.contains('LOGIN')).toBe(false);
            expect(auth.contains('SECURITY')).toBe(true);
        });

        it('should return true when passing another Marker instance to contains()', () => {
            const parent = new Marker('PARENT');
            const child = new Marker('CHILD', [parent]);
            expect(child.contains(parent)).toBe(true);
            const unrelated = new Marker('UNRELATED');
            expect(child.contains(unrelated)).toBe(false);
        });

        it('should format toString with parents', () => {
            const parent = new Marker('PARENT');
            const child = new Marker('CHILD', [parent]);
            expect(parent.toString()).toBe('PARENT');
            expect(child.toString()).toBe('CHILD [ PARENT ]');
        });

        it('should prevent circular self-parenting', () => {
            const m = new Marker('TEST');
            expect(() => m.addParent(m)).toThrow();
        });

        it('should return copy of parents from getParents() and ignore duplicate addParent()', () => {
            const p = new Marker('P');
            const m = new Marker('C');
            m.addParent(p);
            m.addParent(p); // Duplicate should not be added
            expect(m.getParents()).toEqual([p]);
        });

        it('should add parents when calling MarkerManager.getMarker for existing marker', () => {
            const m = MarkerManager.getMarker('DYNAMIC');
            expect(m.getParents()).toEqual([]);

            const p1 = MarkerManager.getMarker('PARENT1');
            const updated = MarkerManager.getMarker('DYNAMIC', p1);
            expect(updated).toBe(m);
            expect(updated.getParents()).toEqual([p1]);
        });
    });

    describe('Logger integration with Markers', () => {
        it('should attach marker to LogEntry across log levels', () => {
            const logger = logManager.getLogger('auth.service');

            logger.info(Markers.SECURITY, 'User logged in', { userId: 'u1' });
            logger.warn(Markers.AUDIT, 'Password changed');
            logger.error(Markers.SECURITY, 'Brute force detected', new Error('Limit exceeded'));

            expect(appender.entries).toHaveLength(3);
            expect(appender.entries[0].marker?.name).toBe('SECURITY');
            expect(appender.entries[0].message).toBe('User logged in');
            expect(appender.entries[0].context).toEqual({ userId: 'u1' });

            expect(appender.entries[1].marker?.name).toBe('AUDIT');
            expect(appender.entries[1].message).toBe('Password changed');

            expect(appender.entries[2].marker?.name).toBe('SECURITY');
            expect(appender.entries[2].error?.message).toBe('Limit exceeded');
        });

        it('should format marker in PatternLayout via %marker and %markerSimpleName', () => {
            const parent = new Marker('AUDIT');
            const paymentMarker = new Marker('PAYMENT', [parent]);

            const entry: LogEntry = {
                timestamp: new Date('2026-09-05T12:00:00.000Z'),
                level: LogLevel.INFO,
                namespace: 'billing',
                message: 'Invoice paid',
                marker: paymentMarker,
            };

            const layout1 = new PatternLayout({ pattern: '[%p] [%marker] %m' });
            expect(layout1.format(entry)).toBe('[INFO] [PAYMENT [ AUDIT ]] Invoice paid');

            const layout2 = new PatternLayout({ pattern: '[%p] [%markerSimpleName] %m' });
            expect(layout2.format(entry)).toBe('[INFO] [PAYMENT] Invoice paid');
        });

        it('should include marker in JsonLayout output', () => {
            const entry: LogEntry = {
                timestamp: new Date('2026-09-05T12:00:00.000Z'),
                level: LogLevel.INFO,
                namespace: 'billing',
                message: 'Invoice paid',
                marker: Markers.AUDIT,
            };

            const layout = new JsonLayout();
            const parsed = JSON.parse(layout.format(entry));
            expect(parsed.marker).toBe('AUDIT');
        });
    });
});
