var PictSharePort = 8080;
var PictShareFileSizeLimit = 1024 * 1024;

var http = require('http');
var fs = require('fs');
var url = require('url');
var sys = require('sys');
var path = require('path');

var staticResource = require('./libraries/static-resource');
//var mustache = require('./libraries/mustache');
var io = require('./libraries/socketio')
var couchdb = require('./libraries/couchdb') 

var handler = staticResource.createHandler(fs.realpathSync('./static'));
//var mustachedPages = new Array('/index.html');

var server = http.createServer(function(request, response) {
    var path = url.parse(request.url).pathname;
    if(path == '/') {
        path = '/index.html';
    }

    switch(path) {
      case '/upload':
        handleUpload(request, response);
        break;
      default:
        if(!handler.handle(path, request, response)) {
            response.writeHead(404);
            response.write('404');
            response.end();
        }
        break;
    }
});
server.listen(PictSharePort);

var numberOfClients = 0;
var listener = io.listen(server, {'transports': ['websocket']});
listener.on('connection', function(client) {
    sendNumberOfClients(1);
    client.on('disconnect', function() {
        sendNumberOfClients(-1);
    });
});
process.on('SIGINT', function () {
    sys.debug('SIG_INT detected. Shutting down!');
    shutdown();
});
sys.debug('pistshare is rocking!');


function handleUpload(request, response) {
    //sys.debug('called!');
    //sys.debug('version: '+request.httpVersion);
    //sys.debug(sys.inspect(request.headers));

    var base64data = new Buffer(0);
    request.addListener('data', function(chunk) {
        var newLength = base64data.length+chunk.length;
        if(newLength >= PictShareFileSizeLimit) {
            request.pause();

            response.writeHead(200, {'content-type': 'text/plain'});
            response.end('{"type":"error", "content": "File is too big! It needs to be < '+PictShareFileSizeLimit+' byes."}\n\n');
        } else {
            var newBuffer = new Buffer(base64data.length+chunk.length);
            base64data.copy(newBuffer, 0, 0);
            chunk.copy(newBuffer, base64data.length, 0);
            base64data = newBuffer;
        }
    });
    request.addListener('end', function() {
        var newData = base64data.toString('base64')/*base64data.toString('base64')*/;
        listener.broadcast('{"type":"image", "content":"data:image/png;base64,'+newData+'"}');
        
        response.writeHead(200, {'content-type': 'text/plain'});
        response.end('OK'+'\n\n');
    });
}

function sendNumberOfClients(change) {
    sys.debug('sending it.')
    numberOfClients += change;
    listener.broadcast('{"type":"users", "content":"'+numberOfClients+'"}');
}

function shutdown() {
    process.exit(0);
}

