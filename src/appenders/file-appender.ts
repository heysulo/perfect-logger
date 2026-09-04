import { LogEntry, AppenderConfig } from '../core/types';
import { Layout } from '../layouts/layout';
import { BaseAppender } from './base-appender';
import { isNode } from '../utils/environment';
import { LogLevel } from '../constants';
import { LogFormatter } from '../utils/log-formatter';
import { safeStringify } from '../utils/safe-stringify';
import type * as fs from 'fs';
import type * as path from 'path';
import type * as zlib from 'zlib';

// Node.js modules are conditionally required
let fsPromises: typeof fs.promises | null = null;
let fsModule: typeof fs | null = null;
let pathModule: typeof path | null = null;
let zlibModule: typeof zlib | null = null;

if (isNode()) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        fsModule = require('fs');
        fsPromises = fsModule ? fsModule.promises : null;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        pathModule = require('path');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        zlibModule = require('zlib');
    } catch (e) {
        console.error('FileAppender is only available in Node.js environments.');
    }
}

export interface FileAppenderConfig extends AppenderConfig {
    logDirectory?: string;
    fileName?: string;
    format?: string;
    rotation?: 'daily' | 'hourly';
    maxSize?: number; // in bytes
    maxFiles?: number;
    /**
     * If true, archive files are compressed with gzip (.gz) on rollover.
     * Uses Node.js built-in zlib with zero external dependencies.
     */
    compress?: boolean;
}

/**
 * Industrial-grade file appender with size-based rotation, time-based rotation
 * (daily/hourly), history pruning (`maxFiles`), and native gzip compression (`compress: true`).
 * All file I/O operations are serialized with an internal write queue to prevent race conditions.
 *
 * @example
 * ```ts
 * const appender = new FileAppender({
 *   logDirectory: 'logs',
 *   fileName: 'server.log',
 *   rotation: 'daily',
 *   maxSize: 10 * 1024 * 1024, // 10 MB
 *   maxFiles: 7,
 *   compress: true,
 * });
 * ```
 */
export class FileAppender extends BaseAppender {
    public readonly layout: Layout;
    private readonly logDirectory: string;
    private readonly fileName: string;
    private readonly formatter: LogFormatter;
    private readonly rotation?: 'daily' | 'hourly';
    private readonly maxSize: number | null;
    private readonly maxFiles: number | null;
    private readonly compress: boolean;

    /**
     * Intl.DateTimeFormat used to extract timezone-aware date parts for rotation markers.
     * This ensures getDateMarker() respects the configured timezone. (B4 fix)
     */
    private readonly markerFormatter: Intl.DateTimeFormat;

    private currentFilePath: string;
    private currentFileSize = 0;
    private currentFileDateMarker: string | null = null;

    /**
     * Write mutex to serialize handleBatch calls and prevent concurrent rotation. (B6 fix)
     */
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(config: FileAppenderConfig = {}) {
        super('FileAppender', config, { minLevel: LogLevel.INFO });

        if (!fsPromises || !fsModule || !pathModule || !process) {
            throw new Error('FileAppender cannot be used in this environment.');
        }

        this.logDirectory = config.logDirectory || pathModule.join(process.cwd(), 'logs');
        this.fileName = config.fileName || 'app.log';
        this.formatter = new LogFormatter(config.format, this.timezone);
        this.layout = config.layout || {
            contentType: 'text/plain',
            format: (entry: LogEntry): string => {
                let logLine = this.formatter.format(entry);

                if (entry.context) {
                    const prettyContext = safeStringify(entry.context, null, 4);
                    const indentedContext = prettyContext.split('\n').map(line => `~ ${line}`).join('\n');
                    logLine += `\n${indentedContext}`;
                }

                if (entry.error) {
                    logLine += `\n${entry.error.stack || entry.error.message}`;
                }

                return logLine;
            },
        };

        this.rotation = config.rotation;
        this.maxSize = config.maxSize ?? null;  // Q5: nullish instead of falsy
        this.maxFiles = config.maxFiles ?? null; // Q5: nullish instead of falsy
        this.compress = config.compress ?? false;

        // B4: Use Intl.DateTimeFormat for timezone-aware date markers
        this.markerFormatter = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hour12: false,
            timeZone: this.timezone,
        });

        // B2: Synchronous initialization — no async race condition
        this.initializeStateSync();
        this.currentFilePath = this.getCurrentFilename();
    }

    /**
     * B2 fix: Fully synchronous initialization to avoid constructor race conditions.
     */
    private initializeStateSync(): void {
        const fs = fsModule;
        if (!fs) return;

        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }

        if (this.rotation) {
            this.currentFileDateMarker = this.getDateMarker(new Date());
        }

        // Set initial file path before checking size
        this.currentFilePath = this.getCurrentFilename();

        try {
            const stats = fs.statSync(this.currentFilePath);
            this.currentFileSize = stats.size;
        } catch (e) {
            this.currentFileSize = 0;
        }
    }

    /**
     * Enqueues a single log entry to be written to the active log file.
     * @param entry The log entry to write.
     */
    public handle(entry: LogEntry): void {
        this.handleBatch([entry]);
    }

    /**
     * R7: Removed redundant minLevel filter — BaseAppender.log() already filters.
     * B6: All writes are serialized through writeQueue to prevent concurrent rotation.
     */
    public handleBatch(entries: LogEntry[]): void {
        if (!fsPromises) return;

        this.writeQueue = this.writeQueue
            .then(() => this.writeBatch(entries))
            .catch(e => {
                console.error('Error processing FileAppender writeQueue batch:', e);
            });
    }

    /**
     * Flushes all buffered log entries and waits until all pending disk I/O operations
     * in the internal write queue are completely finished.
     */
    public override async flush(): Promise<void> {
        await super.flush();
        await this.writeQueue;
    }

    private async writeBatch(entries: LogEntry[]): Promise<void> {
        if (!fsPromises) return;

        const logLines = entries
            .map(entry => this.formatLog(entry))
            .join('\n');

        if (!logLines) {
            return;
        }

        const logBuffer = Buffer.from(logLines + '\n', 'utf-8');

        try {
            await this.checkForRotation(logBuffer.length);
            await fsPromises.appendFile(this.currentFilePath, logBuffer);
            this.currentFileSize += logBuffer.length;
        } catch (e) {
            console.error('Error writing to log file:', e);
        }
    }

    private async checkForRotation(bytesToAdd: number): Promise<void> {
        const timeBoundaryReached = this.rotation && this.getDateMarker(new Date()) !== this.currentFileDateMarker;
        const sizeBoundaryReached = this.maxSize !== null && (this.currentFileSize + bytesToAdd > this.maxSize);

        if (timeBoundaryReached || sizeBoundaryReached) {
            await this.rotate(!!timeBoundaryReached);
        }
    }

    private async rotate(timeBased: boolean): Promise<void> {
        if (!pathModule || !fsPromises) return;
        const oldPath = this.currentFilePath;

        // Determine the new path for the current log file
        if (timeBased) {
            this.currentFileDateMarker = this.getDateMarker(new Date());
        }
        this.currentFilePath = this.getCurrentFilename();
        this.currentFileSize = 0;

        // Archive the old file
        try {
            // If file doesn't exist, no need to rotate it.
            await fsPromises.access(oldPath);
        } catch {
            return;
        }

        const ext = pathModule.extname(this.fileName);
        const baseName = pathModule.basename(this.fileName, ext);
        const archives = await this.getArchives(baseName);

        let archiveName: string;
        if (timeBased) {
            // Use previous date marker for the archive name
            archiveName = `${baseName}-${this.getDateMarker(new Date(Date.now() - 1))}${ext}`;
        } else {
            // B5: Parse highest existing numeric suffix instead of using array length
            const maxSuffix = this.getMaxNumericSuffix(archives, baseName, ext);
            archiveName = `${baseName}.${maxSuffix + 1}${ext}`;
        }

        const archivePath = pathModule.join(this.logDirectory, archiveName);

        try {
            await this.safeRename(oldPath, archivePath);
        } catch (e) {
            console.error(`Failed to rotate log file from ${oldPath} to ${archivePath}`, e);
            return;
        }

        let finalArchivePath = archivePath;
        const zlib = zlibModule;
        if (this.compress && zlib) {
            try {
                const uncompressed = await fsPromises.readFile(archivePath);
                const gzipped = await new Promise<Buffer>((resolve, reject) => {
                    zlib.gzip(uncompressed, (err, res) => {
                        if (err) reject(err);
                        else resolve(res);
                    });
                });
                const gzPath = `${archivePath}.gz`;
                await fsPromises.writeFile(gzPath, gzipped);
                await this.safeUnlink(archivePath);
                finalArchivePath = gzPath;
            } catch (e) {
                console.error(`Failed to compress rotated log file ${archivePath}`, e);
            }
        }

        // Prune
        await this.prune([finalArchivePath, ...archives]);
    }

    /**
     * Retries rename on Windows locking errors (EPERM, EBUSY, EACCES)
     * caused by OS file handle close latency or antivirus scanners.
     */
    private async safeRename(oldPath: string, newPath: string, retries = 5, delayMs = 50): Promise<void> {
        if (!fsPromises) return;
        for (let i = 0; i <= retries; i++) {
            try {
                await fsPromises.rename(oldPath, newPath);
                return;
            } catch (err: any) {
                const isLockError = err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES');
                if (isLockError && i < retries) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                throw err;
            }
        }
    }

    /**
     * Retries unlink on Windows locking errors (EPERM, EBUSY, EACCES)
     * caused by OS file handle close latency or antivirus scanners.
     */
    private async safeUnlink(filePath: string, retries = 5, delayMs = 50): Promise<void> {
        if (!fsPromises) return;
        for (let i = 0; i <= retries; i++) {
            try {
                await fsPromises.unlink(filePath);
                return;
            } catch (err: any) {
                const isLockError = err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES');
                if (isLockError && i < retries) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                throw err;
            }
        }
    }

    /**
     * B5 fix: Find the highest numeric suffix among existing archives
     * so we never overwrite an existing archive file. Supports compressed .gz archives.
     */
    private getMaxNumericSuffix(archives: string[], baseName: string, ext: string): number {
        let max = 0;
        const path = pathModule;
        if (!path) return max;
        const regex = new RegExp(`^${this.escapeRegex(baseName)}\\.(\\d+)${this.escapeRegex(ext)}(\\.gz)?$`);
        for (const archive of archives) {
            const fileName = path.basename(archive);
            const match = fileName.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > max) max = num;
            }
        }
        return max;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async prune(archives: string[]): Promise<void> {
        const fsP = fsPromises;
        if (!this.maxFiles || !pathModule || !fsP) return;

        const filesToProcess = archives.sort().reverse(); // Newest first

        // Delete oldest files
        if (filesToProcess.length > this.maxFiles) {
            const filesToDelete = filesToProcess.slice(this.maxFiles);
            for (const file of filesToDelete) {
                try {
                    await this.safeUnlink(file);
                } catch (e) {
                    console.error(`Failed to delete old log file: ${file}`, e);
                }
            }
        }
    }

    private async getArchives(baseName: string): Promise<string[]> {
        const path = pathModule;
        const fsP = fsPromises;
        if (!path || !fsP) return [];
        const files = await fsP.readdir(this.logDirectory);
        const regex = new RegExp(`^${this.escapeRegex(baseName)}[-.]`);
        return files
            .filter(f => f.startsWith(baseName) && f !== this.fileName && regex.test(f))
            .map(f => path.join(this.logDirectory, f));
    }

    private getCurrentFilename(): string {
        if (!pathModule) return '';
        if (this.rotation && this.maxSize === null) { // Purely time-based
            const ext = pathModule.extname(this.fileName);
            const base = pathModule.basename(this.fileName, ext);
            return pathModule.join(this.logDirectory, `${base}-${this.getDateMarker(new Date())}${ext}`);
        }
        return pathModule.join(this.logDirectory, this.fileName);
    }

    /**
     * B4 fix: Uses Intl.DateTimeFormat to extract timezone-aware date parts,
     * so rotation boundaries match the configured timezone.
     */
    private getDateMarker(date: Date): string {
        const parts = this.markerFormatter.formatToParts(date);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;

        if (this.rotation === 'hourly') {
            const hour = parts.find(p => p.type === 'hour')?.value;
            return `${year}-${month}-${day}T${hour}`;
        }
        return `${year}-${month}-${day}`;
    }

    /**
     * Delegates to the configured Layout.
     */
    private formatLog(entry: LogEntry): string {
        return this.layout.format(entry);
    }
}

export { FileAppender as RollingFileAppender };
