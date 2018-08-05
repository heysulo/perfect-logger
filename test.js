let http = require('http');
let logger = require('./perfect-logger');

function time() {
    return "time";
}

function databaseCallback(data) {
    console.log(data);
}

logger.addStatusCode("try", "TRY", false);
logger.setTimeZone("Asia/Colombo");
logger.setLogDirectory("./NodeLogs");
logger.setLogFileName("UCSCRES");
logger.setMaximumLogSize(10000);
logger.setApplicationInfo({
    name: "UCSC Results Center",
    banner: "Copyright 2080 Team whileLOOP Incorporated",
    version: "1.0.0"
});
logger.setDatabaseCallback(databaseCallback);
logger.initialize();
logger.log("Starting Server", "info");
logger.info("info");
logger.info("info with dbObj", { info: "OK"});
logger.warn("warn");
logger.switchLogs();
logger.crit("crit");
logger.try("Helloooooooo");

let i = 0;


//create a server object:
http.createServer(function (req, res) {
    for(i = 0; i < 100; i++){
        logger.info(`Logline ${i}`);
    }
    res.write('Hello World!'); //write a response to the client
    res.end(); //end the response
}).listen(8080); //the server object listens on port 8080