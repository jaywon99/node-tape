var util = require('util');
var net = require("net");
var fs = require('fs');
var tape_server = require('./tape_server');

/*
process.on("uncaughtException", function(e) {
    console.log(e);
});
*/

if (process.argv.length != 5) {
  console.log("Require the following command line arguments:" +
    " tape-filename service_host service_port");
    console.log(" e.g. 9001 www.google.com 80 tape-file");
  process.exit();
}

var tape_file = process.argv[2];
var serviceHost = process.argv[3];
var servicePort = process.argv[4];
var tape_rs = fs.createReadStream(tape_file);

var counter = 1;

var server = tape_server.createServer(function(proxySocket) {
  // console.log((new Date()).getTime(), counter++);
  var connected = false;
  var buffers = new Array();
  var serviceSocket = new net.Socket();
  serviceSocket.connect(parseInt(servicePort), serviceHost, function() {
    connected = true;
    if (buffers.length > 0) {
      for (i = 0; i < buffers.length; i++) {
//        console.log(buffers[i]);
        serviceSocket.write(buffers[i]);
      }
      buffers = new Array();
    }
  });
  proxySocket.on("error", function (e) {
    serviceSocket.end();
  });
  serviceSocket.on("error", function (e) {
    console.log("Could not connect to service at host "
      + serviceHost + ', port ' + servicePort);
    proxySocket.end();
  });
  proxySocket.on("data", function (data) {
    if (connected) {
      serviceSocket.write(data);
    } else {
      buffers[buffers.length] = data;
    }
  });
  serviceSocket.on("data", function(data) {
    proxySocket.write(data);
  });
  proxySocket.on("close", function(had_error) {
    serviceSocket.end();
  });
  serviceSocket.on("close", function(had_error) {
    proxySocket.end();
  });
}).listen(tape_rs).on("close", function() {
  console.log("Server: "+(server.processed)+" Chunk Processed");
  console.log("DONE!!!!!");
  process.exit(0);
});

var idle_loop = function() {
  console.log("Server: "+(server.processed)+" Chunk Processed");
  setTimeout(idle_loop, 1000);
};
idle_loop();

