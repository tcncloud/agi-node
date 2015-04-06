/* eslint no-var: 0*/
/* global unescape */

var AGIChannel = require('./lib/agi-channel');
var events = require('events');
var util = require('util');
var net = require('net');


function parseBuffer(buffer) {
  var request = {};
  buffer.split('\n').forEach(function (line) {
    var items = line.split(/:\s?/);
    if (items.length == 2) {
      var name = items[0].trim();
      if (name.indexOf('agi_') == 0) {
        name = name.substring(4);
      }
      var value = items[1].trim();
      request[name] = value;
    }
  });

  return request;
}

var AsyncAGIServer = function (mapper, amiConnection) {
  events.EventEmitter.call(this);

  var self = this;
  self.amiConnection = amiConnection;
  self.mapper = mapper;
  self.channels = {};

  amiConnection.on('asyncagi', self.handleEvent.bind(self));
  amiConnection.on('hangup', self.handleHangup.bind(self));
};

util.inherits(AsyncAGIServer, events.EventEmitter);

AsyncAGIServer.prototype.handleHangup = function (hangup) {
  var handler = this.channels[hangup.channel];
  if (handler) {
    handler('hangup');
    delete this.channels[hangup.channel];
  }
};

AsyncAGIServer.prototype.handleEvent = function (event) {
  var channelName = event.channel;
  var handler;

  var self = this;

  if (event.event != 'AsyncAGI') {
    return;
  }

  var channel;
  if (event.subevent == 'Start') {
    // this is a start event
    // decode request
    var request = parseBuffer(unescape(event.env));

    channel = new AGIChannel(request, self.mapper);
    self.channels[channelName] = channel.handleReply.bind(channel);

    channel.on('request', function (req, cmdId) {
      var action = {
        action: 'agi',
        commandId: cmdId,
        command: req,
        channel: channelName
      };

      self.amiConnection.action(action);
    });

    channel.on('error', function (e) {
      console.log('Got error from script, e');
      self.amiConnection.action({
        action: 'hangup',
        channel: channelName
      });
    });

    channel.on('done', function () {
      delete self.channels[channelName];
      self.amiConnection.action({
        action: 'agi',
        command: 'ASYNCAGI BREAK',
        channel: channelName
      });

    });
  } else if (event.subevent == 'Exec') {
    handler = self.channels[channelName];
    if (handler) {
      handler(unescape(event.result));
    }
  }
};

var INIT = 0;
var DONE = 1;

// Embedded connection handler
var AGIConnection = function (mapper, conn) {
  this.conn = conn;
  this.mapper = mapper;
  this.buffer = '';

  var self = this;
  conn.on('data', this.handleData.bind(this));
  conn.on('end', function () {
    if (self.handler) {
      self.handler('hangup');
    }
    self.conn.destroy();
  });
};

AGIConnection.prototype.handleData = function (data) {
  var self = this;

  data = data.toString();

  if (data.indexOf('HANGUP') == 0) {
    if (self.handler) {
      self.hander('hangup');
    }
    return;
  }

  if (self.handler) {
    self.handler(data.trim());
  } else {
    this.buffer += data;
    if (data.indexOf('\n\n') >= 0) {
      // environment is sent
      var request = parseBuffer(this.buffer);
      var channel = new AGIChannel(request, this.mapper);
      this.handler = channel.handleReply.bind(channel);

      channel.on('request', function (req) {
        self.conn.write(req + '\n');
      });

      channel.on('done', function () {
        self.conn.destroy();
        self.conn = null;
      });

      channel.on('error', function () {
        self.conn.destroy();
        self.conn = null;
      });
    }
  }
};


var AGIServer = function (mapper, listenPort) {
  this.listenPort = listenPort || 4573;
  this.mapper = mapper;

  this.tcpServer = net.createServer(this.handleConnection.bind(this));

  var self = this;
  process.nextTick(function () {
    self.tcpServer.listen(self.listenPort, function () {
      self.emit('ready');
    });
  });
};

util.inherits(AGIServer, events.EventEmitter);

AGIServer.prototype.handleConnection = function (conn) {
  return new AGIConnection(this.mapper, conn);
};

module.exports = {
  AsyncAGIServer: AsyncAGIServer,
  AGIServer: AGIServer
};
