var util = require('util');
var events = require('events');
var TapeClient = require('./tape_client');

exports = module.exports = TapeServer;

function TapeServer(options, connectionListener) {
  if (typeof options === 'function') {
    this.options = {};
    this.connectionListener = options;
  } else {
    this.options = options;
    this.connectionListener = connectionListener;
  }
  this.processed = 0;
}

util.inherits(TapeServer, events.EventEmitter);

TapeServer.prototype.listen = function(tape_rs) {
  var self = this;

  var tape_clients = {};
  var buffer = new Buffer(1);
  var filled = 0;
  var passed = 0;

  var startTime = 0;
  var launchTime = 0;
  var lastTime = 0;

  var handling = function() {
    // console.log("looping", filled, buffer.length);
    if (filled >= passed + 16) {

      var time_t = buffer.readDoubleLE(passed);
      if (startTime === 0) { startTime = time_t; launchTime = (new Date()).getTime(); }
      lastTime = time_t;
      var socket_id = buffer.readInt32LE(passed + 8);
      var cmd = buffer.readUInt16LE(passed + 12);
      var len = buffer.readUInt16LE(passed + 14);
      if (filled >= len+passed + 16) {
        if (socket_id > 0) {
          // proxy connection

          var processEvent = function() {
            self.processed++;
            var tape_client;
            if (cmd === 0) {
              // open
              tape_client = new TapeClient();
              tape_clients[socket_id] = tape_client;
              self.connectionListener(tape_client);
            } else {
              tape_client = tape_clients[socket_id];
              if (cmd === 1) { // close event
                tape_client.emit("close");
                delete tape_clients[socket_id];
              } else if (cmd === 3) { // error event
                tape_client.emit("error");
                delete tape_clients[socket_id];
              } else if (cmd === 2) { // data event
                tape_client.emit("data", buffer.slice(passed+16, passed+16+len));
              }
            }
            passed += (len+16);
            setImmediate(handling);
          };

          var next_time = time_t - startTime;
          var passed_time = ((new Date()).getTime() - launchTime);
          if (next_time > passed_time) {
            setTimeout(processEvent, next_time - passed_time);
          } else {
            setImmediate(processEvent);
          }

        } else {
          // skip it
          passed += (len+16);
          setImmediate(handling);
        }

      } else {
/*
        var next_time = lastTime - startTime;
        var passed_time = ((new Date()).getTime() - launchTime);
console.log("WAITING", next_time,passed_time, next_time - passed_time);
        if (next_time > passed_time) {
          setTimeout(function() { tape_rs.resume(); }, next_time - passed_time);
        } else {
          tape_rs.resume();
        }
*/
        tape_rs.resume();
      }

    } else {
/*
      var next_time = lastTime - startTime;
      var passed_time = ((new Date()).getTime() - launchTime);
console.log("WAITING", next_time,passed_time, next_time - passed_time);
      if (next_time > passed_time) {
        setTimeout(function() { tape_rs.resume(); }, next_time - passed_time);
      } else {
        tape_rs.resume();
      }
*/
      tape_rs.resume();
    }
  };

  tape_rs.on('data', function(chunk) {
    tape_rs.pause();
    // console.log("data", chunk.length, filled);
    if (!(chunk instanceof Buffer)) {
      chunk = new Buffer(chunk);
    }

    var nb = new Buffer((filled - passed) + chunk.length);
    buffer.copy(nb, 0, passed, filled);
    chunk.copy(nb, filled-passed);
    passed = 0;
    filled = nb.length;
    buffer = nb;

    handling();
  });

  tape_rs.on('end', function() {
    var check_empty_socket = function() {
      if (filled > passed) {
        setTimeout(check_empty_socket, 0);
      } else {
        self.emit('close');
      }
    };
    check_empty_socket();
  });

  return this;
};

exports.createServer = function() {
  return new TapeServer(arguments[0], arguments[1]);
};

