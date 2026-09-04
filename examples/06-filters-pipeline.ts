/**
 * Example 06: Tri-State Filter Pipeline
 *
 * Demonstrates Log4j-style tri-state filtering (ACCEPT, DENY, NEUTRAL):
 * - ACCEPT: Log is processed immediately without further checks
 * - DENY: Log is dropped immediately
 * - NEUTRAL: Decision is deferred to the next filter or level threshold
 *
 * Filters covered:
 * - RegexFilter: Suppressing noisy health check endpoints
 * - ContextFilter: Elevating log verbosity for VIP tenants or canary users
 * - CompositeFilter: Composing multiple filters in sequence
 *
 * Run with:
 *   npx ts-node examples/06-filters-pipeline.ts
 */

import {
    LogManager,
    ConsoleAppender,
    LogLevel,
    RegexFilter,
    ContextFilter,
    CompositeFilter,
    FilterResult,
    MDC,
} from '../src';

console.log('=== Tri-State Filter Pipeline Demo ===\n');

// 1. Create a RegexFilter to drop noisy health-checks and metric scraping
// If message matches health check, DENY it. Otherwise NEUTRAL (allow other filters to decide).
const noiseFilter = new RegexFilter({
    regex: /GET \/(healthz|ready|metrics)/,
    onMatch: FilterResult.DENY,
    onMismatch: FilterResult.NEUTRAL,
});

// 2. Create a ContextFilter to ACCEPT all logs for VIP tenant regardless of level
const vipTenantFilter = new ContextFilter({
    key: 'tenantId',
    value: 'vip-enterprise',
    onMatch: FilterResult.ACCEPT,
    onMismatch: FilterResult.NEUTRAL,
});

// 3. Compose them using CompositeFilter
const filterPipeline = new CompositeFilter([
    noiseFilter,
    vipTenantFilter,
]);

// 4. Configure LogManager with WARN level by default
// Normal logs below WARN are ignored, BUT VIP tenant logs are ACCEPTed by filterPipeline!
LogManager.configure({
    minLevel: LogLevel.WARN,
    filters: filterPipeline,
    appenders: [
        new ConsoleAppender({
            minLevel: LogLevel.DEBUG,
            format: '[%p] [%c] %X - %m',
        }),
    ],
});

const logger = LogManager.getLogger('api.router');

console.log('--- 1. Testing Noisy Health-Check Logs (Should be DENIED) ---');
logger.warn('GET /healthz HTTP/1.1 - 200 OK'); // Normally WARN prints, but RegexFilter DENIES it!
logger.info('GET /metrics HTTP/1.1 - 200 OK');

console.log('(Notice: No health-check logs appeared above)\n');

console.log('--- 2. Testing Standard Non-VIP Logs (Default level WARN) ---');
MDC.run({ tenantId: 'standard-user-1' }, () => {
    logger.info('Standard user initiated data export'); // Dropped (below WARN and filter returned NEUTRAL)
    logger.warn('Standard user approaching monthly quota limit'); // Logged (WARN)
});

console.log('\n--- 3. Testing VIP Tenant Logs (Accepted by ContextFilter at any level) ---');
MDC.run({ tenantId: 'vip-enterprise' }, () => {
    logger.debug('VIP Tenant: Cache miss on product catalog'); // Logged even though minLevel is WARN!
    logger.info('VIP Tenant: Processed bulk order totaling $50,000'); // Logged!
});

console.log('\nFilter pipeline example completed successfully.');
