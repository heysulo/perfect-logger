import { LogEntry } from '../core/types';

/**
 * Interface representing a log layout (formatter/serializer).
 * Decouples how logs are formatted from the destination appender where they are written.
 */
export interface Layout {
    /** The MIME content type of the formatted output (e.g. 'text/plain', 'application/json') */
    readonly contentType: string;

    /**
     * Formats a standardized LogEntry into a string representation.
     * @param entry The log entry to format.
     */
    format(entry: LogEntry): string;
}
