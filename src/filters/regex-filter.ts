import { Filter, FilterResult } from './filter';
import { LogEntry } from '../core/types';

export interface RegexFilterOptions {
    /** Regular expression pattern or string to test against the log message */
    regex: RegExp | string;
    onMatch?: FilterResult;
    onMismatch?: FilterResult;
}

/**
 * Filters log entries based on a regular expression match against the message.
 */
export class RegexFilter implements Filter {
    public readonly name = 'RegexFilter';
    private readonly regex: RegExp;
    private readonly onMatch: FilterResult;
    private readonly onMismatch: FilterResult;

    constructor(options: RegexFilterOptions) {
        this.regex = typeof options.regex === 'string' ? new RegExp(options.regex) : options.regex;
        this.onMatch = options.onMatch ?? FilterResult.ACCEPT;
        this.onMismatch = options.onMismatch ?? FilterResult.DENY;
    }

    public filter(entry: LogEntry): FilterResult {
        return this.regex.test(entry.message) ? this.onMatch : this.onMismatch;
    }
}
