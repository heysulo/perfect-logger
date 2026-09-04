import { JsonLayout } from '../../src/layouts/json-layout';
import { LogLevel } from '../../src/constants';
import { LogEntry } from '../../src/core/types';
import { Marker } from '../../src/core/marker';

describe('JsonLayout', () => {
    const baseEntry: LogEntry = {
        timestamp: new Date('2026-09-05T12:00:00.000Z'),
        level: LogLevel.WARN,
        namespace: 'order.service',
        message: 'Order status updated',
    };

    it('should format as valid JSON with default options', () => {
        const layout = new JsonLayout();
        const jsonStr = layout.format(baseEntry);
        const parsed = JSON.parse(jsonStr);

        expect(parsed).toEqual({
            timestamp: '2026-09-05T12:00:00.000Z',
            level: 'WARN',
            namespace: 'order.service',
            message: 'Order status updated',
        });
    });

    it('should support epoch timestamp format', () => {
        const layout = new JsonLayout({ timestampFormat: 'epoch' });
        const jsonStr = layout.format(baseEntry);
        const parsed = JSON.parse(jsonStr);

        expect(parsed.timestamp).toBe(baseEntry.timestamp.getTime());
    });

    it('should include context if present', () => {
        const entry: LogEntry = {
            ...baseEntry,
            context: { orderId: 'ord-999', total: 49.99 },
        };
        const layout = new JsonLayout();
        const parsed = JSON.parse(layout.format(entry));

        expect(parsed.context).toEqual({ orderId: 'ord-999', total: 49.99 });
    });

    it('should include error object details if present', () => {
        const err = new Error('Payment declined');
        const entry: LogEntry = {
            ...baseEntry,
            error: err,
        };
        const layout = new JsonLayout();
        const parsed = JSON.parse(layout.format(entry));

        expect(parsed.error).toBeDefined();
        expect(parsed.error.name).toBe('Error');
        expect(parsed.error.message).toBe('Payment declined');
        expect(parsed.error.stack).toBeDefined();
    });

    it('should support custom field mappings', () => {
        const layout = new JsonLayout({
            fieldNames: {
                timestamp: '@timestamp',
                level: 'severity',
                logger: 'service_name',
                message: 'log_message',
            },
        });
        const parsed = JSON.parse(layout.format(baseEntry));

        expect(parsed['@timestamp']).toBe('2026-09-05T12:00:00.000Z');
        expect(parsed.severity).toBe('WARN');
        expect(parsed.service_name).toBe('order.service');
        expect(parsed.log_message).toBe('Order status updated');
    });

    it('should handle circular references in context gracefully', () => {
        const circularObj: any = { a: 1 };
        circularObj.self = circularObj;

        const entry: LogEntry = {
            ...baseEntry,
            context: { circular: circularObj },
        };
        const layout = new JsonLayout();
        const jsonStr = layout.format(entry);
        expect(jsonStr).toContain('[Circular]');
        expect(() => JSON.parse(jsonStr)).not.toThrow();
    });

    it('should format pretty-printed JSON when pretty is true', () => {
        const layout = new JsonLayout({ pretty: true });
        const jsonStr = layout.format(baseEntry);
        expect(jsonStr).toContain('\n');
        expect(jsonStr).toContain('  "level": "WARN"');
    });

    it('should omit context and error when configured false', () => {
        const entry: LogEntry = {
            ...baseEntry,
            context: { foo: 'bar' },
            error: new Error('Omit me'),
        };
        const layout = new JsonLayout({
            includeContext: false,
            includeError: false,
        });
        const parsed = JSON.parse(layout.format(entry));
        expect(parsed.context).toBeUndefined();
        expect(parsed.error).toBeUndefined();
    });

    it('should output UNKNOWN when log level number is not in LogLevel enum', () => {
        const entry: LogEntry = {
            ...baseEntry,
            level: 99 as any,
        };
        const layout = new JsonLayout();
        const parsed = JSON.parse(layout.format(entry));
        expect(parsed.level).toBe('UNKNOWN');
    });

    it('should support custom field mappings for marker, context, and error', () => {
        const layout = new JsonLayout({
            fieldNames: {
                marker: 'log_marker',
                context: 'log_context',
                error: 'log_error',
            },
        });
        const entry: LogEntry = {
            ...baseEntry,
            marker: new Marker('SECURITY'),
            context: { tenant: 'acme' },
            error: new Error('Auth failure'),
        };
        const parsed = JSON.parse(layout.format(entry));
        expect(parsed.log_marker).toBe('SECURITY');
        expect(parsed.log_context).toEqual({ tenant: 'acme' });
        expect(parsed.log_error.message).toBe('Auth failure');
    });
});
