import { Writable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BenchmarkSuite } from '../harness';
import {
    StreamAppender,
    FileAppender,
    AsyncAppender,
    JsonLayout,
    PatternLayout,
    LogLevel,
    LogEntry,
} from '../../src';

class NullWritable extends Writable {
    _write(_chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        callback();
    }
}

export function createAppendersSuite(): BenchmarkSuite {
    const suite = new BenchmarkSuite(
        'Appenders & I/O Throughput',
        'Measures I/O throughput across StreamAppender (in-memory), FileAppender (unbatched vs batched), and AsyncAppender.'
    );

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perfect-logger-bench-'));

    const nullStream = new NullWritable();
    const patternStreamAppender = new StreamAppender({
        stream: nullStream,
        minLevel: LogLevel.DEBUG,
    });

    const jsonStreamAppender = new StreamAppender({
        stream: nullStream,
        layout: new JsonLayout({ pretty: false }),
        minLevel: LogLevel.DEBUG,
    });

    const unbatchedFileAppender = new FileAppender({
        logDirectory: tempDir,
        fileName: 'unbatched.log',
        batchSize: 1,
        minLevel: LogLevel.DEBUG,
    });

    const batchedFileAppender = new FileAppender({
        logDirectory: tempDir,
        fileName: 'batched.log',
        batchSize: 100,
        minLevel: LogLevel.DEBUG,
    });

    const asyncTarget = new StreamAppender({
        stream: nullStream,
        minLevel: LogLevel.TRACE,
    });
    const asyncAppender = new AsyncAppender({
        target: asyncTarget,
        queueSize: 10000,
    });

    const sampleEntry: LogEntry = {
        timestamp: new Date(1725880000000),
        level: LogLevel.INFO,
        namespace: 'benchmark.appender',
        message: 'Order 98213 processed in 45ms',
        context: { orderId: 'ord_98213', amount: 120.5 },
    };

    // 1. StreamAppender
    suite.add('StreamAppender (PatternLayout)', () => {
        patternStreamAppender.log(sampleEntry);
    });

    suite.add('StreamAppender (JsonLayout)', () => {
        jsonStreamAppender.log(sampleEntry);
    });

    // 2. AsyncAppender
    suite.add('AsyncAppender wrapping StreamAppender', () => {
        asyncAppender.log(sampleEntry);
    });

    // 3. FileAppender (Batched vs Unbatched)
    suite.add(
        'FileAppender (batched, batchSize=100)',
        () => {
            batchedFileAppender.log(sampleEntry);
        },
        { warmupIterations: 1000, minDurationMs: 400, batchSize: 50 }
    );

    suite.add(
        'FileAppender (unbatched, batchSize=1)',
        async () => {
            await unbatchedFileAppender.log(sampleEntry);
        },
        { warmupIterations: 50, minDurationMs: 400, batchSize: 1 }
    );

    // Register cleanup when process exits
    const cleanup = () => {
        try {
            batchedFileAppender.destroy();
            unbatchedFileAppender.destroy();
            asyncAppender.destroy();
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    };
    process.on('exit', cleanup);

    return suite;
}
