import { LogEntry } from '../core/types';

/**
 * The tri-state decision outcome of a filter evaluation.
 * Modeled after Log4j Filter.Result.
 */
export enum FilterResult {
    /**
     * Log event is accepted immediately without checking subsequent filters or levels.
     */
    ACCEPT = 'ACCEPT',

    /**
     * Log event is dropped immediately.
     */
    DENY = 'DENY',

    /**
     * Filter has no opinion. Evaluation continues to the next filter in the chain,
     * or falls back to threshold/effective level checks.
     */
    NEUTRAL = 'NEUTRAL',
}

/**
 * Filter contract implemented by all filtering plugins.
 */
export interface Filter {
    readonly name?: string;

    /**
     * Evaluates a log entry and returns an ACCEPT, DENY, or NEUTRAL decision.
     */
    filter(entry: LogEntry): FilterResult;
}
