import { safeStringify } from '../../src/utils/safe-stringify';

describe('safeStringify', () => {
    it('should stringify simple objects', () => {
        expect(safeStringify({ a: 1, b: 'hello' })).toBe('{"a":1,"b":"hello"}');
    });

    it('should handle nested objects', () => {
        const result = safeStringify({ a: { b: { c: 3 } } });
        expect(JSON.parse(result)).toEqual({ a: { b: { c: 3 } } });
    });

    it('should handle arrays', () => {
        expect(safeStringify([1, 2, 3])).toBe('[1,2,3]');
    });

    it('should handle null', () => {
        expect(safeStringify(null)).toBe('null');
    });

    it('should handle primitives', () => {
        expect(safeStringify(42)).toBe('42');
        expect(safeStringify('hello')).toBe('"hello"');
        expect(safeStringify(true)).toBe('true');
    });

    it('should handle circular references', () => {
        const obj: any = { a: 1 };
        obj.self = obj;
        const result = safeStringify(obj);
        const parsed = JSON.parse(result);
        expect(parsed.a).toBe(1);
        expect(parsed.self).toBe('[Circular]');
    });

    it('should handle deeply nested circular references', () => {
        const obj: any = { a: { b: {} } };
        obj.a.b.back = obj;
        const result = safeStringify(obj);
        const parsed = JSON.parse(result);
        expect(parsed.a.b.back).toBe('[Circular]');
    });

    it('should respect a custom replacer function', () => {
        const replacer = (_key: string, value: any) => {
            if (typeof value === 'number') return value * 2;
            return value;
        };
        const result = safeStringify({ a: 5, b: 10 }, replacer);
        expect(JSON.parse(result)).toEqual({ a: 10, b: 20 });
    });

    it('should respect the space parameter for indentation', () => {
        const result = safeStringify({ a: 1 }, null, 2);
        expect(result).toBe('{\n  "a": 1\n}');
    });

    it('should handle circular references combined with a replacer', () => {
        const obj: any = { a: 1, b: 2 };
        obj.self = obj;
        const replacer = (_key: string, value: any) => {
            if (typeof value === 'number') return value + 100;
            return value;
        };
        const result = safeStringify(obj, replacer);
        const parsed = JSON.parse(result);
        expect(parsed.a).toBe(101);
        expect(parsed.self).toBe('[Circular]');
    });
});
