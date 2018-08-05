const fileSystem = require('fs');
const loggerData = {
    version: "1.1.0"
};

// Standard Settings ******************************************************************************
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
let statusCodeAliases = {
    info : { code: "INFO", writeToDatabase: false },
    warn : { code: "WARN", writeToDatabase: true },
    crit : { code: "CRIT", writeToDatabase: true },
    debug : { code: "DEBG", writeToDatabase: false },
};
let applicationInfo = {
    name: "Perfect Logger",
    banner: "Copyright 2018 Team whileLOOP",
    version: "1.0"
};

// Internal Functions *****************************************************************************
function getTimeFunction() {
    let now = new Date(new Date().toLocaleString('en-US', { timeZone: userTimeZone }));
    return ('0' + now.getHours()).substr(-2,2) + ':' +
        ('0' + now.getMinutes()).substr(-2,2) + ':' +
        ('0' + now.getSeconds()).substr(-2,2);
}

//*************************************************************************************************
function getDateFunction() {
    let now = new Date(new Date().toLocaleString('en-US', { timeZone: userTimeZone }));
    return now.getFullYear() + '/' +
        ('0' + (now.getMonth() + 1)).substr(-2,2) + '/' +
        ('0' + now.getDate()).substr(-2,2);
}

//*************************************************************************************************
function getStatusCodeToString(statusCode) {
    let codeString = statusCodeAliases[statusCode].code;
    if (codeString === undefined){
        codeString = statusCode
    }

    if (disableStatusCodePadding)
        return codeString;

    if (standardStatusCodeLength < 0){
        updateStandardStatusCodeLength();
    }

    codeString = codeString + " ".repeat(standardStatusCodeLength);
    codeString = codeString.substring(0, standardStatusCodeLength);

    return codeString;
}

//*************************************************************************************************
function writeLogLine(message, alias, databaseObj = { writeToDatabase : false }) {
    let logMessage = `${getDate()} | ${getTime()} | ${getStatusCodeToString(alias)} | ${message}`;
    console.log(logMessage);

    if (getLogSize() > maxLogSize)
        logSwitch();

    fileSystem.appendFile(currentLogFile,
        logMessage + '\n',
        function(err) {
            if(err) {
                console.log(err);
        }
    });

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
    currentLogFile = `${logsDirectory}/${logFileName}.${logFileNameSuffix}.log`;

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
    `** Log Start Time (UTC)     : ${getTime()} ${getDate()}\n` +
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
 */
exports.addStatusCode = function (alias, code, writeToDatabaseValue) {
    statusCodeAliases[alias] = { code: code, writeToDatabase: writeToDatabaseValue };
    standardStatusCodeLength = -1;
    exports[alias] = function (message, databaseObj = { writeToDatabase : false }) {
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
exports.initialize = function () {
    if (!getTime)
        getTime = getTimeFunction;

    if (!getDate)
        getDate = getDateFunction;

    // Dynamic function generation for each code
    Object.keys(statusCodeAliases).forEach(function (key) {
        exports[key] = function (message, databaseObj = { writeToDatabase : false }) {
            writeLogLine(message, key, databaseObj);
        }
    });

    applicationInfo.startTime = `${getTime()} ${getDate()}`;
    logSwitch();
};