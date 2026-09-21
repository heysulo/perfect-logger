import { BenchmarkSuite } from '../harness';
import {
    ThresholdFilter,
    RegexFilter,
    MarkerFilter,
    ContextFilter,
    CompositeFilter,
    LogLevel,
    LogEntry,
    Markers,
    FilterResult,
} from '../../src';

export function createFiltersSuite(): BenchmarkSuite {
    const suite = new BenchmarkSuite(
        'Filter Pipelines',
        'Measures evaluation overhead across single filters and multi-stage composite pipelines.'
    );

    const thresholdFilter = new ThresholdFilter({ level: LogLevel.WARN });
    const regexFilter = new RegexFilter({ regex: /payment|checkout/i });
    const markerFilter = new MarkerFilter({ marker: Markers.SECURITY });
    const contextFilter = new ContextFilter({ key: 'tenantId', value: 'acme_corp' });

    const compositeFilter = new CompositeFilter([
        thresholdFilter,
        contextFilter,
        regexFilter,
    ]);

    const matchingEntry: LogEntry = {
        timestamp: new Date(1725880000000),
        level: LogLevel.ERROR,
        namespace: 'app.service.Payment',
        message: 'Checkout transaction failed',
        marker: Markers.SECURITY,
        context: { tenantId: 'acme_corp', attempt: 1 },
    };

    const nonMatchingEntry: LogEntry = {
        timestamp: new Date(1725880000000),
        level: LogLevel.DEBUG,
        namespace: 'app.cache.Redis',
        message: 'Cache hit for key user:100',
    };

    // 1. Threshold filter
    suite.add('ThresholdFilter.filter() [match/accept]', () => {
        thresholdFilter.filter(matchingEntry);
    });

    suite.add('ThresholdFilter.filter() [mismatch/deny]', () => {
        thresholdFilter.filter(nonMatchingEntry);
    });

    // 2. Regex filter
    suite.add('RegexFilter.filter() [match]', () => {
        regexFilter.filter(matchingEntry);
    });

    suite.add('RegexFilter.filter() [mismatch]', () => {
        regexFilter.filter(nonMatchingEntry);
    });

    // 3. Marker filter
    suite.add('MarkerFilter.filter() [match]', () => {
        markerFilter.filter(matchingEntry);
    });

    suite.add('MarkerFilter.filter() [mismatch]', () => {
        markerFilter.filter(nonMatchingEntry);
    });

    // 4. Context filter
    suite.add('ContextFilter.filter() [match]', () => {
        contextFilter.filter(matchingEntry);
    });

    suite.add('ContextFilter.filter() [mismatch]', () => {
        contextFilter.filter(nonMatchingEntry);
    });

    // 5. Composite filter
    suite.add('CompositeFilter.filter() [3 stages - match]', () => {
        compositeFilter.filter(matchingEntry);
    });

    suite.add('CompositeFilter.filter() [3 stages - early deny]', () => {
        compositeFilter.filter(nonMatchingEntry);
    });

    return suite;
}
