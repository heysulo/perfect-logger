# perfect-logger
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fheysulo%2Fperfect-logger.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fheysulo%2Fperfect-logger?ref=badge_shield)

The Perfect-Logger library exported as Node.js modules. With Perfect-Logger you can improve your application's logs


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fheysulo%2Fperfect-logger.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fheysulo%2Fperfect-logger?ref=badge_large)
=======

## Highlights

- Easy to use
- Configurable
- Write log events to file
- Automatic log switching to avoid huge log files
- Custom log codes
- Database callback support
- Log evnt call back support
- Colored terminal output
- Store logs in memory (Virtual Logs)

## Installation
Using npm:
```
npm i perfect-logger
````

In Node.JS
```javascript
// Load the perfect-logger module
let logger = require('perfect-logger');

// Configure Settings
logger.setLogDirectory("./ApplicationLogs");
logger.setLogFileName("AppLog");

// Initialize
logger.initialize();

// Use
logger.info("This is an information");
logger.warn("This is a warning");
logger.crit("This is a critical message");
```
Sample Terminal Output
```
2018/08/05 | 04:12:21 | INFO | This is an information
2018/08/05 | 04:12:21 | WARN | This is a warning
2018/08/05 | 04:12:21 | CRIT | This is a critical message
```
Sample Log File
```
******************************************************************************************
**
** NodeJS Logging System
** Application Version          : 1.0
** Node-Logger Version          : 1.0.0.0
** Application Start Time (UTC) : 04:12:21 2018/08/05
**
** Copyright 2018 Team whileLOOP
**
******************************************************************************************
**
** Log Number               : #1
** Continuing from Log File : None
** Log Start Time (UTC)     : 04:12:21 2018/08/05
**
******************************************************************************************
2018/08/05 | 04:12:21 | INFO | This is an information
2018/08/05 | 04:12:21 | WARN | This is a warning
2018/08/05 | 04:12:21 | CRIT | This is a critical message
```
# Configurations
## Time and Date
You can use your own time and date functions or you can use the inbuilt time and date functions which is default. Your custom functions should return a string. To ensure the log file quality, make sure that your functions return the time and date string at a constant length.

How to use your own time and date functions
```javascript
function time() {
    return "time";
}

function date() {
    return "date"
}

logger.setTimeFunction(time);
logger.setDateFunction(date);
```
In case if you decided to use the inbuilt time and date functions you canset the timezone like this. Default is UTC.
You can find a list of TimeZones here : https://timezonedb.com/time-zones
```
logger.setTimeZone("Asia/Colombo");
```

## Logging to File
By default this module will write all events to the log file.
Configure where you want your log files to be written. Default location is `logs` folder in the current directory.
```javascript
logger.setLogDirectory("./NodeLogs");
```
The log file will be in following syntax.
```
<LogFileName>.<TimeStamp>.log
```
You can have a constant filename without appending the time stamp to the file name by calling `maintainSingleLogFile()` function before the `initialize()` function.
**This will disable the log switching functionality**

You can set the LogFileName with the following function
```javascript
logger.setLogFileName("MyApplicationLog");
```
Every log file has it's own banner which includes the application Name, Version and Copyright banner. It's required to provide these information to the logger module.
```javascript
logger.setApplicationInfo({
    name: "Facebook",
    banner: "Copyright 2018 Facebook",
    version: "1.0"
});
```
Output Banner for above configuration
```
******************************************************************************************
**
** Facebook Logging System
** Application Version          : 1.0
** Node-Logger Version          : 1.0.0.0
** Application Start Time (UTC) : 10:09:54 2018/08/05
**
** Copyright 2018 Facebook
**
******************************************************************************************
```
By setting a maximum log file size will allow you to switch to new log file when the file size limit is reached. This is usefull to split log files. You must provide the size limit in **Bytes**.
Use the `switchLogs()` function to switch log files manually. You can get a full list of log files through the `getAllLogFileNames()` command.
```javascript
logger.setMaximumLogSize(10000);
```
You can write objects and strings to a file using `writeData` function. This will write the string or the object to the log file.
````javascript
logger.writeData({
    test: 'sdadasdad',
    dd: true,
    sd: 9878798,
    nk: 46.56456
});
logger.writeData("this is \n just \nto test \n the multileine\n thing");
````
Log file output
````javascript
2018/12/22 | 22:53:02 | DATA | [P2QKEVKR : (0/6)] {
2018/12/22 | 22:53:02 | DATA | [P2QKEVKR : (1/6)]     "test": "sdadasdad",
2018/12/22 | 22:53:02 | DATA | [P2QKEVKR : (2/6)]     "dd": true,
2018/12/22 | 22:53:02 | DATA | [P2QKEVKR : (3/6)]     "sd": 9878798,
2018/12/22 | 22:53:02 | DATA | [P2QKEVKR : (4/6)]     "nk": 46.56456
2018/12/22 | 22:53:02 | DATA | [P2QKEVKR : (5/6)] }
2018/12/22 | 22:53:02 | DATA | [AS2B2BJ : (0/5)] this is
2018/12/22 | 22:53:02 | DATA | [AS2B2BJ : (1/5)]  just
2018/12/22 | 22:53:02 | DATA | [AS2B2BJ : (2/5)] to test
2018/12/22 | 22:53:02 | DATA | [AS2B2BJ : (3/5)]  the multileine
2018/12/22 | 22:53:02 | DATA | [AS2B2BJ : (4/5)]  thing
````

A unique code will also be written to help identify the written object in asynchronous situations
# Custom Log Codes
By default `INFO`, `WARN`, `CRIT` and `DEBG` methods are available for logging. You can create your own logging codes.
This should be done before calling the `logger.initialize()` function.
```javascript
// Creation
/**
 * @param alias - Name of the status code
 * @param code - Status Code
 * @param writeToDatabaseValue - Write to database by default
 * @param color - Color of the text (Optional) Ex: logger.colors.red or "red"
 * @param hidden - Write only to the log file and hide from other"
 */
logger.addStatusCode("flag", "FLAG", false);
logger.addStatusCode("socketEvent", "SOCK", false, "red");
logger.addStatusCode("logOnly", "FLOG", false, "", true);

// Usage
logger.flag("RESTART Flag received");
logger.socketEvent("Socket client connected");
logger.logOnly("This will be written only into the log file");
```
Output
```
2018/08/05 | 10:23:01 | FLAG | RESTART Flag received
2018/08/05 | 10:23:01 | SOCK | Socket client connected
```
Available colors :
`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`

# Database Callback
You can atatch a function which can be fired upon log event which can be used to write events to the database. By default `WARN` and `CRIT` events will fire the database callback. Attaching a database object as the 3rd parameter will always fire the database callback.

```javascript
function databaseCallback(dbObject){
    database.query('INSERT INTO `log` VALUES(?,?,?,?,?)',
            [dbObject.date, dbObject.time, dbObject.code, dbObject.message, JSON.stringyfy(dbObject.details)],
            function (err,payload) {
                if(err){
                    console.log("ERROR!");
                }
            });
}

logger.setDatabaseCallback(databaseCallback);
```

# Event Callback
You can atatch a function which can be fired upon log event which can be used to handle any other functionalities which should be executed up on a log event.
````javascript
function callback(data) {
    FacebookMessenger.Send(data.message);
}

logger.setCallback(callback);
````

# Log Switch Callback
You can attach a function which will be fired upon a log switch is being made. This functions should accept 3 parameters. New log file name, log switch event number and the previous log file name.
```Javascript
function logSwitchCb(newFileName, logEventName, previousLogFileName){
    console.log(newFileName, logEventName, previousLogFileName);
}

logger.setLogSwitchCallback(logSwitchCb);
```

# Virtual Logs
By enabling virtual logs you can fetch all log events (which are not hidden) as an array where the newest is on the top. Use the `enableVirtualLogs()` function to enable virtual logs. You can obtain the logs using `getVirtualConsoleLog()` and clear the virtual logs using the `clearVirtualConsoleLog()`. **This feature is disabled by default.** For manually disabling this feature at runtime use `disbleVirtualLogs()` function.

# Help and Support
For any queries drop an email to sulochana.456@live.com
