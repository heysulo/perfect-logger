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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        fsPromises = require('fs').promises;
        pathModule = require('path');
    } catch (e) {
        console.error('FileAppender is only available in Node.js environments.');
    }
}

const DEFAULT_FORMAT = '{date} | {time} | {level} | {namespace} | {message}';

export interface FileAppenderConfig extends AppenderConfig {
    logDirectory?: string;
    format?: string;
}

export class FileAppender extends BaseAppender {
    private readonly logDirectory: string;
    private readonly formatTemplate: string;
    private readonly fileTimestamp: string;
    private readonly dateFormatter: Intl.DateTimeFormat;
    private readonly timeFormatter: Intl.DateTimeFormat;
    private readonly initializedFiles: Set<string>;

    constructor(config: FileAppenderConfig) {
        super('FileAppender', config, { minLevel: LogLevel.INFO });

        if (!fsPromises || !fsModule || !pathModule || !process) {
            throw new Error('FileAppender cannot be used in this environment.');
        }

        this.logDirectory = config.logDirectory || pathModule.join(process.cwd(), 'logs');
        this.formatTemplate = config.format || DEFAULT_FORMAT;
        this.initializedFiles = new Set<string>();

        // Create a single timestamp for the current application session.
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        this.fileTimestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

        // Ensure the log directory exists.
        if (!fsModule.existsSync(this.logDirectory)) {
            fsModule.mkdirSync(this.logDirectory, { recursive: true });
        }

        this.dateFormatter = new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: this.timezone,
        });

        this.timeFormatter = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false,
            timeZone: this.timezone,
        });
    }

    public handle(entry: LogEntry): void {
        this.handleBatch([entry]);
    }

    public async handleBatch(entries: LogEntry[]): Promise<void> {
        if (!fsPromises || !pathModule) return;

        const groupedByNamespace = entries.reduce((acc, entry) => {
            if (!acc[entry.namespace]) {
                acc[entry.namespace] = [];
            }
            acc[entry.namespace].push(entry);
            return acc;
        }, {} as Record<string, LogEntry[]>);

        try {
            for (const namespace of Object.keys(groupedByNamespace)) {
                const filePath = pathModule.join(this.logDirectory, `${namespace}.log`);
                let logLines = groupedByNamespace[namespace]
                    .map(entry => this.formatLog(entry))
                    .join('\n');

                if (!this.initializedFiles.has(namespace)) {
                    this.setupLogFile(namespace);
                    logLines = `${this.fileTimestamp}\n${logLines}`;
                    this.initializedFiles.add(namespace);
                }

                await fsPromises.appendFile(filePath, logLines + '\n');
            }
        } catch (e) {
            console.error('Error writing to log file:', e);
        }
    }

    private setupLogFile(namespace: string): void {
        if (!fsModule || !pathModule) return;

        const filePath = pathModule.join(this.logDirectory, `${namespace}.log`);
        if (fsModule.existsSync(filePath)) {
            try {
                const content = fsModule.readFileSync(filePath, 'utf-8');
                const firstLine = content.split('\n')[0].trim();
                const timestampRegex = /^\d{14}$/;

                if (timestampRegex.test(firstLine)) {
                    const archivePath = pathModule.join(this.logDirectory, `${namespace}-${firstLine}.log`);
                    fsModule.renameSync(filePath, archivePath);
                } else {
                    fsModule.unlinkSync(filePath);
                }
            } catch (e) {
                console.error(`Failed to process existing log file ${filePath}. It will be overwritten.`, e);
            }
        }
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
