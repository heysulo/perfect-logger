# perfect-logger

A modern, powerful, and lightweight logging library for TypeScript and JavaScript applications. It is designed to be highly configurable and extensible, allowing you to tailor your logging output to your specific needs.

## Features

-   **Multiple Appenders**: Log to the console, file system, or extend it with your own custom appenders.
-   **Highly Configurable**: Customize log formats, levels, and destinations.
-   **Log Rotation**: Automatically rotate log files based on size, time (daily/hourly), or a combination.
-   **TypeScript Native**: Written in TypeScript, providing strong typing and excellent editor support.
-   **Environment Aware**: Works seamlessly in Node.js and modern browsers (features like the `FileAppender` are Node.js-only).
-   **Zero Dependencies**: A lightweight library with no external dependencies.

## Installation

```bash
npm install perfect-logger
```

## Quick Start

Get up and running with a few lines of code.

```typescript
import { LogManager, ConsoleAppender, LogLevel } from 'perfect-logger';

// 1. Configure the LogManager
LogManager.configure({
    appenders: [
        new ConsoleAppender({ minLevel: LogLevel.INFO })
    ]
});

// 2. Get a logger instance
const logger = LogManager.getLogger('my-app');

// 3. Start logging!
logger.info('Application starting...');
logger.warn('Configuration is missing a recommended setting.');
logger.error('Failed to connect to the database.', new Error('Connection timed out'));
logger.debug('This is a debug message.', { userId: 123 }); // This won't be logged due to minLevel
```

## Example Outputs

### Console Output

Using the default `ConsoleAppender` configuration, your output will look clean and simple. Note that `console.error` will automatically print the stack trace of an `Error` object.

```
2023/10/28 | 14:30:05.123 | INFO | my-app | Application starting...
2023/10/28 | 14:30:05.125 | WARN | my-app | Configuration is missing a recommended setting.
2023/10/28 | 14:30:05.128 | ERROR | my-app | Failed to connect to the database.
Error: Connection timed out
    at <stack trace ...>
```

### File Output

The `FileAppender` provides more detailed output, especially for context objects and errors, which are formatted for readability.

```
// In logs/app.log
2023/10/28 | 14:30:05.123 | INFO | worker-process | Starting background job...
2023/10/28 | 14:30:05.500 | DEBUG | worker-process | Processing job.
~ {
~     "jobId": "xyz-123",
~     "payload": {
~         "user": "admin"
~     }
~ }
2023/10/28 | 14:30:05.900 | ERROR | worker-process | Job failed to complete.
Error: Task failed successfully
    at Object.<anonymous> (/path/to/your/project/worker.ts:42:15)
    at Module._compile (internal/modules/cjs/loader.js:1085:14)
    ...
```

## Core Concepts

-   **`LogManager`**: A static class that serves as the central point for configuration. You use it to register and configure your appenders.
-   **`Logger`**: The object you use to write log messages. You get a `Logger` instance from the `LogManager`, usually with a specific namespace (e.g., a component or module name).
-   **`Appenders`**: These are the destinations for your log messages. `perfect-logger` comes with three built-in appenders: `ConsoleAppender`, `FileAppender`, and `CallbackAppender`.

---

## Appenders

You can configure multiple appenders to send logs to different destinations simultaneously.

### `ConsoleAppender`

Logs messages to the browser or Node.js console.

#### Example Usage

```typescript
import { LogManager, ConsoleAppender, LogLevel } from 'perfect-logger';

LogManager.configure({
    appenders: [
        new ConsoleAppender({
            minLevel: LogLevel.DEBUG,
            format: '[{level}] {namespace} - {message}'
        })
    ]
});

const logger = LogManager.getLogger('api-service');
logger.debug('Received a new request.');
```

#### Configuration Options

| Option     | Type      | Default                                                     | Description                                                                                             |
| :--------- | :-------- |:------------------------------------------------------------| :------------------------------------------------------------------------------------------------------ |
| `minLevel` | `LogLevel`  | `LogLevel.INFO`                                             | The minimum log level this appender will process.                                                       |
| `format`   | `string`  | `'{date} \| {time} \| {level} \| {namespace} \| {message}'` | A template string that defines the log message format. See the "Formatting" section for placeholders. |
| `timezone` | `string`  | `undefined`                                                 | An IANA timezone string (e.g., 'America/New_York') to use for `{date}` and `{time}`. Defaults to the system's timezone. |

---

### `FileAppender`

Writes log messages to a file in a **Node.js environment**. This appender includes powerful log rotation features.

#### Example Usage

```typescript
import { LogManager, FileAppender, LogLevel } from 'perfect-logger';

LogManager.configure({
    appenders: [
        new FileAppender({
            logDirectory: 'logs',
            fileName: 'app.log',
            minLevel: LogLevel.INFO,
            // Rotation settings
            rotation: 'daily', // Rotate logs every day
            maxSize: 10 * 1024 * 1024, // Rotate if file exceeds 10MB
            maxFiles: 7 // Keep the last 7 rotated log files
        })
    ]
});

const logger = LogManager.getLogger('worker-process');
logger.info('Starting background job...');
```

#### Configuration Options

| Option         | Type                 | Default                                                                            | Description                                                                                                                              |
| :------------- | :------------------- |:-----------------------------------------------------------------------------------| :--------------------------------------------------------------------------------------------------------------------------------------- |
| `minLevel`     | `LogLevel`             | `LogLevel.INFO`                                                                    | The minimum log level this appender will process.                                                                                        |
| `logDirectory` | `string`             | `'logs'` in the current working directory                                          | The directory where log files will be stored.                                                                                            |
| `fileName`     | `string`             | `'app.log'`                                                                        | The name of the primary log file.                                                                                                        |
| `format`       | `string`             | `'{date} \| {time}                        \| {level} \| {namespace} \| {message}'` | A template string for the log message format.                                                                                            |
| `rotation`     | `'daily'` \| `'hourly'` | `undefined`                                                                        | The time-based rotation policy. A new file is created daily or hourly.                                                                   |
| `maxSize`      | `number`             | `null`                                                                             | The maximum size of a log file in **bytes**. If the file exceeds this size, it will be rotated.                                          |
| `maxFiles`     | `number`             | `null`                                                                             | The maximum number of archived log files to keep. The oldest files are deleted automatically.                                            |
| `timezone`     | `string`             | `undefined`                                                                        | An IANA timezone string to use for `{date}` and `{time}`.                                                                                |

### `CallbackAppender`

Provides a hook into the logging stream, executing a custom function for each log entry. This is perfect for integrating with third-party monitoring services, sending logs over a network, or performing any other custom logic.

#### Example Usage

```typescript
import { LogManager, CallbackAppender, LogLevel, LogEntry } from 'perfect-logger';

// Example: Send critical errors to a monitoring service
function sendToMonitoringService(entry: LogEntry) {
    const { level, message, error } = entry;
    // In a real-world scenario, you would format and send this data
    // to a service like Sentry, DataDog, etc.
    console.log(`-- Sending to monitoring: [${LogLevel[level]}] ${message} --`);
    if (error) {
        console.log(error.stack);
    }
}

LogManager.configure({
    appenders: [
        new CallbackAppender({
            callback: sendToMonitoringService,
            minLevel: LogLevel.ERROR // Only send errors and fatal logs
        })
    ]
});

const logger = LogManager.getLogger('payment-gateway');
logger.info('Processing payment...'); // This will not trigger the callback
logger.fatal('Credit card service is down!', new Error('Service Unreachable'));
```

#### Configuration Options

| Option     | Type          | Default         | Description                                               |
| :--------- | :------------ | :-------------- | :-------------------------------------------------------- |
| `minLevel` | `LogLevel`      | `LogLevel.TRACE`  | The minimum log level this appender will process.         |
| `callback` | `(entry: LogEntry) => void` | **Required**    | The function to execute for each log entry.               |

---

## Extending the Logger: Custom Appenders

`perfect-logger` is designed to be extensible. You can easily create your own appenders to send logs to any destination you can imagine, such as a database, a third-party API, or a real-time dashboard.

To create a custom appender, you need to extend the `BaseAppender` class and implement the `handle` method.

### Example: A Simple `AlertAppender`

Let's create an appender that shows a browser `alert()` for any `FATAL` log messages.

```typescript
import { BaseAppender, LogEntry, AppenderConfig, LogLevel } from 'perfect-logger';

// 1. Define a configuration interface (optional, but good practice)
export interface AlertAppenderConfig extends AppenderConfig {
    // You can add custom options here if needed
}

// 2. Create the custom appender class
export class AlertAppender extends BaseAppender {
    constructor(config: AlertAppenderConfig = {}) {
        // Set a default minLevel if you want
        super('AlertAppender', config, { minLevel: LogLevel.FATAL });
    }

    // 3. Implement the 'handle' method
    public handle(entry: LogEntry): void {
        // The BaseAppender already filters by minLevel, so no need to check here.
        
        const formattedMessage = `[${LogLevel[entry.level]}] ${entry.message}`;
        
        // In a browser environment, show an alert.
        if (typeof window !== 'undefined') {
            window.alert(formattedMessage);
        }
    }
}
```

### Using Your Custom Appender

Once you've created your appender, you can use it just like any of the built-in ones.

```typescript
import { LogManager, ConsoleAppender } from 'perfect-logger';
import { AlertAppender } from './AlertAppender'; // Import your custom appender

LogManager.configure({
    appenders: [
        new ConsoleAppender(), // Still log to the console
        new AlertAppender()    // And also show alerts for fatal errors
    ]
});

const logger = LogManager.getLogger('app');
logger.info('This is just a normal log.');
logger.fatal('Something went terribly wrong!'); // This will trigger the alert!
```

By extending `BaseAppender`, your custom appender automatically gets `minLevel` filtering and a consistent structure, making it easy to create powerful, reusable logging plugins.

---

## Understanding Log Rotation Behavior

A key feature of the `FileAppender` is its predictable and convenient rotation strategy.

**The Active Log File**

When using size-based or hybrid (size and time) rotation, `perfect-logger` always writes to a file with a static name (e.g., `app.log`, as defined by `fileName`). This makes it incredibly easy to locate the logs for the currently running process. You can simply `tail -f logs/app.log` without needing to know the exact timestamp or rotation number.

**The Rotation Process**

When a rotation condition is met (either the file size exceeds `maxSize` or the time period for `rotation` elapses):

1.  The current active log file (e.g., `app.log`) is closed.
2.  It is renamed to an archive file.
    *   **On Size-Based Rotation**: It gets a numeric suffix, like `app.log.1`. If `app.log.1` already exists, it is renamed to `app.log.2`, and so on.
    *   **On Time-Based Rotation**: It is renamed with a timestamp, like `app-2023-10-28.log`.
3.  A new, empty `app.log` is created.
4.  New log messages are written to this new file.

This process ensures that the active log file is always available at the same path, which is ideal for live monitoring.

**Purely Time-Based Rotation**

There is one exception to this behavior. If you configure **only** time-based rotation (e.g., `rotation: 'daily'`) and do **not** set a `maxSize`, the logger will write directly to a time-stamped file (e.g., `app-2023-10-28.log`). A new file will be created automatically when the day or hour changes.

---

## Advanced Configuration

### Log Levels

Log levels are used to categorize the severity of a log message. When you set a `minLevel` on an appender, it will only process messages of that level or higher. The levels are ordered as follows:

-   `TRACE`
-   `DEBUG`
-   `INFO`
-   `WARN`
-   `ERROR`
-   `FATAL`

### Formatting

You can control the output format of your logs using a template string with the following placeholders:

| Placeholder   | Description                                                                   |
| :------------ | :---------------------------------------------------------------------------- |
| `{date}`      | The date of the log entry (e.g., `2023/10/28`).                               |
| `{time}`      | The time of the log entry, including milliseconds (e.g., `14:30:05.123`).     |
| `{level}`     | The log level of the entry (e.g., `INFO`, `WARN`).                            |
| `{namespace}` | The namespace of the logger instance.                                         |
| `{message}`   | The main log message.                                                         |
| `{context}`   | A stringified version of the optional context object passed to the logger.    |
| `{error}`     | The stack trace or message of an `Error` object passed to the logger.         |

## License

This project is licensed under the MIT License.
