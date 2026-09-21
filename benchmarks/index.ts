import * as os from 'os';
import { printSuiteResult, SuiteResult } from './harness';
import { createFastPathSuite } from './suites/fast-path.bench';
import { createCoreSuite } from './suites/core.bench';
import { createContextMdcSuite } from './suites/context-mdc.bench';
import { createLayoutsSuite } from './suites/layouts.bench';
import { createFiltersSuite } from './suites/filters.bench';
import { createAppendersSuite } from './suites/appenders.bench';

interface CliArgs {
    suite?: string;
    filter?: string;
    json?: boolean;
    help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
    const parsed: CliArgs = {};
    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
        } else if (arg === '--json') {
            parsed.json = true;
        } else if (arg.startsWith('--suite=')) {
            parsed.suite = arg.substring('--suite='.length).toLowerCase();
        } else if (arg.startsWith('--filter=')) {
            parsed.filter = arg.substring('--filter='.length);
        }
    }
    return parsed;
}

function showHelp(): void {
    console.log(`
perfect-logger Performance Benchmark Suite

Usage:
  npm run benchmark [options]
  ts-node benchmarks/index.ts [options]

Options:
  --suite=<name>     Run only a specific suite:
                     fast-path | core | context | layouts | filters | appenders
  --filter=<string>  Filter individual benchmarks by name substring
  --json             Output results as formatted JSON
  --help, -h         Show this help message

Examples:
  npm run benchmark
  npm run benchmark -- --suite=fast-path
  npm run benchmark -- --suite=layouts --filter=json
  npm run benchmark -- --json
`);
}

async function main(): Promise<void> {
    const cliArgs = parseArgs(process.argv.slice(2));

    if (cliArgs.help) {
        showHelp();
        process.exit(0);
    }

    const suitesMap: Record<string, () => ReturnType<typeof createFastPathSuite>> = {
        'fast-path': createFastPathSuite,
        'core': createCoreSuite,
        'context': createContextMdcSuite,
        'layouts': createLayoutsSuite,
        'filters': createFiltersSuite,
        'appenders': createAppendersSuite,
    };

    const targetSuiteKeys = cliArgs.suite
        ? Object.keys(suitesMap).filter(k => k.includes(cliArgs.suite!))
        : Object.keys(suitesMap);

    if (targetSuiteKeys.length === 0) {
        console.error(`Unknown suite: "${cliArgs.suite}". Available suites: ${Object.keys(suitesMap).join(', ')}`);
        process.exit(1);
    }

    if (!cliArgs.json) {
        const cpus = os.cpus();
        const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';
        console.log('\n================================================================================');
        console.log('              perfect-logger Performance Benchmark Suite');
        console.log('================================================================================');
        console.log(`Environment:`);
        console.log(`  Node.js:  ${process.version}`);
        console.log(`  V8:       ${process.versions.v8}`);
        console.log(`  OS:       ${os.type()} ${os.release()} (${os.arch()})`);
        console.log(`  CPU:      ${cpuModel} (${cpus.length} cores)`);
        console.log(`  Memory:   ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`);
        console.log('================================================================================');
    }

    const allResults: SuiteResult[] = [];

    for (const key of targetSuiteKeys) {
        if (typeof (global as any).gc === 'function') {
            (global as any).gc();
        }
        const suiteFactory = suitesMap[key];
        const suite = suiteFactory();
        const result = await suite.run(cliArgs.filter);

        allResults.push(result);

        if (!cliArgs.json) {
            printSuiteResult(result);
        }
    }

    if (cliArgs.json) {
        console.log(JSON.stringify(allResults, null, 2));
    } else {
        console.log('--------------------------------------------------------------------------------');
        console.log('✓ All benchmark suites completed successfully.\n');
    }
}

main().catch(err => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
});
