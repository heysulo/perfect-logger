import { Layout } from './layout';
import { LogEntry } from '../core/types';
import { LogLevel } from '../constants';
import { safeStringify } from '../utils/safe-stringify';

export interface JsonLayoutFieldNames {
    timestamp?: string;
    level?: string;
    logger?: string;
    message?: string;
    marker?: string;
    context?: string;
    error?: string;
}

export interface JsonLayoutOptions {
    /**
     * Whether to pretty-print JSON with 2-space indentation.
     * Default: false (compact single-line JSON).
     */
    pretty?: boolean;

    /**
     * Timestamp representation in JSON.
     * 'iso' outputs ISO 8601 string (e.g., '2026-09-05T00:00:00.000Z').
     * 'epoch' outputs numeric milliseconds since UNIX epoch.
     * Default: 'iso'.
     */
    timestampFormat?: 'iso' | 'epoch';

    /**
     * Optional custom property names in the output JSON.
     * Useful for matching OpenTelemetry, Datadog, or Elasticsearch naming conventions.
     */
    fieldNames?: JsonLayoutFieldNames;

    /**
     * Whether to include the context object if present.
     * Default: true.
     */
    includeContext?: boolean;

    /**
     * Whether to include error details (name, message, stack) if present.
     * Default: true.
     */
    includeError?: boolean;
}

export class JsonLayout implements Layout {
    public readonly contentType = 'application/json';
    private readonly pretty: boolean;
    private readonly timestampFormat: 'iso' | 'epoch';
    private readonly includeContext: boolean;
    private readonly includeError: boolean;
    private readonly fieldNames: Required<JsonLayoutFieldNames>;

    constructor(options: JsonLayoutOptions = {}) {
        this.pretty = options.pretty ?? false;
        this.timestampFormat = options.timestampFormat ?? 'iso';
        this.includeContext = options.includeContext ?? true;
        this.includeError = options.includeError ?? true;

        this.fieldNames = {
            timestamp: options.fieldNames?.timestamp ?? 'timestamp',
            level: options.fieldNames?.level ?? 'level',
            logger: options.fieldNames?.logger ?? 'namespace',
            message: options.fieldNames?.message ?? 'message',
            marker: options.fieldNames?.marker ?? 'marker',
            context: options.fieldNames?.context ?? 'context',
            error: options.fieldNames?.error ?? 'error',
        };
    }

    public format(entry: LogEntry): string {
        const output: Record<string, unknown> = {};

        // 1. Timestamp
        output[this.fieldNames.timestamp] =
            this.timestampFormat === 'epoch'
                ? entry.timestamp.getTime()
                : entry.timestamp.toISOString();

        // 2. Level
        output[this.fieldNames.level] = LogLevel[entry.level] || 'UNKNOWN';

        // 3. Logger / Namespace
        output[this.fieldNames.logger] = entry.namespace;

        // 4. Message
        output[this.fieldNames.message] = entry.message;

        // 5. Marker
        if (entry.marker) {
            output[this.fieldNames.marker] = entry.marker.name;
        }

        // 6. Context
        if (this.includeContext && entry.context && Object.keys(entry.context).length > 0) {
            output[this.fieldNames.context] = entry.context;
        }

        // 6. Error
        if (this.includeError && entry.error) {
            output[this.fieldNames.error] = {
                name: entry.error.name,
                message: entry.error.message,
                stack: entry.error.stack,
            };
        }

        return safeStringify(output, null, this.pretty ? 2 : undefined);
    }
}
