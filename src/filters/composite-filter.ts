import { Filter, FilterResult } from './filter';
import { LogEntry } from '../core/types';

/**
 * Evaluates a sequence of filters in order.
 * Short-circuits on the first non-NEUTRAL (ACCEPT or DENY) result.
 * If all filters return NEUTRAL, returns NEUTRAL.
 */
export class CompositeFilter implements Filter {
    public readonly name = 'CompositeFilter';
    private readonly filters: Filter[];

    constructor(filters: Filter[] = []) {
        this.filters = [...filters];
    }

    public addFilter(filter: Filter): this {
        this.filters.push(filter);
        return this;
    }

    public getFilters(): Filter[] {
        return [...this.filters];
    }

    public filter(entry: LogEntry): FilterResult {
        for (const filter of this.filters) {
            const result = filter.filter(entry);
            if (result !== FilterResult.NEUTRAL) {
                return result;
            }
        }
        return FilterResult.NEUTRAL;
    }
}
