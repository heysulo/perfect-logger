const fs = require('fs');
const child_process = require('child_process');
const os = require('os');
const process = require('process');
const definitions = require('./definitions');

let startTime = null;
let logNumber = 0;
let logFileNames = [];
let moduleName = null;
let customBannerHeaders = [];
let timezone = definitions.DEFAULT_TIMEZONE;
let logLevel = definitions.LOG_LEVEL_DISABLED;
let developmentMode = false;
let logSwitchSize = -1;
let logDirectory = '.';
let callbackLogSwitch = null;

//*********************************************************************************************************************
function getLockDataFromFile(module = null) {
    let fileLockData = {};
    try {
        fileLockData = JSON.parse(fs.readFileSync(definitions.LOCKFILE_NAME, 'utf-8'));
    } catch (e) {}

    if (module === null)
        return  fileLockData;

    return Object.assign({
        startTime: 'UNKNOWN_START_TIME',
        pid: 'UNKNOWN_PID'
    }, fileLockData[moduleName]);
}

//*********************************************************************************************************************
function updateLockDataFile() {
    let lockData = getLockDataFromFile();
    lockData.lastUpdatedBy = moduleName;
    lockData[moduleName] = {
        startTime: Date.now(),
        pid: process.pid
    };
    fs.writeFileSync(definitions.LOCKFILE_NAME, JSON.stringify(lockData, null, 4));
}

//*********************************************************************************************************************
function isPreviousLogFileExists() {
    try {
        fs.accessSync(`${logDirectory}/${moduleName}.log`, 'rw');
        return true;
    } catch (e) {
        return false;
    }
}

//*********************************************************************************************************************
function getApplicationInfo() {
    let appData = {};
    try {
        appData = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    } catch (e) {}

    return Object.assign({
        name: 'Unknown',
        version: 'Unknown'
    }, appData)
}

//*********************************************************************************************************************
function renamePreviousLogFile() {
    let lockData = getLockDataFromFile(moduleName);
    fs.renameSync(`${logDirectory}/${moduleName}.log`,
        `${logDirectory}/${moduleName}.${lockData.pid}.${lockData.startTime}.log`);
    logFileNames.push(`${moduleName}.${lockData.pid}.${lockData.startTime}.log`);
}

//*********************************************************************************************************************
function getFormattedDateString(date) {
    return date.toLocaleString('en-US', {timeZone: timezone})
}

//*********************************************************************************************************************
function writeDataToLog(data) {
    fs.appendFileSync(`${logDirectory}/${moduleName}.log`, data + '\n');
}

//*********************************************************************************************************************
function splitToChunks(str, size){
    if (str == null) return [];
    str = String(str);
    size = ~~size;
    return str.length > size ? str.match(new RegExp('.{1,' + size + '}(\ ){0,}', 'g')) : [str];
}

//*********************************************************************************************************************
function printBanner() {
    const appData = getApplicationInfo();
    writeDataToLog(definitions.STAR_LINE);
    if (customBannerHeaders.length > 0) {
        writeDataToLog(definitions.STAR_INDENT);
        for (const line of customBannerHeaders) {
            writeDataToLog(definitions.STAR_INDENT + line);
        }
        writeDataToLog(definitions.STAR_INDENT);
        writeDataToLog(definitions.STAR_LINE);
    }
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_INDENT + `Module Name          : ${moduleName}`);
    writeDataToLog(definitions.STAR_INDENT + `Project Name         : ${appData.name}`);
    writeDataToLog(definitions.STAR_INDENT + `Version              : ${appData.version}`);
    writeDataToLog(definitions.STAR_INDENT + `Configured Timezone  : ${timezone}`);
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_LINE);
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_INDENT + `Log Number           : #${logNumber}`);
    writeDataToLog(definitions.STAR_INDENT + `Process Start Time   : ${getFormattedDateString(startTime)}`);
    writeDataToLog(definitions.STAR_INDENT + `Log Start Time       : ${getFormattedDateString(new Date())}`);
    writeDataToLog(definitions.STAR_INDENT + `Log Level            : ${logLevel}`);
    writeDataToLog(definitions.STAR_INDENT + `Continuing From      : ${ logFileNames[logFileNames.length - 1] || 'None' }`);
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_LINE);
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_INDENT + `Hostname             : ${os.hostname()}`);
    writeDataToLog(definitions.STAR_INDENT + `OS Release           : ${os.release()}`);
    writeDataToLog(definitions.STAR_INDENT + `Platform             : ${os.platform()}`);
    writeDataToLog(definitions.STAR_INDENT + `NodeJS Version       : ${process.versions.node}`);
    writeDataToLog(definitions.STAR_INDENT + `OpenSSL Version      : ${process.versions.openssl}`);
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_LINE);
    writeDataToLog(definitions.STAR_INDENT);
    writeDataToLog(definitions.STAR_INDENT + 'DEPENDENT NPM PACKAGE DETAILS');
    writeDataToLog(definitions.STAR_INDENT);
    if (developmentMode) {
        writeDataToLog(definitions.STAR_INDENT + 'Dependent packages are not logged in Development Mode');
        writeDataToLog(definitions.STAR_INDENT);
    } else {
        try {
            for (const line of child_process.execSync('npm list --depth=0').toString().split('\n')) {
                writeDataToLog(definitions.STAR_INDENT + line);
            }
        } catch (e) {
            writeDataToLog(definitions.STAR_INDENT + 'ERROR: NPM COMMAND `npm list --depth=0` FAILED');
        }
    }
    writeDataToLog(definitions.STAR_LINE);

}

//*********************************************************************************************************************
function switchLogFile() {
    if (isPreviousLogFileExists()){
        if (developmentMode && logNumber === 0) {
            fs.unlinkSync(`${logDirectory}/${moduleName}.log`);
        } else {
            renamePreviousLogFile();
        }
    }

    updateLockDataFile();
    logNumber++;
    printBanner();

    if (logNumber > 1 && callbackLogSwitch !== null) {
        callbackLogSwitch();
    }
}

//*********************************************************************************************************************
exports.init = (name, options = {}) => {
    moduleName = name;
    startTime = new Date();

    if (options.customBannerHeaders) {
        customBannerHeaders = splitToChunks(options.customBannerHeaders, definitions.STAR_LINE.length
            - (definitions.STAR_INDENT.length * 2));
    }

    if (options.devMode) {
        developmentMode = true;
    }

    if (options.timezone) {
        timezone = options.timezone;
    }

    if (options.logSwitchSize !== undefined) {
        logSwitchSize = options.logSwitchSize;
    }

    if (options.callbackLogSwitch) {
        callbackLogSwitch = options.callbackLogSwitch;
    }

    if (options.logLevel !== undefined) {
        logLevel = options.logLevel;
    }

    if (options.logDirectory) {
        try {
            fs.accessSync(options.logDirectory, 'rw');
        } catch (e) {
            fs.mkdirSync(options.logDirectory);
        }
        logDirectory = options.logDirectory;
    }

    switchLogFile();
};

//*********************************************************************************************************************
exports.write = (data) => {
    if (logSwitchSize !== definitions.NO_MAX_LOG_SIZE && fs.statSync(currentLogFile).size > logSwitchSize) {
        writeDataToLog(`Switching log files. Maximum file size (${logSwitchSize} Bytes) reached`);
        switchLogFile();
    }
    writeDataToLog(data);
};

//*********************************************************************************************************************
exports.switchLogFile = (reason = 'null') => {
    writeDataToLog(`Switching log files. User request: ${reason}`);
    switchLogFile();
};