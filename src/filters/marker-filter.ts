import { Filter, FilterResult } from './filter';
import { LogEntry } from '../core/types';
import { Marker } from '../core/marker';

export interface MarkerFilterOptions {
    /** Target marker instance or marker name to match */
    marker: Marker | string;
    onMatch?: FilterResult;
    onMismatch?: FilterResult;
}

/**
 * Filters log entries based on their attached Marker tag.
 * Supports hierarchical marker matching via `marker.contains()`.
 */
export class MarkerFilter implements Filter {
    public readonly name = 'MarkerFilter';
    private readonly marker: Marker | string;
    private readonly onMatch: FilterResult;
    private readonly onMismatch: FilterResult;

    constructor(options: MarkerFilterOptions) {
        this.marker = options.marker;
        this.onMatch = options.onMatch ?? FilterResult.ACCEPT;
        this.onMismatch = options.onMismatch ?? FilterResult.DENY;
    }

    public filter(entry: LogEntry): FilterResult {
        if (!entry.marker) {
            return this.onMismatch;
        }
        return entry.marker.contains(this.marker) ? this.onMatch : this.onMismatch;
    }
}
