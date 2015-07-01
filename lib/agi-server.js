/* eslint no-var: 0 */

var util = require('util');
var events = require('events');
var AGIChannel = require('./agi-channel');
var net = require('net');

// Embedded connection handler
var AGIConnection = function(mapper, conn) {
  this.conn = conn;
  this.mapper = mapper;
  this.buffer = '';

  var self = this;
  conn.on('data', this.handleData.bind(this));
  conn.on('end', function() {
    if (self.handler) {
      self.handler('hangup');
    }
    self.conn.destroy();
  });
};

AGIConnection.prototype.handleData = function(data) {
  var self = this;

  data = data.toString();

  if (data.indexOf('HANGUP') == 0) {
    if (self.handler) {
      self.handler('hangup');
    }
    return;
  }

  if (self.handler) {
    self.handler(data.trim());
  } else {
    this.buffer += data;
    if (data.indexOf('\n\n') >= 0) {
      // environment is sent
      var request = AGIChannel.parseBuffer(this.buffer);
      var channel = new AGIChannel(request, this.mapper);
      this.handler = channel.handleReply.bind(channel);

      channel.on('request', function(req) {
        self.conn.write(req + '\n');
      });

      channel.on('done', function() {
        self.conn.destroy();
        self.conn = null;
      });

      channel.on('error', function() {
        self.conn.destroy();
        self.conn = null;
      });
    }
  }
};


var AGIServer = function(mapper, listenPort) {
  this.listenPort = listenPort || 4573;
  this.mapper = mapper;

  this.tcpServer = net.createServer(this.handleConnection.bind(this));

  var self = this;
  process.nextTick(function() {
    self.tcpServer.listen(self.listenPort, function() {
      self.emit('ready');
    });
  });
};

util.inherits(AGIServer, events.EventEmitter);

AGIServer.prototype.handleConnection = function(conn) {
  return new AGIConnection(this.mapper, conn);
};

module.exports = AGIServer;
