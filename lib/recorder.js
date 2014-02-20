var util = require('util');
var net = require("net");
var fs = require('fs');

/*
process.on("uncaughtException", function(e) {
    console.log(e);
});
*/

if (process.argv.length != 6) {
  console.log("Require the following command line arguments:" +
    " proxy_port service_host service_port tape-filename");
    console.log(" e.g. 9001 www.google.com 80 tape-file");
  process.exit();
}

var proxyPort = process.argv[2];
var serviceHost = process.argv[3];
var servicePort = process.argv[4];
var tape_file = process.argv[5];
var tape_ws = fs.createWriteStream(tape_file);

var socketMap = {};
var proxy_socket_id = 1;
var server_socket_id = -1;

function destroySocketId(socket, origin) {
  var strkey = "";
  switch (origin) {
    case "proxy":
      strkey = socket.remoteAddress+":"+socket.remotePort;
      break;
    case "server":
      strkey = ":"+socket.localPort;
      break;
  }
  delete socketMap[strkey];
}

function getSocketId(socket, origin) {
  var strkey = "";
  switch (origin) {
    case "proxy":
      strkey = socket.remoteAddress+":"+socket.remotePort;
      break;
    case "server":
      strkey = ":"+socket.localPort;
      break;
  }
  if (!(socketMap[strkey])) {
    if (origin === 'proxy') {
      socketMap[strkey] = proxy_socket_id++;
    } else if (origin === 'server') {
      socketMap[strkey] = server_socket_id--;
    }
  }
  return socketMap[strkey];
}

function record_tape(socket_id, cmd, data) {
  var buf = new Buffer(16);
  var now = (new Date()).getTime();
  buf.writeDoubleLE(now, 0);
  buf.writeInt32LE(socket_id, 8);
  switch (cmd) {
    case 'connect':
      buf.writeUInt16LE(0, 12);
      buf.writeUInt16LE(0, 14);
      break;
    case 'close':
      buf.writeUInt16LE(1, 12);
      buf.writeUInt16LE(0, 14);
      break;
    case 'error':
      buf.writeUInt16LE(3, 12);
      buf.writeUInt16LE(0, 14);
      break;
    case 'data':
      buf.writeUInt16LE(2, 12);
      buf.writeUInt16LE(data.length, 14);
      break;
  }
  tape_ws.write(buf);
  if (data) tape_ws.write(data);
};

var counter=1;

var server = net.createServer(function (proxySocket) {
  record_tape(getSocketId(proxySocket, "proxy"), "connect");
if (counter % 1 === 0) console.log(counter++);
  var connected = false;
  var buffers = new Array();
  var serviceSocket = new net.Socket();
  var proxySocketId = getSocketId(proxySocket, "proxy");
  var serviceSocketId = "";
  serviceSocket.connect(parseInt(servicePort), serviceHost, function() {
    serviceSocketId = getSocketId(serviceSocket, "server");
    record_tape(serviceSocketId, "connect");
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
    record_tape(proxySocketId, "error");
    console.log("Could not receive from client "
      + serviceHost + ', port ' + servicePort + ", Reason: "+util.inspect(e));
    serviceSocket.end();
  });
  serviceSocket.on("error", function (e) {
    record_tape(serviceSocketId, "error");
    console.log("Could not connect to service at host "
      + serviceHost + ', port ' + servicePort + ", Reason: "+util.inspect(e));
    proxySocket.end();
  });
  proxySocket.on("data", function (data) {
    record_tape(proxySocketId, "data", data);
    if (connected) {
      serviceSocket.write(data);
    } else {
      buffers[buffers.length] = data;
    }
  });
  serviceSocket.on("data", function(data) {
    record_tape(serviceSocketId, "data", data);
    proxySocket.write(data);
  });
  proxySocket.on("close", function(had_error) {
    record_tape(proxySocketId, "close");
    destroySocketId(serviceSocket, "proxy");
    serviceSocket.end();
  });
  serviceSocket.on("close", function(had_error) {
    record_tape(serviceSocketId, "close");
    destroySocketId(serviceSocket, "server");
    proxySocket.end();
  });
});
server.listen(proxyPort);
server.on("close", function() {
  console.log("SERVER CLOSED");
});

