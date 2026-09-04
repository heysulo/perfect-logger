import { Filter, FilterResult } from './filter';
import { LogEntry } from '../core/types';
import { LogLevel } from '../constants';

export interface ThresholdFilterOptions {
    level: LogLevel;
    onMatch?: FilterResult;
    onMismatch?: FilterResult;
}

/**
 * Filters log entries based on a minimum log level threshold.
 */
export class ThresholdFilter implements Filter {
    public readonly name = 'ThresholdFilter';
    private readonly level: LogLevel;
    private readonly onMatch: FilterResult;
    private readonly onMismatch: FilterResult;

    constructor(options: ThresholdFilterOptions) {
        this.level = options.level;
        this.onMatch = options.onMatch ?? FilterResult.ACCEPT;
        this.onMismatch = options.onMismatch ?? FilterResult.DENY;
    }

    public filter(entry: LogEntry): FilterResult {
        return entry.level >= this.level ? this.onMatch : this.onMismatch;
    }
}
