import { FilterResult } from '../../src/filters/filter';
import { ThresholdFilter } from '../../src/filters/threshold-filter';
import { MarkerFilter } from '../../src/filters/marker-filter';
import { RegexFilter } from '../../src/filters/regex-filter';
import { ContextFilter } from '../../src/filters/context-filter';
import { CompositeFilter } from '../../src/filters/composite-filter';
import { Marker, Markers } from '../../src/core/marker';
import { LogManager } from '../../src/core/log-manager';
import { LogLevel } from '../../src/constants';
import { BaseAppender } from '../../src/appenders/base-appender';
import { LogEntry } from '../../src/core/types';

class TestAppender extends BaseAppender {
    public entries: LogEntry[] = [];
    constructor(config: { minLevel?: LogLevel; filters?: any } = {}) {
        super('TestAppender', config);
    }
    public handle(entry: LogEntry): void {
        this.entries.push(entry);
    }
}

describe('Tri-State Filter Pipeline (Log4j Architecture)', () => {
    const baseEntry: LogEntry = {
        timestamp: new Date(),
        level: LogLevel.INFO,
        namespace: 'auth',
        message: 'User 123 logged in',
        context: { tenant: 'enterprise', role: 'admin' },
    };

    describe('ThresholdFilter', () => {
        it('should evaluate level against threshold', () => {
            const filter = new ThresholdFilter({ level: LogLevel.WARN });
            expect(filter.filter({ ...baseEntry, level: LogLevel.INFO })).toBe(FilterResult.DENY);
            expect(filter.filter({ ...baseEntry, level: LogLevel.WARN })).toBe(FilterResult.ACCEPT);
            expect(filter.filter({ ...baseEntry, level: LogLevel.ERROR })).toBe(FilterResult.ACCEPT);
        });

        it('should support custom onMatch and onMismatch decisions', () => {
            const filter = new ThresholdFilter({
                level: LogLevel.WARN,
                onMatch: FilterResult.NEUTRAL,
                onMismatch: FilterResult.DENY,
            });
            expect(filter.filter({ ...baseEntry, level: LogLevel.WARN })).toBe(FilterResult.NEUTRAL);
            expect(filter.filter({ ...baseEntry, level: LogLevel.INFO })).toBe(FilterResult.DENY);
        });
    });

    describe('MarkerFilter', () => {
        it('should match marker and hierarchical ancestors', () => {
            const security = new Marker('SECURITY');
            const authMarker = new Marker('AUTH', [security]);

            const filter = new MarkerFilter({ marker: 'SECURITY' });

            expect(filter.filter({ ...baseEntry, marker: authMarker })).toBe(FilterResult.ACCEPT);
            expect(filter.filter({ ...baseEntry, marker: Markers.PERF })).toBe(FilterResult.DENY);
            expect(filter.filter({ ...baseEntry, marker: undefined })).toBe(FilterResult.DENY);
        });
    });

    describe('RegexFilter', () => {
        it('should match message against regular expression', () => {
            const filter = new RegexFilter({ regex: /^User \d+ logged in$/ });
            expect(filter.filter(baseEntry)).toBe(FilterResult.ACCEPT);
            expect(filter.filter({ ...baseEntry, message: 'Server started' })).toBe(FilterResult.DENY);
        });

        it('should support string regex patterns and custom onMatch/onMismatch', () => {
            const filter = new RegexFilter({
                regex: '^User \\d+',
                onMatch: FilterResult.NEUTRAL,
                onMismatch: FilterResult.ACCEPT,
            });
            expect(filter.filter(baseEntry)).toBe(FilterResult.NEUTRAL);
            expect(filter.filter({ ...baseEntry, message: 'System alert' })).toBe(FilterResult.ACCEPT);
        });
    });

    describe('ContextFilter', () => {
        it('should match by exact context key/value', () => {
            const filter = new ContextFilter({ key: 'tenant', value: 'enterprise' });
            expect(filter.filter(baseEntry)).toBe(FilterResult.ACCEPT);
            expect(filter.filter({ ...baseEntry, context: { tenant: 'free' } })).toBe(FilterResult.DENY);
            expect(filter.filter({ ...baseEntry, context: undefined })).toBe(FilterResult.DENY);
        });

        it('should support custom onMatch and onMismatch decisions', () => {
            const filter = new ContextFilter({
                key: 'tenant',
                value: 'enterprise',
                onMatch: FilterResult.NEUTRAL,
                onMismatch: FilterResult.NEUTRAL,
            });
            expect(filter.filter(baseEntry)).toBe(FilterResult.NEUTRAL);
            expect(filter.filter({ ...baseEntry, context: { tenant: 'free' } })).toBe(FilterResult.NEUTRAL);
        });

        it('should match by predicate function', () => {
            const filter = new ContextFilter({
                key: 'role',
                predicate: (val: string) => val === 'admin' || val === 'superadmin',
            });
            expect(filter.filter(baseEntry)).toBe(FilterResult.ACCEPT);
            expect(filter.filter({ ...baseEntry, context: { role: 'guest' } })).toBe(FilterResult.DENY);
        });

        it('should match by key presence when neither value nor predicate is provided', () => {
            const filter = new ContextFilter({ key: 'role' });
            expect(filter.filter({ ...baseEntry, context: { role: 'anything' } })).toBe(FilterResult.ACCEPT);
            expect(filter.filter({ ...baseEntry, context: {} })).toBe(FilterResult.DENY);
        });
    });

    describe('CompositeFilter', () => {
        it('should chain filters and short-circuit on non-NEUTRAL', () => {
            const composite = new CompositeFilter([
                new RegexFilter({ regex: /secret/i, onMatch: FilterResult.DENY, onMismatch: FilterResult.NEUTRAL }),
                new MarkerFilter({ marker: 'AUDIT', onMatch: FilterResult.ACCEPT, onMismatch: FilterResult.NEUTRAL }),
            ]);

            // Contains secret -> DENY
            expect(composite.filter({ ...baseEntry, message: 'secret password' })).toBe(FilterResult.DENY);

            // Has AUDIT marker and no secret -> ACCEPT
            expect(composite.filter({ ...baseEntry, marker: Markers.AUDIT })).toBe(FilterResult.ACCEPT);

            // Neither -> NEUTRAL
            expect(composite.filter(baseEntry)).toBe(FilterResult.NEUTRAL);
        });

        it('should allow adding filters dynamically via addFilter() and inspecting via getFilters()', () => {
            const composite = new CompositeFilter();
            expect(composite.getFilters()).toEqual([]);

            const filter1 = new RegexFilter({ regex: /foo/ });
            composite.addFilter(filter1);

            expect(composite.getFilters()).toEqual([filter1]);
        });
    });

    describe('Appender-level Filter Integration', () => {
        it('should allow ACCEPT filter to bypass appender minLevel', async () => {
            // Appender is configured for ERROR, but has a filter that ACCEPTs AUDIT markers
            const appender = new TestAppender({
                minLevel: LogLevel.ERROR,
                filters: [
                    new MarkerFilter({
                        marker: 'AUDIT',
                        onMatch: FilterResult.ACCEPT,
                        onMismatch: FilterResult.NEUTRAL,
                    }),
                ],
            });

            // 1. INFO log with AUDIT marker -> ACCEPTED despite minLevel ERROR
            await appender.log({
                ...baseEntry,
                level: LogLevel.INFO,
                marker: Markers.AUDIT,
                message: 'Audit record',
            });

            // 2. INFO log without AUDIT marker -> DROPPED (filter NEUTRAL, info < ERROR)
            await appender.log({
                ...baseEntry,
                level: LogLevel.INFO,
                message: 'Standard info',
            });

            // 3. ERROR log without marker -> ACCEPTED (filter NEUTRAL, error >= ERROR)
            await appender.log({
                ...baseEntry,
                level: LogLevel.ERROR,
                message: 'Critical error',
            });

            expect(appender.entries).toHaveLength(2);
            expect(appender.entries[0].message).toBe('Audit record');
            expect(appender.entries[1].message).toBe('Critical error');
        });
    });

    describe('Logger-level and Global Filter Integration', () => {
        let logManager: LogManager;

        beforeEach(() => {
            (LogManager as any).instance = undefined;
            logManager = LogManager.getInstance();
        });

        afterEach(async () => {
            await logManager.shutdown();
        });

        it('should filter log entries at the Logger level', () => {
            const appender = new TestAppender({ minLevel: LogLevel.TRACE });

            logManager.configure({
                minLevel: LogLevel.TRACE,
                appenders: [appender],
                loggers: {
                    'secure.channel': {
                        level: LogLevel.INFO,
                        filters: [
                            // Deny messages containing sensitive data
                            new RegexFilter({
                                regex: /credit_card/i,
                                onMatch: FilterResult.DENY,
                                onMismatch: FilterResult.NEUTRAL,
                            }),
                        ],
                    },
                },
            });

            const logger = logManager.getLogger('secure.channel');
            logger.info('Normal payment event');
            logger.info('Transaction with credit_card=4111');

            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].message).toBe('Normal payment event');
        });

        it('should evaluate global filters in LogManager', () => {
            const appender = new TestAppender({ minLevel: LogLevel.TRACE });

            logManager.configure({
                minLevel: LogLevel.TRACE,
                appenders: [appender],
                filters: [
                    new RegexFilter({
                        regex: /drop-me/i,
                        onMatch: FilterResult.DENY,
                        onMismatch: FilterResult.NEUTRAL,
                    }),
                ],
            });

            const logger = logManager.getLogger('any.service');
            logger.info('Keep this');
            logger.info('Please drop-me now');

            expect(appender.entries).toHaveLength(1);
            expect(appender.entries[0].message).toBe('Keep this');
        });
    });
});
