import * as fs from 'fs';
import * as path from 'path';
import { SuiteResult, BenchmarkResult, formatOps, formatLatency } from './harness';

interface CliArgs {
    baselinePath: string;
    currentPath?: string;
    thresholdPct: number;
    failOnRegression: boolean;
}

function parseArgs(args: string[]): CliArgs {
    let baselinePath = path.resolve(__dirname, 'baseline.json');
    let currentPath: string | undefined;
    let thresholdPct = 15;
    let failOnRegression = true;

    for (const arg of args) {
        if (arg.startsWith('--baseline=')) {
            baselinePath = path.resolve(process.cwd(), arg.substring('--baseline='.length));
        } else if (arg.startsWith('--current=')) {
            currentPath = path.resolve(process.cwd(), arg.substring('--current='.length));
        } else if (arg.startsWith('--threshold=')) {
            thresholdPct = parseFloat(arg.substring('--threshold='.length));
        } else if (arg === '--no-fail') {
            failOnRegression = false;
        }
    }

    return { baselinePath, currentPath, thresholdPct, failOnRegression };
}

interface ComparisonRow {
    suite: string;
    name: string;
    baselineOps: number;
    currentOps: number;
    diffPct: number;
    baselineP50: number;
    currentP50: number;
    status: 'PASS' | 'WARN' | 'FAIL' | 'NEW';
}

function analyzeComparison(
    baselineSuites: SuiteResult[],
    currentSuites: SuiteResult[],
    thresholdPct: number
): { rows: ComparisonRow[]; regressions: ComparisonRow[] } {
    const baselineMap = new Map<string, BenchmarkResult>();
    for (const s of baselineSuites) {
        for (const b of s.results) {
            baselineMap.set(`${s.suiteName}:::${b.name}`, b);
        }
    }

    const rows: ComparisonRow[] = [];
    const regressions: ComparisonRow[] = [];

    for (const currentSuite of currentSuites) {
        for (const current of currentSuite.results) {
            const key = `${currentSuite.suiteName}:::${current.name}`;
            const baseline = baselineMap.get(key);

            if (!baseline) {
                rows.push({
                    suite: currentSuite.suiteName,
                    name: current.name,
                    baselineOps: 0,
                    currentOps: current.opsPerSec,
                    diffPct: 0,
                    baselineP50: 0,
                    currentP50: current.p50Ns,
                    status: 'NEW',
                });
                continue;
            }

            const diffPct = ((current.opsPerSec - baseline.opsPerSec) / baseline.opsPerSec) * 100;
            let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

            if (diffPct < -thresholdPct) {
                status = 'FAIL';
            } else if (diffPct < -(thresholdPct / 2)) {
                status = 'WARN';
            }

            const row: ComparisonRow = {
                suite: currentSuite.suiteName,
                name: current.name,
                baselineOps: baseline.opsPerSec,
                currentOps: current.opsPerSec,
                diffPct,
                baselineP50: baseline.p50Ns,
                currentP50: current.p50Ns,
                status,
            };

            rows.push(row);
            if (status === 'FAIL') {
                regressions.push(row);
            }
        }
    }

    return { rows, regressions };
}

function printConsoleReport(rows: ComparisonRow[], regressions: ComparisonRow[], thresholdPct: number): void {
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    const cyan = '\x1b[36m';
    const bold = '\x1b[1m';
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';

    console.log(`\n${bold}${cyan}================================================================================${reset}`);
    console.log(`${bold}${cyan}               PERFORMANCE REGRESSION COMPARISON REPORT                         ${reset}`);
    console.log(`${bold}${cyan}================================================================================${reset}`);
    console.log(`  Regression Threshold: ${bold}${red}-${thresholdPct}%${reset}\n`);

    const colName = 40;
    const colBase = 15;
    const colCurr = 15;
    const colDiff = 12;
    const colStatus = 10;

    const header =
        '  ' +
        'Benchmark'.padEnd(colName) +
        'Baseline'.padStart(colBase) +
        'Current'.padStart(colCurr) +
        'Delta'.padStart(colDiff) +
        '  Status';

    console.log(`${bold}${header}${reset}`);
    console.log('  ' + '-'.repeat(colName + colBase + colCurr + colDiff + colStatus));

    let currentSuite = '';
    for (const r of rows) {
        if (r.suite !== currentSuite) {
            currentSuite = r.suite;
            console.log(`\n  ${bold}${dim}[${currentSuite}]${reset}`);
        }

        const nameStr = r.name.length > colName - 2
            ? r.name.substring(0, colName - 3) + '...'
            : r.name;

        const baseStr = r.baselineOps > 0 ? formatOps(r.baselineOps) : 'N/A';
        const currStr = formatOps(r.currentOps);

        let deltaStr = `${r.diffPct >= 0 ? '+' : ''}${r.diffPct.toFixed(1)}%`;
        let statusStr = '';

        if (r.status === 'FAIL') {
            deltaStr = `${red}${deltaStr}${reset}`;
            statusStr = `${red}FAIL ❌${reset}`;
        } else if (r.status === 'WARN') {
            deltaStr = `${yellow}${deltaStr}${reset}`;
            statusStr = `${yellow}WARN ⚠️${reset}`;
        } else if (r.status === 'NEW') {
            deltaStr = `${dim}NEW${reset}`;
            statusStr = `${cyan}NEW 🆕${reset}`;
        } else {
            deltaStr = `${green}${deltaStr}${reset}`;
            statusStr = `${green}PASS ✅${reset}`;
        }

        console.log(
            '  ' +
            nameStr.padEnd(colName) +
            baseStr.padStart(colBase) +
            currStr.padStart(colCurr) +
            deltaStr.padStart(colDiff + 9) + // padding accounts for ANSI codes
            '  ' + statusStr
        );
    }

    console.log(`\n${bold}${cyan}================================================================================${reset}`);
    if (regressions.length > 0) {
        console.error(`${red}${bold}❌ REGRESSION DETECTED: ${regressions.length} benchmark(s) degraded by > ${thresholdPct}%${reset}\n`);
        for (const reg of regressions) {
            console.error(`  - ${reg.suite} > ${reg.name}: ${reg.diffPct.toFixed(1)}% (Baseline: ${formatOps(reg.baselineOps)}, Current: ${formatOps(reg.currentOps)})`);
        }
        console.error('');
    } else {
        console.log(`${green}${bold}✅ ALL BENCHMARKS PASSED: No regressions exceeding ${thresholdPct}% detected.${reset}\n`);
    }
}

function writeGitHubSummary(rows: ComparisonRow[], regressions: ComparisonRow[], thresholdPct: number): void {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
        return;
    }

    let md = `## ⚡ Performance Benchmark Regression Report\n\n`;

    if (regressions.length > 0) {
        md += `> [!CAUTION]\n`;
        md += `> **Performance Regression Detected**: ${regressions.length} benchmark(s) dropped throughput by more than **${thresholdPct}%**.\n\n`;
    } else {
        md += `> [!TIP]\n`;
        md += `> **All benchmarks passed**: Performance is within the allowable **${thresholdPct}%** tolerance margin.\n\n`;
    }

    md += `| Benchmark | Baseline Throughput | PR Throughput | Delta (%) | Status |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const r of rows) {
        const baseStr = r.baselineOps > 0 ? formatOps(r.baselineOps) : 'N/A';
        const currStr = formatOps(r.currentOps);
        const deltaStr = r.baselineOps > 0 ? `${r.diffPct >= 0 ? '+' : ''}${r.diffPct.toFixed(1)}%` : 'NEW';

        let badge = '✅ PASS';
        if (r.status === 'FAIL') badge = '❌ **FAIL**';
        else if (r.status === 'WARN') badge = '⚠️ WARN';
        else if (r.status === 'NEW') badge = '🆕 NEW';

        md += `| \`${r.name}\` | ${baseStr} | ${currStr} | ${deltaStr} | ${badge} |\n`;
    }

    md += `\n*Threshold: ${thresholdPct}% | Runner: GitHub Actions*\n`;

    try {
        fs.appendFileSync(summaryPath, md, 'utf-8');
    } catch (err) {
        console.warn('Could not write to GITHUB_STEP_SUMMARY:', err);
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.baselinePath)) {
        console.error(`Baseline file not found at: ${args.baselinePath}`);
        console.error(`Generate one first using: npm run bench:save-baseline`);
        process.exit(1);
    }

    const baselineJson = JSON.parse(fs.readFileSync(args.baselinePath, 'utf-8')) as SuiteResult[];

    let currentJson: SuiteResult[];
    if (args.currentPath) {
        if (!fs.existsSync(args.currentPath)) {
            console.error(`Current results file not found at: ${args.currentPath}`);
            process.exit(1);
        }
        currentJson = JSON.parse(fs.readFileSync(args.currentPath, 'utf-8')) as SuiteResult[];
    } else {
        console.log('Running current benchmark suite to compare against baseline...');
        const { createFastPathSuite } = require('./suites/fast-path.bench');
        const { createCoreSuite } = require('./suites/core.bench');
        const { createContextMdcSuite } = require('./suites/context-mdc.bench');
        const { createLayoutsSuite } = require('./suites/layouts.bench');
        const { createFiltersSuite } = require('./suites/filters.bench');
        const { createAppendersSuite } = require('./suites/appenders.bench');

        currentJson = [
            await createFastPathSuite().run(),
            await createCoreSuite().run(),
            await createContextMdcSuite().run(),
            await createLayoutsSuite().run(),
            await createFiltersSuite().run(),
            await createAppendersSuite().run(),
        ];
    }

    const { rows, regressions } = analyzeComparison(baselineJson, currentJson, args.thresholdPct);

    printConsoleReport(rows, regressions, args.thresholdPct);
    writeGitHubSummary(rows, regressions, args.thresholdPct);

    if (regressions.length > 0 && args.failOnRegression) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Comparison execution failed:', err);
    process.exit(1);
});
