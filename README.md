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
- Custom log codes with log levels
- Log event call back support
- Colored terminal output

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
logger.initialize('FrontEndDriver', {
    logLevelFile: 0,                    // Log level for file
    logLevelConsole: 0,                 // Log level for STDOUT/STDERR
    logDirectory: 'logs/',              // Log directory
    customBannerHeaders: 'This is a custom banner'  // Custom Log Banner
});

// Use
logger.info("This is an information");
logger.warn("This is a warning");
logger.crit("This is a critical message");
logger.debug('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.info('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.warn('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.crit('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
```
Sample Terminal Output
```
 2020/02/21 | 18:26:00 | INFO | This is an information 
 2020/02/21 | 18:26:00 | WARN | This is a warning 
 2020/02/21 | 18:26:00 | CRIT | This is a critical message 
 2020/02/21 | 18:26:00 | DEBUG | Wassup 
 2020/02/21 | 18:26:00 | INFO | Wassup 
 2020/02/21 | 18:26:00 | WARN | Wassup 
 2020/02/21 | 18:26:00 | CRIT | Wassup
```
Sample Log File
```
***************************************************************************************************
*** 
*** This is a custom banner
*** 
***************************************************************************************************
*** 
*** Module Name          : FrontEndDriver
*** Project Name         : perfect-logger
*** Version              : 1.6.1
*** Configured Timezone  : Asia/Colombo
*** 
***************************************************************************************************
*** 
*** Log Number           : #1
*** Process Start Time   : 2/21/2020, 6:28:33 PM
*** Log Start Time       : 2/21/2020, 6:28:33 PM
*** Log Level            : 0
*** Continuing From      : None
*** 
***************************************************************************************************
*** 
*** Hostname             : XS3
*** OS Release           : 4.15.0-50-generic
*** Platform             : linux
*** NodeJS Version       : 8.17.0
*** OpenSSL Version      : 1.0.2s
*** 
***************************************************************************************************
*** 
*** DEPENDENT NPM PACKAGE DETAILS
*** 
*** perfect-logger@1.6.1 /home/sulochana/Documents/perfect-logger
*** ├── body-parser@1.19.0
*** ├── popper.js@1.16.0
*** ├── run-sequence@2.2.1
*** ├── socket.io@2.3.0
*** └── socket.io-client@2.3.0
*** 
*** 
***************************************************************************************************
2020/02/21 | 18:28:35 | INFO | This is an information
2020/02/21 | 18:28:35 | WARN | This is a warning
2020/02/21 | 18:28:35 | CRIT | This is a critical message
2020/02/21 | 18:28:35 | DEBUG | Wassup
[61]~ {
[61]~     "eyes": 2,
[61]~     "feet": 2,
[61]~     "hands": 2,
[61]~     "eyeColor": "blue"
[61]~ }
2020/02/21 | 18:28:35 | INFO | Wassup
[BQ]~ {
[BQ]~     "eyes": 2,
[BQ]~     "feet": 2,
[BQ]~     "hands": 2,
[BQ]~     "eyeColor": "blue"
[BQ]~ }
2020/02/21 | 18:28:35 | WARN | Wassup
[A8]~ {
[A8]~     "eyes": 2,
[A8]~     "feet": 2,
[A8]~     "hands": 2,
[A8]~     "eyeColor": "blue"
[A8]~ }
2020/02/21 | 18:28:35 | CRIT | Wassup
[KQ]~ {
[KQ]~     "eyes": 2,
[KQ]~     "feet": 2,
[KQ]~     "hands": 2,
[KQ]~     "eyeColor": "blue"
[KQ]~ }
```
# Configuration Options
Configuration options needs to passed during the initialization. All these options are optional.
Example
```javascript
logger.initialize('ApplicationName', {
    logLevelFile: 0,                    // Log level for file
    logLevelConsole: 0,                 // Log level for STDOUT/STDERR
    logDirectory: 'logs/',              // Log directory
    customBannerHeaders: 'This is a custom banner'  // Custom Log Banner
});
```

## Log Level
Log levels margins are as follow. You may declare your own log codes within the range `-1 <= logLevel <= 10` 
```javascript
DISABLED: -1
DEBUG: 0
INFO: 4
WARNING: 8
CRITICAL: 10
```

## Log File
The log file will be saved as `<ApplicationName>.log` in the current working directory. Any existing log file with the same name will be renamed to following format `<ApplicationName>.<ProcessID>.<ProcessStartTime>.log`.
Therefore the log file of the currently running process is always `<ApplicationName>.log`. You can change the log directory using the following option

```javascript
logDirectory: './ApplicationLogs'
```

Sets the log level for the file output. The default value is `0` (LOG_LEVEL_DEBUG). Setting log level to `-1` or any negative number will disable the log file. 
```javascript
logLevelFile: 0
``` 

Setting a maximum log file size will allow you to switch to new log file when the file size limit is reached. This is usefull to split log files. You must provide the size limit in **Bytes**.
```javascript
maximumLogFieSize: 102400000
```

You can add a custom banner to log file
```javascript
customBannerHeaders: 'This is a custom banner'
```

## Console Log
Set the log level for the console output. The default value is 4 (LOG_LEVEL_INFO). Setting log level to `-1` or any negative number will disable the console output.
```javascript
logLevelConsole: 0
```

## Callback
You can set a callback function whenever a log event is fired. This callback function should accept on parameter.
```javascript
function myCallbackFunction(obj) {
    console.log('CALLBACK OUTPUT:', obj);
}

logger.initialize('FrontEndDriver', {
    callbackLogEvent: myCallbackFunction
});
```
The object passed into the function will be in following example format
```javascript
{
    alias: 'info',
    message: 'Sample log message',
    code: 'INFO',
    color: 'red',
    logLevel: 4,
    time: '20:05:49',
    date: '2020/02/21',
    object: {}
}
``` 

Set the log level for the callback. The default value is 0 (LOG_LEVEL_DEBUG). Setting log level to `-1` or any negative number will disable the callback.
```javascript
logLevelCallback: 0
```

## Timezone
You can change the logging timezone with the following option. Default timezone is UTC
You can find a list of TimeZones here : https://timezonedb.com/time-zones

```javascript
timezone: 'Asia/Colombo'
```

## Development Mode
You can enable development with the following option. This will maintain a single log file. 
```javascript
developmentMode: true
```

# Help and Support
For any queries drop an email to sulochana.456@live.com
