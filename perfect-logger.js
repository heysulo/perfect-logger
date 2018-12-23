const fileSystem = require('fs');
const loggerData = {
    version: "0.0.0"
};

// Standard Settings ******************************************************************************
const textColors = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    default: ""
};
const restConsole = "\x1b[0m";
let standardStatusCodeLength = -1;
let disableStatusCodePadding = false;
let userTimeZone = "UTC";
let getTime = undefined;
let getDate = undefined;
let logFileName = "ApplicationLog";
let logFileNameSuffix;
let logsDirectory = "./logs";
let logNumber = 0;
let maxLogSize = 10000;
let currentLogFile;
let previousLogFile = false;
let databaseCallback = undefined;
let regularCallback = undefined;
let virtualConsoleLog = [];
let enableVirtualConsolelogs = false;
let liveText = {};
let maintainSingleFile = false;
let statusCodeAliases = {
    info : { code: "INFO", writeToDatabase: false, color: textColors.default, hidden: false},
    warn : { code: "WARN", writeToDatabase: true, color: textColors.yellow, hidden: false },
    crit : { code: "CRIT", writeToDatabase: true, color: textColors.red, hidden: false },
    debug : { code: "DEBG", writeToDatabase: false, color: textColors.cyan, hidden: true },
    data : { code: "DATA", writeToDatabase: false, color: textColors.default, hidden: true }
};
let applicationInfo = {
    name: "Perfect Logger",
    banner: "Copyright 2018 Team whileLOOP",
    version: "1.0"
};

// Internal Functions *****************************************************************************
function getTimeFunction(UTC = false) {
    let now = new Date(new Date().toLocaleString('en-US', { timeZone: UTC ? 'UTC' : userTimeZone }));
    return ('0' + now.getHours()).substr(-2,2) + ':' +
        ('0' + now.getMinutes()).substr(-2,2) + ':' +
        ('0' + now.getSeconds()).substr(-2,2);
}

//*************************************************************************************************
function getDateFunction(UTC = false) {
    let now = new Date(new Date().toLocaleString('en-US', { timeZone: UTC ? 'UTC' : userTimeZone }));
    return now.getFullYear() + '/' +
        ('0' + (now.getMonth() + 1)).substr(-2,2) + '/' +
        ('0' + now.getDate()).substr(-2,2);
}

//*************************************************************************************************
function getStatusCodeToString(statusCode) {
    let codeString = statusCodeAliases[statusCode];
    if (codeString === undefined){
        codeString = {
            code: statusCode,
            writeToDatabase: false
        }
    }

    if (disableStatusCodePadding)
        return codeString;

    if (standardStatusCodeLength < 0){
        updateStandardStatusCodeLength();
    }

    codeString.code = codeString.code + " ".repeat(standardStatusCodeLength);
    codeString.code = codeString.code.substring(0, standardStatusCodeLength);

    return codeString;
}

//*************************************************************************************************
function writeLogLine(message, alias, databaseObj) {
    let statusCode = getStatusCodeToString(alias);
    let date = getDate();
    let time = getTime();
    let logMessage = `${date} | ${time} | ${statusCode.code} | ${message}`;
    if (!statusCode.hidden){
        console.log(statusCode.color, logMessage, restConsole);
    }

    if (getLogSize() > maxLogSize)
        logSwitch();

    fileSystem.appendFile(currentLogFile,
        logMessage + '\n',
        function(err) {
            if(err) {
                console.log(err);
        }
    });

    const logObject = {
        date: date,
        time: time,
        code: statusCode.code,
        message: message,
        details: databaseObj
    };

    if (databaseCallback !== undefined &&
        (databaseObj || statusCode.writeToDatabase))
    {
        databaseCallback(logObject);

    }

    if (regularCallback !== undefined){
        regularCallback(logObject);
    }

    if (enableVirtualConsolelogs && !statusCode.hidden){
        virtualConsoleLog.unshift(logObject);
    }

}
//*************************************************************************************************
function getLogSize() {
    const stats = fileSystem.statSync(currentLogFile);
    return stats.size;
}

//*************************************************************************************************
function writeToLogFile(message) {
    fileSystem.appendFile(currentLogFile,
        message + '\n',
        function(err) {
            if(err) {
                console.log(err);
            }
        }
     );
}

//*************************************************************************************************
function logSwitch() {
    logNumber += 1;
    if (!fileSystem.existsSync(logsDirectory)){
        fileSystem.mkdirSync(logsDirectory);
    }

    let newLogFileNameSuffix = (new Date()).getTime();

    if (previousLogFile)
        writeToLogFile(`Continuing to ${logFileName}.${newLogFileNameSuffix}.log`);

    previousLogFile = logFileNameSuffix ? `${logFileName}.${logFileNameSuffix}.log` : undefined;
    logFileNameSuffix = newLogFileNameSuffix;
    if (maintainSingleFile){
        currentLogFile = `${logsDirectory}/${logFileName}.log`;
    }else{
        currentLogFile = `${logsDirectory}/${logFileName}.${logFileNameSuffix}.log`;
    }

    let logFileHeader = ``+
    `******************************************************************************************\n` +
    `**\n` +
    `** ${applicationInfo.name} Logging System\n` +
    `** Application Version          : ${applicationInfo.version}\n` +
    `** Perfect-Logger Version       : ${loggerData.version}\n` +
    `** Application Start Time (UTC) : ${applicationInfo.startTime}\n` +
    `**\n` +
    `** ${applicationInfo.banner}\n` +
    `**\n` +
    `******************************************************************************************\n` +
    `**\n` +
    `** Log Number               : #${logNumber}\n` +
    `** Continuing from Log File : ${previousLogFile ? previousLogFile : 'None'}\n` +
    `** Log Start Time (UTC)     : ${getTimeFunction(true)} ${getDateFunction(true)}\n` +
    `**\n` +
    `******************************************************************************************`;

    writeToLogFile(logFileHeader);
}

//*************************************************************************************************
function updateStandardStatusCodeLength() {
    standardStatusCodeLength = 0;
    Object.keys(statusCodeAliases).forEach(function (key) {
        if (statusCodeAliases[key].code.length > standardStatusCodeLength)
            standardStatusCodeLength = statusCodeAliases[key].code.length;
    });
}

//*************************************************************************************************
/**
 * Set an status codes using an object
 * @param {Object} userStatusCodeObject
 */
exports.setStatusCodes = function (userStatusCodeObject) {
    statusCodeAliases = Object.assign({}, userStatusCodeObject);
    standardStatusCodeLength = -1;
};

//*************************************************************************************************
/**
 * Add a new status code
 * @param alias - Name of the status code
 * @param code - Status Code
 * @param writeToDatabaseValue - Write to database
 * @param color - Color of the text (Optional) Ex: logger.colors.red or "red"
 * @param hidden - Write only to the log file and hide from other"
 */
exports.addStatusCode = function (alias, code, writeToDatabaseValue, color = textColors.default, hidden = false) {
    if (Object.keys(textColors).indexOf(color) !== -1){
        color = textColors[color];
    } else if (Object.values(textColors).indexOf(color) !== -1){
        color = textColors[Object.keys(textColors)[Object.values(textColors).indexOf(color)]];
    }else{
        color = textColors.default;
    }
    statusCodeAliases[alias] = { code: code, writeToDatabase: writeToDatabaseValue, color: color, hidden: hidden };
    standardStatusCodeLength = -1;
    exports[alias] = function (message, databaseObj) {
        writeLogLine(message, alias, databaseObj);
    }
};

//*************************************************************************************************
/**
 * By setting status code padding to true will add spaces making the all the  status
 * codes print at the same length
 * @param {Boolean} value - Setting value
 */
exports.setStatusCodePadding = function (value) {
    disableStatusCodePadding = value;
};

//*************************************************************************************************
/**
 * Attach a function that will be called to get the time as a string
 * @param userFunction - A function that returns the current time as string
 */
exports.setTimeFunction = function (userFunction) {
    getTime = userFunction;
};

//*************************************************************************************************
/**
 * Attach a function that will be called to get the date as a string
 * @param userFunction - A function that returns the current date as string
 */
exports.setDateFunction = function (userFunction) {
    getDate = userFunction;
};

//*************************************************************************************************
/**
 * Log a message
 * @param message
 * @param alias
 * @param databaseObj
 */
exports.log = function (message, alias, databaseObj = { writeToDatabase : false }) {
    writeLogLine(message, alias, databaseObj);
};

//*************************************************************************************************
/**
 * Set timezone when using the built-in time and date functions
 * @param timeZone
 */
exports.setTimeZone = function (timeZone) {
    userTimeZone = timeZone;
};

//*************************************************************************************************
/**
 * Manually switch log files
 */
exports.switchLogs = function () {
    logSwitch();
};

//*************************************************************************************************
/**
 * Set the file name of the log files
 * @param fileName - File name
 */
exports.setLogFileName = function (fileName) {
    logFileName = fileName;
};

//*************************************************************************************************
/**
 * Set the location for the log files
 * @param directory - Path
 */
exports.setLogDirectory = function (directory) {
    logsDirectory = directory;
};

//*************************************************************************************************
/**
 * Set the maximum log file size in bytes which will be used for automatic log switching
 * @param size - Size in Bytes
 */
exports.setMaximumLogSize = function (size) {
    maxLogSize = size;
};

//*************************************************************************************************
/**
 * Set application information which will be used to create the log file banner
 * Example :
 * {
 *      name: "Facebook Incorporated",
 *      banner: "Copyright Facebook © 2018",
 *      version: "12.65.2"
 * }
 * @param infoObject
 */
exports.setApplicationInfo = function (infoObject) {
    applicationInfo = Object.assign({}, infoObject);
};

//*************************************************************************************************
/**
 * Attach a function which will be fired with an object which can be used for db writing
 * @param callback - Callback function
 */
exports.setDatabaseCallback = function (callback) {
    databaseCallback = callback;
};

//*************************************************************************************************
/**
 * Initialize logger module
 */
exports.initialize = function () {
    if (!getTime)
        getTime = getTimeFunction;

    if (!getDate)
        getDate = getDateFunction;

    // Dynamic function generation for each code
    Object.keys(statusCodeAliases).forEach(function (key) {
        exports[key] = function (message, databaseObj) {
            writeLogLine(message.replace('\n', '\\n'), key, databaseObj);
        }
    });

    const packageJSON = JSON.parse(fileSystem.readFileSync('package.json', 'utf8'));
    loggerData.version = packageJSON.version;

    applicationInfo.startTime = `${getTimeFunction(true)} ${getDateFunction(true)}`;
    logSwitch();
};

//*************************************************************************************************
/**
 * Attach a function which will be fired with an object which can be used as a callback for log
 * events. This will be fired after the database callback
 * @param callback - Callback function
 */
exports.setCallback = function(callback){
    regularCallback = callback;
};

//*************************************************************************************************
/**
 * Text Colors
 */
exports.colors = textColors;

//*************************************************************************************************
/***
 * Set a live event
 * @param text
 */
exports.setLiveText = function (text) {
    let date = getDate();
    let time = getTime();
    liveText = {
        date: date,
        time: time,
        statusCode: 'LIVE ',
        message: text
    };
    if (text){
        process.stdout.write(`${date} | ${time} | ${liveText.statusCode} | ${text}\r`);
    }
};

//*************************************************************************************************
/***
 * Gets the current log file name abnd path
 */
exports.getLogFileName = function () {
    return currentLogFile;
};

//*************************************************************************************************
/**
 * Enable storing log events in memory. Hidden log evemts will not be included
 */
exports.enableVirtualLogs = function () {
    enableVirtualConsolelogs = true;
};

//*************************************************************************************************
/**
 * Disable storing log events in memory.
 */
exports.disbleVirtualLogs = function () {
    enableVirtualConsolelogs = false;
};

//*************************************************************************************************
/***
 * Gets the logs as an array.
 * @returns {Array}
 */
exports.getVirtualConsoleLog = function () {
    if (!liveText.message){
        return virtualConsoleLog;
    }else{
        return virtualConsoleLog.concat(liveText);
    }
};

//*************************************************************************************************
/***
 * Clears the logs stored in the memory
 */
exports.clearVirtualConsoleLog = function () {
    virtualConsoleLog = [];
};

exports.writeData = function (object) {
    let objectStr = object;
    if (typeof(object) !== 'string'){
        objectStr = JSON.stringify(object, null, 4)
    }
    const dataLines = objectStr.split('\n');
    const uniqueIdentifier = Math.random().toString(36).substring(5).toUpperCase();
    dataLines.forEach(function (line, index) {
        writeLogLine(`[${uniqueIdentifier} : (${index + 1}/${dataLines.length})] ${line}`, 'data', {});
    })
};

//*************************************************************************************************
/***
 * Maintains a single log file without creating a file with a timestamp
 */
exports.maintainSingleLogFile = function () {
    maintainSingleFile = true;
};