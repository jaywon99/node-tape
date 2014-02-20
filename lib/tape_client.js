var events = require('events');
var util = require('util');

// create EventEmitter
module.exports = MockSocket;

function MockSocket() {
  if (!(this instanceof MockSocket)) {
    return new MockSocket();
  }
}

util.inherits(MockSocket, events.EventEmitter);

MockSocket.prototype.end = function() {
};

MockSocket.prototype.write = function(data) {
};

