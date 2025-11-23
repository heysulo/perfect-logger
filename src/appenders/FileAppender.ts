import { LogEntry, AppenderConfig } from '../core/types';
import { BaseAppender } from './BaseAppender';
import { isNode } from '../utils/environment';
import { LogLevel } from '../constants';
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

const DEFAULT_FORMAT = '{date} | {time} | {level} | {namespace} | {message}';
const DEFAULT_FILENAME = 'app.log';

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
    private readonly formatTemplate: string;
    private readonly rotation?: 'daily' | 'hourly';
    private readonly maxSize: number | null;
    private readonly maxFiles: number | null;

    private readonly dateFormatter: Intl.DateTimeFormat;
    private readonly timeFormatter: Intl.DateTimeFormat;

    private currentFilePath: string;
    private currentFileSize = 0;
    private currentFileDateMarker: string | null = null;

    constructor(config: FileAppenderConfig = {}) {
        super('FileAppender', config, { minLevel: LogLevel.INFO });

        if (!fsPromises || !fsModule || !pathModule || !process) {
            throw new Error('FileAppender cannot be used in this environment.');
        }

        this.logDirectory = config.logDirectory || pathModule.join(process.cwd(), 'logs');
        this.fileName = config.fileName || DEFAULT_FILENAME;
        this.formatTemplate = config.format || DEFAULT_FORMAT;
        
        this.rotation = config.rotation;
        this.maxSize = config.maxSize || null;
        this.maxFiles = config.maxFiles || null;

        this.dateFormatter = new Intl.DateTimeFormat(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: this.timezone,
        });
        this.timeFormatter = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, timeZone: this.timezone,
        });

        this.currentFilePath = this.getCurrentFilename();
        this.initializeState();
    }

    private async initializeState(): Promise<void> {
        if (!fsModule.existsSync(this.logDirectory)) {
            fsModule.mkdirSync(this.logDirectory, { recursive: true });
        }
        
        this.currentFilePath = this.getCurrentFilename();
        if (this.rotation) {
            this.currentFileDateMarker = this.getDateMarker(new Date());
        }

        try {
            const stats = await fsPromises.stat(this.currentFilePath);
            this.currentFileSize = stats.size;
        } catch (e) {
            this.currentFileSize = 0;
        }
    }

    public handle(entry: LogEntry): void {
        this.handleBatch([entry]);
    }

    public async handleBatch(entries: LogEntry[]): Promise<void> {
        if (!fsPromises) return;

        const logLines = entries
            .filter(entry => entry.level >= this.minLevel)
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
            await this.rotate(timeBoundaryReached);
        }
    }

    private async rotate(timeBased: boolean): Promise<void> {
        if (!pathModule) return;
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

        const archiveName = timeBased
            ? `${baseName}-${this.getDateMarker(new Date(Date.now() - 1))}${ext}` // Use previous date marker
            : `${baseName}.${archives.length + 1}${ext}`;
        
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

    private async prune(archives: string[]): Promise<void> {
        if (!this.maxFiles || !pathModule) return;

        const filesToProcess = archives.sort().reverse(); // Newest first
        
        // Delete oldest files
        if (filesToProcess.length > this.maxFiles) {
            const filesToDelete = filesToProcess.slice(this.maxFiles);
            for (const file of filesToDelete) {
                try {
                    await fsPromises.unlink(file);
                } catch (e) {
                    console.error(`Failed to delete old log file: ${file}`, e);
                }
            }
        }
    }

    private async getArchives(baseName: string): Promise<string[]> {
        if (!pathModule) return [];
        const files = await fsPromises.readdir(this.logDirectory);
        const ext = pathModule.extname(this.fileName);
        const regex = new RegExp(`^${baseName}[-.]`);
        return files
            .filter(f => f.startsWith(baseName) && f !== this.fileName && regex.test(f))
            .map(f => pathModule.join(this.logDirectory, f));
    }

    private getCurrentFilename(): string {
        if (!pathModule) return '';
        if (this.rotation && this.maxSize === null) { // Purely time-based
            return pathModule.join(this.logDirectory, `${pathModule.basename(this.fileName, pathModule.extname(this.fileName))}-${this.getDateMarker(new Date())}${pathModule.extname(this.fileName)}`);
        }
        return pathModule.join(this.logDirectory, this.fileName);
    }

    private getDateMarker(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        if (this.rotation === 'hourly') {
            const hour = date.getHours().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hour}`;
        }
        return `${year}-${month}-${day}`;
    }

    private formatLog(entry: LogEntry): string {
        const parts = this.dateFormatter.formatToParts(entry.timestamp);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        const date = `${year}/${month}/${day}`;

        const baseTime = this.timeFormatter.format(entry.timestamp);
        const milliseconds = entry.timestamp.getMilliseconds().toString().padStart(3, '0');
        const time = `${baseTime}.${milliseconds}`;

        const level = (LogLevel[entry.level] || 'UNKNOWN');
        
        let logLine = this.formatTemplate
            .replace('{date}', date)
            .replace('{time}', time)
            .replace('{level}', level)
            .replace('{namespace}', entry.namespace)
            .replace('{message}', entry.message)
            .replace('{context}', '')
            .replace('{error}', '');

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
