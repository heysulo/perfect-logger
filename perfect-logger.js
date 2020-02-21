const fileManager = require('./file-manager');
const consoleManager = require('./console-manager');
const definitions = require('./definitions');

let configurations = {
    logLevelFile: definitions.LOG_LEVEL_DEBUG,
    logLevelConsole: definitions.LOG_LEVEL_INFO,
    logLevelCallback: definitions.LOG_LEVEL_DEBUG,
    developmentMode: false,
    timezone: definitions.DEFAULT_TIMEZONE,
    moduleName: definitions.DEFAULT_MODULE_NAME,
    maximumLogFieSize: definitions.NO_MAX_LOG_SIZE,
    callbackLogEvent: null,
    callbackLogSwitch: null,
    logDirectory: '.',
    customBannerHeaders: definitions.DEFAULT_CUSTOM_BANNER
};

let registeredAliases = {
    'debug' : { code: 'DEBUG',  level: definitions.LOG_LEVEL_DEBUG,     color: 'DEFAULT' },
    'info'  : { code: 'INFO',   level: definitions.LOG_LEVEL_INFO,      color: 'DEFAULT' },
    'warn'  : { code: 'WARN',   level: definitions.LOG_LEVEL_WARNING,   color: 'YELLOW' },
    'crit'  : { code: 'CRIT',   level: definitions.LOG_LEVEL_CRITICAL,  color: 'RED' }
};

//*************************************************************************************************
function getTime() {
    let now = new Date(new Date().toLocaleString('en-US', { timeZone:configurations.timezone }));
    return ('0' + now.getHours()).substr(-2,2) + ':' +
        ('0' + now.getMinutes()).substr(-2,2) + ':' +
        ('0' + now.getSeconds()).substr(-2,2);
}

//*************************************************************************************************
function getDate() {
    let now = new Date(new Date().toLocaleString('en-US', { timeZone: configurations.timezone }));
    return now.getFullYear() + '/' +
        ('0' + (now.getMonth() + 1)).substr(-2,2) + '/' +
        ('0' + now.getDate()).substr(-2,2);
}

//*************************************************************************************************
function sendToConsole(logObject) {
    if (configurations.logLevelConsole < 0) {
        return;
    }

    if (logObject.logLevel < configurations.logLevelConsole) {
        return;
    }

    let logMessage = `${logObject.date} | ${logObject.time} | ${logObject.code} | ${logObject.message}`;
    consoleManager.write(logMessage, logObject.color);
}

//*************************************************************************************************
function sendToFile(logObject) {
    if (configurations.logLevelFile < 0) {
        return;
    }

    if (logObject.logLevel < configurations.logLevelFile) {
        return;
    }

    let logMessage = `${logObject.date} | ${logObject.time} | ${logObject.code} | ${logObject.message}`;
    fileManager.write(logMessage);

    if (logObject.object === null) {
        return;
    }

    let objectStr = logObject.object;
    if (typeof(logObject.object) !== 'string'){
        objectStr = JSON.stringify(logObject.object, null, 4);
    }
    const uniqueIdentifier = Math.random().toString(36).substring(2, 4).toUpperCase();
    for (const line of objectStr.split('\n')) {
        fileManager.write(`[${uniqueIdentifier}]~ ${line}`);
    }
}

//*************************************************************************************************
function sendToCallback(logObject) {
    if (configurations.logLevelCallback < 0) {
        return;
    }

    if (logObject.logLevel < configurations.logLevelCallback) {
        return;
    }

    if (configurations.callbackLogEvent !==  null) {
        configurations.callbackLogEvent(logObject);
    }
}

//*************************************************************************************************
function handleLogMessage(alias, message, object = null) {
    if (!(alias in registeredAliases)) {
        throw new Error(`Unregistered alias[${alias}] used.`);
    }

    const aliasConfig = registeredAliases[alias];
    const logObject = {
        alias: alias,
        message: message,
        code: aliasConfig.code,
        color: aliasConfig.color,
        logLevel: aliasConfig.level,
        time: getTime(),
        date: getDate(),
        object: object
    };

    sendToConsole(logObject);
    sendToFile(logObject);
    sendToCallback(logObject);
}

//*************************************************************************************************
exports.initialize = function(moduleName, userOptions = {}) {
     configurations = Object.assign(configurations, userOptions);
     configurations.moduleName = moduleName;

     if (configurations.logLevelFile > definitions.LOG_LEVEL_DISABLED) {
         fileManager.init(configurations.moduleName, {
             customBannerHeaders: configurations.customBannerHeaders,
             devMode: configurations.developmentMode,
             timezone: configurations.timezone,
             logSwitchSize: configurations.maximumLogFieSize,
             callbackLogSwitch: configurations.callbackLogSwitch,
             logLevel: configurations.logLevelFile,
             logDirectory: configurations.logDirectory
         })
     }
};

//*************************************************************************************************
exports.debug = function(message, object = null) {
    handleLogMessage('debug', message, object)
};

//*************************************************************************************************
exports.info = function(message, object = null) {
    handleLogMessage('info', message, object)
};

//*************************************************************************************************
exports.warn = function(message, object = null) {
    handleLogMessage('warn', message, object)
};

//*************************************************************************************************
exports.crit = function(message, object = null) {
    handleLogMessage('crit', message, object)
};

//*************************************************************************************************
exports.addStatusCode = function (alias, code, level, color = 'DEFAULT') {
    if (!String(color).toUpperCase() in Object.keys(definitions.CONSOLE_COLORS)) {
        throw Error(`'${color}' is not a valid color preference`);
    }

    registeredAliases[alias] = {
        code: code,
        level: level,
        color: color
    };
    
    exports[alias] = function (message, object = null) {
        handleLogMessage(alias, message, object)
    }
};
