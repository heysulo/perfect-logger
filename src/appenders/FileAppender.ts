import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './BaseAppender';
import { isNode } from '../utils/environment';
import { LogLevel } from '../constants';
import { LogFormatter } from '../utils/LogFormatter';
import { safeStringify } from '../utils/safeStringify';
import type * as fs from 'fs';
import type * as path from 'path';

// Node.js modules are conditionally required
let fsPromises: typeof fs.promises | null = null;
let fsModule: typeof fs | null = null;
let pathModule: typeof path | null = null;

if (isNode()) {
    try {
        fsModule = require('fs');
        fsPromises = require('fs').promises;
        pathModule = require('path');
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
}

export class FileAppender extends BaseAppender {
    private readonly logDirectory: string;
    private readonly fileName: string;
    private readonly formatter: LogFormatter;
    private readonly rotation?: 'daily' | 'hourly';
    private readonly maxSize: number | null;
    private readonly maxFiles: number | null;

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

        this.rotation = config.rotation;
        this.maxSize = config.maxSize ?? null;  // Q5: nullish instead of falsy
        this.maxFiles = config.maxFiles ?? null; // Q5: nullish instead of falsy

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
        if (!fsModule!.existsSync(this.logDirectory)) {
            fsModule!.mkdirSync(this.logDirectory, { recursive: true });
        }

        if (this.rotation) {
            this.currentFileDateMarker = this.getDateMarker(new Date());
        }

        // Set initial file path before checking size
        this.currentFilePath = this.getCurrentFilename();

        try {
            const stats = fsModule!.statSync(this.currentFilePath);
            this.currentFileSize = stats.size;
        } catch (e) {
            this.currentFileSize = 0;
        }
    }

    public handle(entry: LogEntry): void {
        this.handleBatch([entry]);
    }

    /**
     * R7: Removed redundant minLevel filter — BaseAppender.log() already filters.
     * B6: All writes are serialized through writeQueue to prevent concurrent rotation.
     */
    public handleBatch(entries: LogEntry[]): void {
        if (!fsPromises) return;

        this.writeQueue = this.writeQueue.then(() => this.writeBatch(entries));
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
            await fsPromises.rename(oldPath, archivePath);
        } catch (e) {
            console.error(`Failed to rotate log file from ${oldPath} to ${archivePath}`, e);
            return;
        }

        // Prune
        await this.prune([archivePath, ...archives]);
    }

    /**
     * B5 fix: Find the highest numeric suffix among existing archives
     * so we never overwrite an existing archive file.
     */
    private getMaxNumericSuffix(archives: string[], baseName: string, ext: string): number {
        let max = 0;
        const regex = new RegExp(`^${this.escapeRegex(baseName)}\\.(\\d+)${this.escapeRegex(ext)}$`);
        for (const archive of archives) {
            const fileName = pathModule!.basename(archive);
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
        if (!this.maxFiles || !pathModule) return;

        const filesToProcess = archives.sort().reverse(); // Newest first

        // Delete oldest files
        if (filesToProcess.length > this.maxFiles) {
            const filesToDelete = filesToProcess.slice(this.maxFiles);
            for (const file of filesToDelete) {
                try {
                    await fsPromises!.unlink(file);
                } catch (e) {
                    console.error(`Failed to delete old log file: ${file}`, e);
                }
            }
        }
    }

    private async getArchives(baseName: string): Promise<string[]> {
        if (!pathModule || !fsPromises) return [];
        const files = await fsPromises.readdir(this.logDirectory);
        const ext = pathModule.extname(this.fileName);
        const regex = new RegExp(`^${this.escapeRegex(baseName)}[-.]`);
        return files
            .filter(f => f.startsWith(baseName) && f !== this.fileName && regex.test(f))
            .map(f => pathModule!.join(this.logDirectory, f));
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
     * R5: Uses shared LogFormatter for consistent formatting with ConsoleAppender.
     */
    private formatLog(entry: LogEntry): string {
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
    }
}
