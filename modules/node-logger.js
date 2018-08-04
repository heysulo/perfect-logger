// Standard Settings ******************************************************************************
let standardStatusCodeLength = -1;
let disableStatusCodePadding = false;
let userTimeZone = "UTC";
let getTime = undefined;
let getDate = undefined;
let statusCodeAliases = {
    info : { code: "INFO", writeToDatabase: false },
    warn : { code: "WARN", writeToDatabase: true },
    crit : { code: "CRIT", writeToDatabase: true },
    debug : { code: "DEBG", writeToDatabase: false },
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
exports.log = function (message, alias, databaseObj = { writeToDatabase : false }) {
    writeLogLine(message, alias, databaseObj);
};

// Module Initializations *************************************************************************
getTime = getTimeFunction;
getDate = getDateFunction;

// Dynamic function generation for each code
Object.keys(statusCodeAliases).forEach(function (key) {
    exports[key] = function (message, databaseObj = { writeToDatabase : false }) {
        writeLogLine(message, key, databaseObj);
    }
});