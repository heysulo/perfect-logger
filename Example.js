const logger = require('./perfect-logger');

// Callback function which accepts only one parameter
function callback(obj) {
    console.log('CALLBACK OUTPUT:', obj);
}

// Custom status codes
// logger,addStatusCode(<alias>, <code>, <verboseLevel>, <color>);
// !IMPORTANT: should be called before the `initialize` function.
/**
 * Available colors
 * BLACK, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, WHITE
 */
logger.addStatusCode('sock', 'SOCK', 2, 'MAGENTA');
logger.addStatusCode('match', 'MATCH', 5, 'CYAN');

logger.initialize('MyApplicationName', {
    logLevelFile: 0,                        // File log level
    logLevelCallback: 0,                  // Callback log level
    logLevelConsole: 4,                     // Console log level
    developmentMode: true,                 // development mode
    timezone: 'Asia/Colombo',               // Set timezone
    logDirectory: 'logs/',                  // Directory to save log files
    callbackLogEvent: callback,             // callback function
    customBannerHeaders: 'This is a custom banner'  // Custom banner to be printed in log file
});

// logging messages
logger.info("This is an information");
logger.warn("This is a warning");
logger.crit("This is a critical message");
logger.sock("This is a socket event");          // Custom status code
logger.match("This is a match event");          // Custom status code

// logging messages with objects
logger.debug('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.info('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.warn('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.crit('Wassup', {eyes: 2, feet: 2, hands: 2, eyeColor: 'blue'});
logger.sock('WTF man', {s: 2});          // Custom status code
logger.match('Match man', {e: 2});          // Custom status code