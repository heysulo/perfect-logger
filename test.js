let http = require('http');
let logger = require('./perfect-logger');

function time() {
    return "time";
}

function databaseCallback(data) {
    return
}

function callback(data) {
    return
}

function logSwitchCb(n, o ,p){
    console.log(n, o, p)
}

logger.addStatusCode("try", "TRY", false, "red");
logger.addStatusCode("check", "CHK", false, logger.colors.magenta);
logger.addStatusCode("wew", "WEW", false, "SUN");
logger.addStatusCode("d2", "DBG2", false, "SUN", true);
logger.setTimeZone("Asia/Colombo");
logger.setLogDirectory("./NodeLogs");
logger.setLogFileName("UCSCRES");
logger.setMaximumLogSize(100000);
logger.setApplicationInfo({
    name: "UCSC Results Center",
    banner: "Copyright 2080 Team whileLOOP Incorporated",
    version: "1.0.0"
});
logger.setDatabaseCallback(databaseCallback);
logger.setCallback(callback);
logger.enableVirtualLogs();
logger.setLogSwitchCallback(logSwitchCb);
logger.maintainSingleLogFile();
logger.initialize();
logger.log("Starting Server", "info");
logger.info("info");
logger.info("info with dbObj", { info: "OK"});
logger.warn("warn");
logger.crit("crit");
logger.switchLogs();
logger.try("Helloooooooo");
logger.check("Check");
logger.wew("Check");
logger.debug('hey heye');
logger.d2('hidden');
logger.info("Helloooo \n multilline");
logger.writeData({
    test: 'sdadasdad',
    dd: true,
    sd: 9878798,
    nk: 46.56456
});
logger.writeData("this is \n just \nto test \n the multileine\n thing");

let i = 0;


//create a server object:
http.createServer(function (req, res) {
    for(i = 0; i < 1000; i++){
        logger.info(`Logline ${i}`);
        if (i%250 === 0)
            logger.switchLogs()
    }
    res.write('Hello World!'); //write a response to the client
    res.end(); //end the response
}).listen(8080); //the server object listens on port 8080

console.log(logger.getVirtualConsoleLog());
console.log(logger.getLogFileName());
logger.clearVirtualConsoleLog();
logger.disbleVirtualLogs();
console.log(logger.getAllLogFileNames());