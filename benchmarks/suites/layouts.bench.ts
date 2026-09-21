import { BenchmarkSuite } from '../harness';
import { PatternLayout, JsonLayout, LogLevel, LogEntry, Markers } from '../../src';
import { safeStringify } from '../../src/utils/safe-stringify';

export function createLayoutsSuite(): BenchmarkSuite {
    const suite = new BenchmarkSuite(
        'Layouts & Serialization',
        'Measures string formatting throughput for PatternLayout and JSON serialization for JsonLayout.'
    );

    const defaultPattern = new PatternLayout();
    const isoPattern = new PatternLayout({ pattern: '[%d{ISO8601}] [%p] %c - %m' });
    const complexPattern = new PatternLayout({
        pattern: '[%d{ISO8601}] [%p] %c{2} [%X{traceId}] %marker %m%n',
        alwaysAppendError: true,
    });

    const compactJson = new JsonLayout({ pretty: false });
    const prettyJson = new JsonLayout({ pretty: true });

    const plainEntry: LogEntry = {
        timestamp: new Date(1725880000000),
        level: LogLevel.INFO,
        namespace: 'com.enterprise.app.service.BillingService',
        message: 'Invoice generated successfully',
    };

    const richEntry: LogEntry = {
        timestamp: new Date(1725880000000),
        level: LogLevel.WARN,
        namespace: 'com.enterprise.app.service.BillingService',
        message: 'High payment retry count detected',
        marker: Markers.SECURITY,
        context: {
            userId: 'usr_882190',
            invoiceId: 'inv_10023',
            amount: 450.0,
            currency: 'USD',
            traceId: 'tr_77665544',
        },
    };

    const errorEntry: LogEntry = {
        timestamp: new Date(1725880000000),
        level: LogLevel.ERROR,
        namespace: 'com.enterprise.app.service.BillingService',
        message: 'Payment gateway rejected invoice payment',
        error: new Error('Gateway returned status HTTP 502 Bad Gateway'),
        context: {
            retryCount: 3,
            gateway: 'stripe',
        },
    };

    // 1. PatternLayout
    suite.add('PatternLayout default (plain entry)', () => {
        defaultPattern.format(plainEntry);
    });

    suite.add('PatternLayout ISO8601 (plain entry)', () => {
        isoPattern.format(plainEntry);
    });

    suite.add('PatternLayout complex (rich entry)', () => {
        complexPattern.format(richEntry);
    });

    suite.add('PatternLayout complex (error entry)', () => {
        complexPattern.format(errorEntry);
    });

    // 2. JsonLayout
    suite.add('JsonLayout compact (plain entry)', () => {
        compactJson.format(plainEntry);
    });

    suite.add('JsonLayout compact (rich entry)', () => {
        compactJson.format(richEntry);
    });

    suite.add('JsonLayout compact (error entry)', () => {
        compactJson.format(errorEntry);
    });

    suite.add('JsonLayout pretty (rich entry)', () => {
        prettyJson.format(richEntry);
    });

    // 3. safeStringify
    const simpleObj = { a: 1, b: 'two', c: [1, 2, 3] };
    const circularObj: any = { name: 'parent' };
    circularObj.self = circularObj;

    suite.add('safeStringify(simpleObject)', () => {
        safeStringify(simpleObj);
    });

    suite.add('safeStringify(circularObject)', () => {
        safeStringify(circularObj);
    });

    return suite;
}
