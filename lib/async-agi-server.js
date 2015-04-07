/* eslint no-var: 0 */
/* global unescape */

var events = require('events');
var util = require('util');
var AGIChannel = require('./agi-channel');

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
    var request = AGIChannel.parseBuffer(unescape(event.env));

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

module.exports = AsyncAGIServer;
