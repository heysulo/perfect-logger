import { Filter, FilterResult } from './filter';
import { LogEntry } from '../core/types';

export interface ContextFilterOptions<T = unknown> {
    /** Context key to inspect */
    key: string;
    /** Exact value match */
    value?: T;
    /** Custom predicate for matching the context value */
    predicate?: (value: T) => boolean;
    onMatch?: FilterResult;
    onMismatch?: FilterResult;
}

/**
 * Filters log entries based on context metadata (e.g., userId, tenantId, requestId).
 */
export class ContextFilter<T = unknown> implements Filter {
    public readonly name = 'ContextFilter';
    private readonly key: string;
    private readonly value?: T;
    private readonly predicate?: (value: T) => boolean;
    private readonly onMatch: FilterResult;
    private readonly onMismatch: FilterResult;

    constructor(options: ContextFilterOptions<T>) {
        this.key = options.key;
        this.value = options.value;
        this.predicate = options.predicate;
        this.onMatch = options.onMatch ?? FilterResult.ACCEPT;
        this.onMismatch = options.onMismatch ?? FilterResult.DENY;
    }

    public filter(entry: LogEntry): FilterResult {
        if (!entry.context || !(this.key in entry.context)) {
            return this.onMismatch;
        }
        const val = entry.context[this.key];
        if (this.predicate) {
            return this.predicate(val as T) ? this.onMatch : this.onMismatch;
        }
        if (this.value !== undefined) {
            return val === this.value ? this.onMatch : this.onMismatch;
        }
        return this.onMatch;
    }
}
