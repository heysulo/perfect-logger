# perfect-logger

[![npm version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://www.npmjs.com/package/perfect-logger)
[![tests](https://img.shields.io/badge/tests-252%20passed-brightgreen.svg)]()
[![coverage](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)]()
[![dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)]()
[![types](https://img.shields.io/badge/TypeScript-strict-blue.svg)]()
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

An enterprise-grade, zero-dependency, isomorphic logging framework for TypeScript and JavaScript applications. Designed with the architectural rigor of **Apache Log4j 2** and the ergonomic clarity of **SLF4J / Logback**, `perfect-logger` brings battle-tested logging patterns to Node.js and modern browsers.

---

## Highlights

* 🚀 **Zero Dependencies**: Pure TypeScript/JavaScript with absolutely zero external runtime dependencies.
* 🌐 **Truly Isomorphic**: Consistent API across Node.js runtimes and modern browsers.
* 🌳 **Hierarchical Logger Tree**: Dot-notated logger names (e.g. `api.services.auth`) with level inheritance and configurable additivity bubbling.
* 🧩 **Decoupled Layouts**: Distinct `PatternLayout` (Log4j conversion specifiers) and `JsonLayout` (structured JSON with custom field mappings and ISO8601/epoch timestamps).
* 🧵 **Mapped Diagnostic Context (MDC)**: Automatic context propagation across async call stacks via Node.js `AsyncLocalStorage` with browser fallback.
* 🏷️ **First-Class Markers**: Semantic tagging (`SECURITY`, `AUDIT`, `PERF`) with hierarchical parent-child relationships and containment queries.
* 🎛️ **Tri-State Filter Pipeline**: `ACCEPT`, `DENY`, and `NEUTRAL` decisions via `ThresholdFilter`, `MarkerFilter`, `RegexFilter`, `ContextFilter`, and `CompositeFilter`.
* ⚡ **High-Throughput Appenders**:
  * **`AsyncAppender`**: Decouples logging I/O to background workers with bounded queues and overflow policies (`DISCARD`, `DISCARD_OLDEST`, `BLOCK`).
  * **`RollingFileAppender`**: Size- and time-based rotation (daily/hourly), automatic pruning (`maxFiles`), and native gzip compression (`compress: true`).
  * **`StreamAppender`**: High-throughput writing directly to `process.stdout`, `process.stderr`, or any Node.js `WritableStream`.
  * **`HttpAppender`**: Zero-dependency remote log transport using Node.js native `http`/`https` or browser `fetch`, batching, and exponential retry.
  * **`ConsoleAppender`**: Colored, formatted terminal/browser console output.
  * **`CallbackAppender`**: Custom programmatic hooks for monitoring, metrics, or test asserting.
* ⚙️ **Declarative Configuration**: Zero-code setup with `logger.config.json` or `logger.config.js`, auto-configuration, and runtime environment variable interpolation (`${env:LOG_LEVEL:-INFO}`).
* 🛡️ **TypeScript Strict**: 100% typed, strict null checks, zero `any`, and built-in `.d.ts` + declaration maps for instant IDE navigation.
* 📦 **Dual Publishing**: Native CommonJS and modern ESM output.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Executable Examples](#executable-examples)
- [Core Architecture](#core-architecture)
  - [Hierarchical Loggers & Additivity](#hierarchical-loggers--additivity)
  - [Mapped Diagnostic Context (MDC)](#mapped-diagnostic-context-mdc)
  - [Semantic Markers](#semantic-markers)
  - [Tri-State Filters](#tri-state-filters)
  - [Layouts](#layouts)
  - [Appenders](#appenders)
- [Declarative Configuration](#declarative-configuration)
- [Performance & Best Practices](#performance--best-practices)
- [API Reference](#api-reference)
- [License](#license)

---

## Installation

```bash
# npm
npm install perfect-logger

# yarn
yarn add perfect-logger

# pnpm
pnpm add perfect-logger
```

---

## Quick Start

### Basic Usage

```typescript
import { LogManager, ConsoleAppender, LogLevel } from 'perfect-logger';

// 1. Configure the root logger
LogManager.configure({
    minLevel: LogLevel.INFO,
    appenders: [new ConsoleAppender()],
});

// 2. Obtain a logger instance
const logger = LogManager.getLogger('app.server');

// 3. Log messages with context and errors
logger.info('Server started successfully', { port: 8080 });
logger.warn('High memory usage detected', { memoryUsageMb: 1024 });
logger.error('Failed to connect to database', new Error('Connection refused'));
```

### Production Enterprise Setup

```typescript
import {
    LogManager,
    StreamAppender,
    RollingFileAppender,
    HttpAppender,
    AsyncAppender,
    JsonLayout,
    PatternLayout,
    LogLevel,
    Markers,
    OverflowPolicy,
} from 'perfect-logger';

LogManager.configure({
    minLevel: LogLevel.INFO,
    root: {
        appenders: [
            // High-performance stdout with JSON layout
            new StreamAppender({
                layout: new JsonLayout({ pretty: false }),
            }),
            // Asynchronous rolling file with gzip compression
            new AsyncAppender({
                queueSize: 10000,
                overflowPolicy: OverflowPolicy.DISCARD_OLDEST,
                appender: new RollingFileAppender({
                    logDirectory: './logs',
                    fileName: 'application.log',
                    maxSize: 50 * 1024 * 1024, // 50MB
                    maxFiles: 10,
                    compress: true, // Native gzip compression
                    layout: new PatternLayout({
                        pattern: '%d{ISO8601} [%p] [%c] %X{requestId} - %m%ex%n',
                    }),
                }),
            }),
        ],
    },
    loggers: {
        // Specific logger with dedicated HTTP appender for security audits
        'security': {
            level: LogLevel.DEBUG,
            additivity: true, // Also bubbles to root appenders
            appenders: [
                new HttpAppender({
                    url: 'https://logs.example.com/ingest',
                    batchSize: 100,
                    batchInterval: 2000,
                    headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
                }),
            ],
        },
    },
});
```

---

## Executable Examples

A complete, runnable test suite of TypeScript examples is available in the [`examples/`](./examples) directory. You can run any example directly using `npx ts-node`:

| Example | Feature Area | Command |
| :--- | :--- | :--- |
| [`01-quick-start.ts`](./examples/01-quick-start.ts) | Out-of-the-box `defaultLogger`, central `LogManager.configure()`, log levels, metadata, error handling | `npx ts-node examples/01-quick-start.ts` |
| [`02-hierarchical-loggers.ts`](./examples/02-hierarchical-loggers.ts) | Dot-notated hierarchical tree (`api.services.auth`), level inheritance, additivity bubbling, and isolation | `npx ts-node examples/02-hierarchical-loggers.ts` |
| [`03-mdc-async-context.ts`](./examples/03-mdc-async-context.ts) | Mapped Diagnostic Context (MDC) across asynchronous calls via `AsyncLocalStorage` with concurrency isolation | `npx ts-node examples/03-mdc-async-context.ts` |
| [`04-layouts-pattern-and-json.ts`](./examples/04-layouts-pattern-and-json.ts) | Decoupled `PatternLayout` (conversion specifiers) and `JsonLayout` (NDJSON / Datadog / ELK structured logs) | `npx ts-node examples/04-layouts-pattern-and-json.ts` |
| [`05-semantic-markers.ts`](./examples/05-semantic-markers.ts) | Semantic markers (`Markers.SECURITY`), hierarchical marker trees, and `MarkerFilter` routing | `npx ts-node examples/05-semantic-markers.ts` |
| [`06-filters-pipeline.ts`](./examples/06-filters-pipeline.ts) | Tri-state filter pipeline (`ACCEPT`, `DENY`, `NEUTRAL`), `RegexFilter` noise reduction, and VIP bypass | `npx ts-node examples/06-filters-pipeline.ts` |
| [`07-advanced-appenders.ts`](./examples/07-advanced-appenders.ts) | High-performance `StreamAppender`, non-blocking `AsyncAppender`, `RollingFileAppender`, and `CallbackAppender` | `npx ts-node examples/07-advanced-appenders.ts` |
| [`08-declarative-config.ts`](./examples/08-declarative-config.ts) | Zero-code setup with [`logger.config.json`](./examples/logger.config.json), dynamic env interpolation (`${env:VAR:-default}`) | `npx ts-node examples/08-declarative-config.ts` |

---

## Core Architecture

```
                                    +--------------------+
                                    |    Application     |
                                    +--------------------+
                                              |
                                              v
                                    +--------------------+
                                    |     LogManager     | (Global Filters, Config)
                                    +--------------------+
                                              |
                                              v
                              +--------------------------------+
                              |         Logger Tree            |
                              |   root                         |
                              |    └── api                     |
                              |         └── api.auth           |
                              +--------------------------------+
                                       /              \
                                      v                v
                             +----------------+  +----------------+
                             |     Logger     |  |     Logger     | (Logger Filters, MDC, Context)
                             +----------------+  +----------------+
                                     |                   | (Additivity)
                                     +---------+---------+
                                               |
                                               v
                                    +--------------------+
                                    |     Appender       | (Appender Filters, Batching)
                                    +--------------------+
                                               |
                                               v
                                    +--------------------+
                                    |      Layout        | (PatternLayout / JsonLayout)
                                    +--------------------+
                                               |
                                               v
                                    +--------------------+
                                    | Output Destination | (Console / File / Stream / HTTP)
                                    +--------------------+
```

---

### Hierarchical Loggers & Additivity

Loggers form a hierarchical dot-separated namespace tree. For example, `api.auth` is a child of `api`, which is a child of `root`.

* **Level Inheritance**: If `api.auth` does not define an explicit level, it inherits from `api`. If `api` has no level, it inherits from `root`.
* **Additivity**: By default, logs written to a child logger bubble up to the appenders of all ancestor loggers (`additivity: true`). Set `additivity: false` to restrict output strictly to that logger's appenders.

```typescript
const authLogger = LogManager.getLogger('api.auth');
authLogger.setAdditivity(false); // Do not bubble up to 'api' or 'root'
```

#### Guard Methods

Avoid unnecessary computation or string interpolations when a log level is not enabled:

```typescript
if (logger.isDebugEnabled()) {
    logger.debug(`Complex calculation: ${expensiveOperation()}`);
}

logger.isTraceEnabled();
logger.isInfoEnabled();
logger.isWarnEnabled();
logger.isErrorEnabled();
logger.isFatalEnabled();
```

---

### Mapped Diagnostic Context (MDC)

Modeled after Log4j's `ThreadContext` and SLF4J's `MDC`, `perfect-logger` provides asynchronous context propagation. Context values automatically bind to all log entries executed within an async flow without manual parameter passing:

```typescript
import { MDC, LogManager } from 'perfect-logger';

const logger = LogManager.getLogger('order-service');

// Context is bound to all synchronous & asynchronous operations within MDC.run()
await MDC.run({ requestId: 'req-abc-123', userId: 42 }, async () => {
    logger.info('Processing order checkout'); // Includes requestId and userId in context!
    
    await processPayment(); // Still retains requestId and userId!
});
```

You can also dynamically manipulate the current async context:

```typescript
MDC.put('tenantId', 'acme-corp');
const tenant = MDC.get<string>('tenantId');
MDC.remove('tenantId');
MDC.clear();
```

---

### Semantic Markers

Markers allow semantic categorisation of log events across namespaces (e.g. for audit compliance, security audits, or performance metrics). Markers can also have hierarchical parents:

```typescript
import { MarkerManager, Markers } from 'perfect-logger';

// Built-in presets
logger.info(Markers.SECURITY, 'User failed 2FA verification');
logger.info(Markers.AUDIT, 'User role updated to admin');
logger.info(Markers.PERF, 'Query took 1240ms');

// Custom hierarchical markers
const dbMarker = MarkerManager.getMarker('DATABASE');
const sqlMarker = MarkerManager.getMarker('SQL', dbMarker);

logger.debug(sqlMarker, 'SELECT * FROM users');

// Containment check
console.log(sqlMarker.contains(dbMarker)); // true
```

---

### Tri-State Filters

Filters return one of three states:
* `FilterResult.ACCEPT`: The entry is processed immediately, bypassing downstream checks.
* `FilterResult.DENY`: The entry is dropped immediately.
* `FilterResult.NEUTRAL`: The filter does not make a final decision; evaluation continues down the pipeline.

Filters can be applied globally in `LogManager`, on individual `Logger` nodes, or on specific `Appender` instances.

| Filter | Description |
| :--- | :--- |
| `ThresholdFilter` | Evaluates severity against a minimum threshold level. |
| `MarkerFilter` | Matches against a specific `Marker` (including parent markers). |
| `RegexFilter` | Matches the log message against a regular expression. |
| `ContextFilter` | Matches against MDC/context keys using values or predicates. |
| `CompositeFilter` | Chains multiple filters together. |

```typescript
import { ContextFilter, RegexFilter, CompositeFilter, FilterResult } from 'perfect-logger';

// Drop logs containing sensitive credit card numbers
const filter = new RegexFilter({
    regex: /\b(?:\d[ -]*?){13,16}\b/,
    onMatch: FilterResult.DENY,
    onMismatch: FilterResult.NEUTRAL,
});

// Filter by context tenant
const tenantFilter = new ContextFilter({
    key: 'tenant',
    value: 'enterprise',
    onMatch: FilterResult.ACCEPT,
    onMismatch: FilterResult.DENY,
});
```

---

### Layouts

Layouts separate formatting logic from output destinations.

#### `PatternLayout`

Supports standard Log4j conversion specifiers:

| Specifier | Description | Example Output |
| :--- | :--- | :--- |
| `%d`, `%d{ISO8601}`, `%d{YYYY-MM-DD}` | Formatted timestamp | `2026-09-05T00:30:00.000Z` |
| `%p`, `%level` | Log level name | `INFO`, `ERROR` |
| `%c`, `%c{1}`, `%logger` | Logger category/namespace | `api.auth` or `auth` (with `{1}`) |
| `%m`, `%msg` | The log message | `Operation successful` |
| `%marker` | Marker name | `[SECURITY]` |
| `%X{key}` | Context / MDC variable | `req-123` |
| `%ex`, `%throwable` | Formatted error stack trace | `Error: failure\n  at ...` |
| `%n` | Platform newline | `\n` |

```typescript
import { PatternLayout } from 'perfect-logger';

const layout = new PatternLayout({
    pattern: '%d{ISO8601} [%p] [%c{1}] %marker %X{requestId} - %m%ex%n',
});
```

#### `JsonLayout`

Formats entries into structured JSON for ingestion by Elasticsearch, Datadog, CloudWatch, or Splunk:

```typescript
import { JsonLayout } from 'perfect-logger';

const layout = new JsonLayout({
    pretty: false,
    timestampFormat: 'iso', // or 'epoch'
    includeContext: true,
    includeError: true,
    fieldNames: {
        timestamp: '@timestamp',
        level: 'log.level',
        message: 'message',
    },
});
```

---

### Appenders

#### `AsyncAppender`

Wraps any target appender to perform logging asynchronously in the background. Protects application throughput with a bounded queue and customizable overflow policy:

```typescript
import { AsyncAppender, OverflowPolicy, FileAppender } from 'perfect-logger';

const asyncAppender = new AsyncAppender({
    appender: new FileAppender({ fileName: 'app.log' }),
    queueSize: 5000,
    overflowPolicy: OverflowPolicy.DISCARD_OLDEST, // Or BLOCK, DISCARD
});
```

#### `RollingFileAppender`

Supports size-based rotation, time-based rotation (daily/hourly), automatic retention pruning (`maxFiles`), and native gzip compression:

```typescript
import { RollingFileAppender } from 'perfect-logger';

const fileAppender = new RollingFileAppender({
    logDirectory: './logs',
    fileName: 'app.log',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,               // Keep 5 oldest archives
    compress: true,            // Gzip archives (.gz)
    rotation: 'daily',         // 'daily' or 'hourly'
});
```

#### `StreamAppender`

Writes directly to any Node.js `WritableStream`, such as `process.stdout` or `process.stderr`:

```typescript
import { StreamAppender, JsonLayout } from 'perfect-logger';

const stdoutAppender = new StreamAppender({
    stream: process.stdout,
    layout: new JsonLayout(),
});
```

#### `HttpAppender`

Sends batches of logs over HTTP/HTTPS to remote endpoints. Uses Node.js native `http`/`https` or browser `fetch` with zero external dependencies:

```typescript
import { HttpAppender } from 'perfect-logger';

const httpAppender = new HttpAppender({
    url: 'https://logging.internal.net/v1/logs',
    method: 'POST',
    batchSize: 50,
    batchInterval: 3000,
    maxRetries: 3,
    retryDelay: 1000,
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'secret',
    },
});
```

---

## Declarative Configuration

You can configure `perfect-logger` entirely through a configuration file (`logger.config.json` or `logger.config.js`) placed in your project root.

### Automatic Configuration

Calling `LogManager.autoConfigure()` automatically searches for `logger.config.json` or `logger.config.js`. If neither exists, it provides safe defaults (Console in development, Stream with JSON in production).

```typescript
import { LogManager } from 'perfect-logger';

// Automatically loads logger.config.json if present
LogManager.autoConfigure();
```

### Example `logger.config.json`

Supports runtime environment variable expansion via `${env:NAME}` or `${env:NAME:-default}`:

```json
{
  "appenders": {
    "console": {
      "type": "Console",
      "minLevel": "${env:LOG_LEVEL:-INFO}",
      "layout": {
        "type": "Pattern",
        "pattern": "%d{ISO8601} [%p] [%c] - %m%ex%n"
      }
    },
    "file": {
      "type": "RollingFile",
      "minLevel": "WARN",
      "logDirectory": "./logs",
      "fileName": "errors.log",
      "maxSize": 10485760,
      "maxFiles": 5,
      "compress": true,
      "layout": {
        "type": "Json",
        "pretty": false
      }
    }
  },
  "root": {
    "level": "INFO",
    "appenders": ["console"]
  },
  "loggers": {
    "api.payments": {
      "level": "DEBUG",
      "appenders": ["file"],
      "additivity": true
    }
  }
}
```

---

## Performance & Best Practices

1. **Use `AsyncAppender` for File & Network I/O**: Shield application threads from disk latency or remote network hiccups by wrapping slow appenders in `AsyncAppender`.
2. **Leverage Level Guards**: Guard expensive string constructions or serialization with `logger.isDebugEnabled()`.
3. **Flush on Process Exit**: Ensure all buffered logs are flushed when your Node.js application shuts down:
   ```typescript
   process.on('SIGTERM', async () => {
       await LogManager.shutdown();
       process.exit(0);
   });
   ```
4. **Prefer `StreamAppender` in Containerized Environments**: For Docker and Kubernetes, write structured JSON directly to `process.stdout` using `StreamAppender` and `JsonLayout`.

---

## API Reference

### Exported Classes & Singletons

* **`defaultLogger`**: Pre-configured root default logger instance for immediate out-of-the-box logging.
* **`logManager` / `LogManager`**: Central configuration registry, singleton instance, static helpers (`configure()`, `getLogger()`, `getRootLogger()`, `flush()`, `shutdown()`, `autoConfigure()`).
* **`Logger`**: Hierarchical logger with level evaluation, guard methods, context merging, and appender dispatching.
* **`MDC`**: Mapped Diagnostic Context for async tracing (`run()`, `put()`, `get()`, `remove()`, `clear()`, `getContext()`, `getCopyOfContextMap()`).
* **`MarkerManager` / `Markers`**: Marker creation, parent-child inheritance, and standard semantic presets (`AUDIT`, `SECURITY`, `PERF`, `DATABASE`).
* **Appenders**: `ConsoleAppender`, `FileAppender`, `RollingFileAppender`, `StreamAppender`, `HttpAppender`, `AsyncAppender`, `CallbackAppender`, `JsonAppender`, `BaseAppender`.
* **Layouts**: `PatternLayout`, `JsonLayout`.
* **Filters**: `ThresholdFilter`, `MarkerFilter`, `RegexFilter`, `ContextFilter`, `CompositeFilter`.
* **Configuration**: `ConfigLoader` declarative config parser and file auto-discovery.
* **Types & Constants**: `LogLevel` (`TRACE = 0`..`FATAL = 5`), `FilterResult` (`ACCEPT = 1`, `NEUTRAL = 0`, `DENY = -1`), `OverflowPolicy` (`DISCARD`, `DISCARD_OLDEST`, `BLOCK`).

---

## Dual Package Support (CJS & ESM)

`perfect-logger` ships with both CommonJS and ECMAScript Modules (ESM):

```typescript
// ESM / TypeScript
import { LogManager, LogLevel } from 'perfect-logger';

// CommonJS
const { LogManager, LogLevel } = require('perfect-logger');
```

---

## License

[MIT](./LICENSE) © Sulochana Kodituwakku
