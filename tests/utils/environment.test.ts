import { isNode, isBrowser } from '../../src/utils/environment';

describe('environment utils', () => {
    describe('isNode', () => {
        it('should return true in Node.js environment', () => {
            expect(isNode()).toBe(true);
        });

        it('should return false when process.versions is missing', () => {
            const originalVersions = process.versions;
            try {
                Object.defineProperty(process, 'versions', { value: undefined, configurable: true, writable: true });
                expect(isNode()).toBe(false);
            } finally {
                Object.defineProperty(process, 'versions', { value: originalVersions, configurable: true, writable: true });
            }
        });
    });

    describe('isBrowser', () => {
        it('should return false in default Node.js test environment', () => {
            expect(isBrowser()).toBe(false);
        });

        it('should return true when window and window.document are defined', () => {
            const originalWindow = (global as unknown as { window?: unknown }).window;
            try {
                (global as unknown as { window?: unknown }).window = {
                    document: {},
                };
                expect(isBrowser()).toBe(true);
            } finally {
                if (originalWindow === undefined) {
                    delete (global as unknown as { window?: unknown }).window;
                } else {
                    (global as unknown as { window?: unknown }).window = originalWindow;
                }
            }
        });
    });
});
