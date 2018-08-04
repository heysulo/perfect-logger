let http = require('http');
let logger = require('./modules/node-logger');

function time() {
    return "time";
}

logger.log("Starting Server", "info");
logger.addStatusCode("try", "TRY", false);
logger.info("info");
logger.warn("warn");
logger.crit("crit");
logger.try("Helloooooooo");

//create a server object:
http.createServer(function (req, res) {
    res.write('Hello World!'); //write a response to the client
    res.end(); //end the response
}).listen(8080); //the server object listens on port 8080