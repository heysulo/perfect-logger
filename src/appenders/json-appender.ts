import { AppenderConfig } from '../core/types';
import { ConsoleAppender } from './console-appender';
import { LogLevel } from '../constants';
import { JsonLayout, JsonLayoutOptions } from '../layouts/json-layout';

export interface JsonAppenderConfig extends AppenderConfig, JsonLayoutOptions {}

/**
 * Convenience appender that writes JSON-serialized logs to the console.
 * Combines ConsoleAppender with JsonLayout.
 */
export class JsonAppender extends ConsoleAppender {
    constructor(config: JsonAppenderConfig = {}) {
        const layout = config.layout || new JsonLayout(config);
        super({ ...config, layout, minLevel: config.minLevel ?? LogLevel.INFO });
    }
}
