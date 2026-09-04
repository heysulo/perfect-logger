# perfect-logger Examples

This directory contains executable TypeScript examples demonstrating the enterprise architecture and features of **perfect-logger (v4.0.0)**.

---

## Prerequisites

Before running the examples, ensure dependencies are installed and the library is built:

```bash
npm install
npm run build
```

You can execute any example directly using `npx ts-node`:

```bash
npx ts-node examples/<example-file>.ts
```

---

## Example Index

| File | Description | Command |
| :--- | :--- | :--- |
| [`01-quick-start.ts`](./01-quick-start.ts) | Out-of-the-box `defaultLogger`, central `LogManager.configure()`, log levels, metadata, and error handling. | `npx ts-node examples/01-quick-start.ts` |
| [`02-hierarchical-loggers.ts`](./02-hierarchical-loggers.ts) | Log4j-style dot-notated logger tree (`api.services.auth`), level inheritance, additivity bubbling, and isolation. | `npx ts-node examples/02-hierarchical-loggers.ts` |
| [`03-mdc-async-context.ts`](./03-mdc-async-context.ts) | Mapped Diagnostic Context (MDC) using `AsyncLocalStorage`, `MDC.run()`, `MDC.put()`, and concurrent async isolation. | `npx ts-node examples/03-mdc-async-context.ts` |
| [`04-layouts-pattern-and-json.ts`](./04-layouts-pattern-and-json.ts) | Decoupled layouts: `PatternLayout` (conversion specifiers) and `JsonLayout` (structured NDJSON for ELK/Datadog). | `npx ts-node examples/04-layouts-pattern-and-json.ts` |
| [`05-semantic-markers.ts`](./05-semantic-markers.ts) | SLF4J/Log4j `Marker` tagging (`SECURITY`, `AUDIT`), parent-child marker trees, and `MarkerFilter` routing. | `npx ts-node examples/05-semantic-markers.ts` |
| [`06-filters-pipeline.ts`](./06-filters-pipeline.ts) | Tri-state filtering (`ACCEPT`, `DENY`, `NEUTRAL`), suppressing noise via `RegexFilter`, and VIP bypass via `ContextFilter`. | `npx ts-node examples/06-filters-pipeline.ts` |
| [`07-advanced-appenders.ts`](./07-advanced-appenders.ts) | High-performance `StreamAppender`, non-blocking `AsyncAppender` with bounded queues, `RollingFileAppender`, and `CallbackAppender`. | `npx ts-node examples/07-advanced-appenders.ts` |
| [`08-declarative-config.ts`](./08-declarative-config.ts) | Zero-code setup with [`logger.config.json`](./logger.config.json), dynamic env interpolation (`${env:LOG_LEVEL:-INFO}`), and auto-configuration. | `npx ts-node examples/08-declarative-config.ts` |


