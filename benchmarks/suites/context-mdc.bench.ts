import { BenchmarkSuite } from '../harness';
import { LogManager, LogLevel, CallbackAppender, MDC, MarkerManager, Markers } from '../../src';

export function createContextMdcSuite(): BenchmarkSuite {
    const suite = new BenchmarkSuite(
        'Context, Hierarchies & MDC',
        'Measures context merging, child logger inheritance, AsyncLocalStorage MDC scoping, and Marker tagging.'
    );

    LogManager.configure({
        minLevel: LogLevel.DEBUG,
        appenders: [new CallbackAppender({ callback: () => {} })],
    });

    const rootLogger = LogManager.getInstance().getLogger('benchmark.context');
    const childLogger = rootLogger.child({ service: 'auth-service', env: 'production' });
    const grandChildLogger = childLogger.child({ tenantId: 'tenant_77', shard: 3 });

    // 1. Child logger context resolution
    suite.add('childLogger.info("msg") [2 parent fields]', () => {
        childLogger.info('Token validated');
    });

    suite.add('childLogger.info("msg", localContext)', () => {
        childLogger.info('Token validated', { userId: 'user_456' });
    });

    suite.add('grandChildLogger.info("msg", localContext) [4 context fields]', () => {
        grandChildLogger.info('Tenant action completed', { action: 'READ' });
    });

    // 2. MDC (Mapped Diagnostic Context with AsyncLocalStorage)
    suite.add('MDC.put() and MDC.get()', () => {
        MDC.put('reqId', 'req_abcdef123456');
        MDC.get('reqId');
        MDC.remove('reqId');
    });

    suite.add('MDC.run(context, () => logger.info())', () => {
        MDC.run({ traceId: 'tr_112233', spanId: 'sp_4455' }, () => {
            rootLogger.info('Request handling inside MDC context');
        });
    });

    suite.add('Nested MDC.run() [2 levels deep]', () => {
        MDC.run({ traceId: 'tr_root' }, () => {
            MDC.run({ subTask: 'database_query' }, () => {
                rootLogger.info('Executed nested task');
            });
        });
    });

    // 3. Markers
    const secMarker = Markers.SECURITY;
    const auditMarker = MarkerManager.getMarker('BENCHMARK_AUDIT', secMarker);

    suite.add('logger.info(Marker, "msg")', () => {
        rootLogger.info(secMarker, 'User login attempted');
    });

    suite.add('logger.info(HierarchicalMarker, "msg")', () => {
        rootLogger.info(auditMarker, 'Financial audit log generated');
    });

    return suite;
}
