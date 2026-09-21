/**
 * High-precision benchmarking harness for perfect-logger.
 *
 * Provides:
 * - Nanosecond timing using process.hrtime.bigint()
 * - JIT warm-up cycles for V8 optimization stabilization
 * - Batched measurement to eliminate timer overhead on sub-microsecond calls
 * - Statistical distribution (mean, p50, p95, p99, min, max)
 * - ANSI formatted tabular reporting and JSON serialization
 */

export type BenchmarkFn = () => void | Promise<void>;

export interface BenchmarkOptions {
    /** Number of warmup iterations before recording (default: 5,000) */
    warmupIterations?: number;
    /** Minimum duration to run benchmark in milliseconds (default: 800ms) */
    minDurationMs?: number;
    /** Target sample count for latency distribution (default: 100) */
    sampleCount?: number;
    /** Number of operations per inner measurement batch (default: 200 for sync, 1 for async) */
    batchSize?: number;
}

export interface BenchmarkResult {
    name: string;
    opsPerSec: number;
    meanNs: number;
    p50Ns: number;
    p95Ns: number;
    p99Ns: number;
    minNs: number;
    maxNs: number;
    totalOps: number;
    totalDurationMs: number;
    relativeSpeed?: number;
}

export interface SuiteResult {
    suiteName: string;
    description: string;
    results: BenchmarkResult[];
}

export class BenchmarkSuite {
    readonly name: string;
    readonly description: string;
    private readonly benchmarks: Array<{
        name: string;
        fn: BenchmarkFn;
        options: BenchmarkOptions;
    }> = [];

    constructor(name: string, description: string = '') {
        this.name = name;
        this.description = description;
    }

    /**
     * Register a benchmark scenario in this suite.
     */
    add(name: string, fn: BenchmarkFn, options: BenchmarkOptions = {}): this {
        this.benchmarks.push({ name, fn, options });
        return this;
    }

    /**
     * Run all registered benchmarks in sequence.
     */
    async run(filter?: string): Promise<SuiteResult> {
        const results: BenchmarkResult[] = [];
        const filtered = filter
            ? this.benchmarks.filter(b => b.name.toLowerCase().includes(filter.toLowerCase()))
            : this.benchmarks;

        for (const bench of filtered) {
            const result = await this.runSingleBenchmark(bench.name, bench.fn, bench.options);
            results.push(result);
        }

        // Calculate relative speed against fastest
        if (results.length > 0) {
            const fastestOps = Math.max(...results.map(r => r.opsPerSec));
            for (const r of results) {
                r.relativeSpeed = r.opsPerSec / fastestOps;
            }
        }

        return {
            suiteName: this.name,
            description: this.description,
            results,
        };
    }

    private async runSingleBenchmark(
        name: string,
        fn: BenchmarkFn,
        options: BenchmarkOptions
    ): Promise<BenchmarkResult> {
        const isAsync = fn.constructor.name === 'AsyncFunction';
        const warmupCount = options.warmupIterations ?? (isAsync ? 200 : 5000);
        const minDurationMs = options.minDurationMs ?? (isAsync ? 500 : 800);
        const sampleCount = options.sampleCount ?? (isAsync ? 50 : 100);
        const batchSize = options.batchSize ?? (isAsync ? 1 : 200);

        // 1. Warm-up phase (stabilize V8 JIT compiler and inline caches)
        for (let i = 0; i < warmupCount; i++) {
            const res = fn();
            if (res instanceof Promise) {
                await res;
            }
        }

        // Minor breathing space between warmup and recording
        await new Promise(resolve => setTimeout(resolve, 10));

        // 2. Measurement phase
        const sampleLatenciesNs: number[] = [];
        let totalOps = 0;
        const startTotal = process.hrtime.bigint();
        const minDurationNs = BigInt(minDurationMs) * BigInt(1_000_000);

        while (true) {
            const batchStart = process.hrtime.bigint();

            if (isAsync) {
                for (let i = 0; i < batchSize; i++) {
                    const res = fn();
                    if (res instanceof Promise) {
                        await res;
                    }
                }
            } else {
                for (let i = 0; i < batchSize; i++) {
                    (fn as () => void)();
                }
            }

            const batchEnd = process.hrtime.bigint();
            const batchDurationNs = Number(batchEnd - batchStart);
            const opLatencyNs = batchDurationNs / batchSize;
            sampleLatenciesNs.push(opLatencyNs);
            totalOps += batchSize;

            const elapsedTotalNs = batchEnd - startTotal;
            if (elapsedTotalNs >= minDurationNs && sampleLatenciesNs.length >= sampleCount) {
                break;
            }
        }

        const totalDurationNs = Number(process.hrtime.bigint() - startTotal);
        const totalDurationMs = totalDurationNs / 1_000_000;
        const opsPerSec = (totalOps / totalDurationNs) * 1_000_000_000;

        // Statistical distribution
        sampleLatenciesNs.sort((a, b) => a - b);
        const minNs = sampleLatenciesNs[0];
        const maxNs = sampleLatenciesNs[sampleLatenciesNs.length - 1];
        const meanNs = sampleLatenciesNs.reduce((sum, v) => sum + v, 0) / sampleLatenciesNs.length;

        const p50Ns = getPercentile(sampleLatenciesNs, 0.50);
        const p95Ns = getPercentile(sampleLatenciesNs, 0.95);
        const p99Ns = getPercentile(sampleLatenciesNs, 0.99);

        return {
            name,
            opsPerSec,
            meanNs,
            p50Ns,
            p95Ns,
            p99Ns,
            minNs,
            maxNs,
            totalOps,
            totalDurationMs,
        };
    }
}

function getPercentile(sorted: number[], p: number): number {
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)];
}

// ---------------------------------------------------------------------------
// Formatted Output Helpers
// ---------------------------------------------------------------------------

export function formatNumber(n: number): string {
    return Math.round(n).toLocaleString('en-US');
}

export function formatLatency(ns: number): string {
    if (ns < 1000) {
        return `${ns.toFixed(1)} ns`;
    }
    const us = ns / 1000;
    if (us < 1000) {
        return `${us.toFixed(2)} µs`;
    }
    const ms = us / 1000;
    return `${ms.toFixed(2)} ms`;
}

export function formatOps(ops: number): string {
    if (ops >= 1_000_000) {
        return `${(ops / 1_000_000).toFixed(2)}M ops/s`;
    }
    if (ops >= 1_000) {
        return `${(ops / 1_000).toFixed(1)}K ops/s`;
    }
    return `${formatNumber(ops)} ops/s`;
}

/**
 * Pretty-print a suite result to terminal using ANSI colors and formatted table.
 */
export function printSuiteResult(suite: SuiteResult): void {
    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const bold = '\x1b[1m';
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';

    console.log(`\n${bold}${cyan}==> Suite: ${suite.suiteName}${reset}`);
    if (suite.description) {
        console.log(`    ${dim}${suite.description}${reset}`);
    }
    console.log('');

    const colName = 40;
    const colOps = 16;
    const colMean = 12;
    const colP50 = 12;
    const colP95 = 12;
    const colP99 = 12;
    const colRel = 16;

    const header =
        '  ' +
        'Benchmark'.padEnd(colName) +
        'Throughput'.padStart(colOps) +
        'Mean'.padStart(colMean) +
        'p50'.padStart(colP50) +
        'p95'.padStart(colP95) +
        'p99'.padStart(colP99) +
        'Relative'.padStart(colRel);

    console.log(`${bold}${header}${reset}`);
    console.log('  ' + '-'.repeat(colName + colOps + colMean + colP50 + colP95 + colP99 + colRel));

    for (const r of suite.results) {
        const isFastest = r.relativeSpeed !== undefined && r.relativeSpeed >= 0.999;
        const relStr = isFastest
            ? `${green}1.00x (fastest)${reset}`
            : `${dim}${(r.relativeSpeed ?? 0).toFixed(2)}x${reset}`;

        const nameStr = r.name.length > colName - 2
            ? r.name.substring(0, colName - 3) + '...'
            : r.name;

        const opsStr = formatOps(r.opsPerSec);
        const meanStr = formatLatency(r.meanNs);
        const p50Str = formatLatency(r.p50Ns);
        const p95Str = formatLatency(r.p95Ns);
        const p99Str = formatLatency(r.p99Ns);

        const line =
            '  ' +
            nameStr.padEnd(colName) +
            `${green}${opsStr.padStart(colOps)}${reset}` +
            meanStr.padStart(colMean) +
            p50Str.padStart(colP50) +
            p95Str.padStart(colP95) +
            p99Str.padStart(colP99) +
            '  ' + relStr;

        console.log(line);
    }
    console.log('');
}
