let http = require('http');
let logger = require('./perfect-logger');

function time() {
    return "time";
}

function databaseCallback(data) {
    return
}

function callback(data) {
    console.log('ddd');
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
logger.initialize();
logger.log("Starting Server", "info");
logger.info("info");
logger.info("info with dbObj", { info: "OK"});
logger.warn("warn");
logger.crit("crit");
logger.try("Helloooooooo");
logger.check("Check");
logger.wew("Check");
logger.debug('hey heye');
logger.d2('hidden');

let i = 0;


//create a server object:
http.createServer(function (req, res) {
    for(i = 0; i < 10000; i++){
        logger.setLiveText(`Logline ${i}`);
    }
    res.write('Hello World!'); //write a response to the client
    res.end(); //end the response
}).listen(8080); //the server object listens on port 8080

console.log(logger.getVirtualConsoleLog());