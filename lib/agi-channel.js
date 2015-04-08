/* eslint no-var: 0 */
// var sync = require('sync');
var syncho = require('syncho');
var util = require('util');
var events = require('events');
var sprintf = require('sprintf-js').sprintf;

var AGIReply = function (line) {
  this.rawReply = line.trim();
  this.code = parseInt(this.rawReply);
  this.attributes = {};

  var self = this;

  var items = this.rawReply.split(' ');
  items.forEach(function (item) {
    if (item.indexOf('=') > 0) {
      var subItems = item.split('=');
      self.attributes[subItems[0]] = subItems[1];
    }
  });

  var m = this.rawReply.match(/\((.*)\)/);
  if (m) {
    this.extra = m[1];
  }
};


var AGIChannel = function (request, mapper) {
  events.EventEmitter.call(this);

  var self = this;
  self.request = request;
  self.cmdId = 0;

  if (typeof mapper == 'function') {
    mapper = {
      default: mapper
    };
  } else if (typeof mapper != 'object') {
    self.emit('error', 'Invalid mapper');
    return;
  }

  // locate the script
  var script;
  if (request.network_script) {
    script = mapper[script];
  }

  if (!script) {
    script = mapper.default;
  }

  if (!script) {
    self.emit('error', 'Could not find requested script');
    return;
  }

  process.nextTick(function () {
    syncho(function () {
      try {
        script(self);
      } catch (ex) {
        console.log('Exception in script', ex, ex.stack);
      }
      self.emit('done'); // script has finished
    });
  });
};

util.inherits(AGIChannel, events.EventEmitter);

AGIChannel.prototype.handleReply = function (reply) {
  if (this.callback) {
    if (reply == 'hangup') {
      this.callback('hangup');
    } else {
      this.callback(null, new AGIReply(reply));
    }
  }
};

AGIChannel.prototype._sendRequest = function (request, callback) {
  this.callback = callback;
  this.cmdId = this.cmdId + 1;
  this.emit('request', request, this.cmdId);
};

AGIChannel.prototype.sendRequest = function (request) {
  return this._sendRequest.sync(this, request);
};


// external API
AGIChannel.prototype.answer = function () {
  var result = this.sendRequest('ANSWER');

  return parseInt(result.attributes.result || -1);
};

AGIChannel.prototype.channelStatus = function (channelName) {
  channelName = channelName || '';

  var result = this.sendRequest(sprintf('CHANNEL STATUS %s', channelName));

  return parseInt(result.attributes.result || -1);
};

AGIChannel.prototype.exec = function (app, params) {

  if (params == undefined) {
    params = '';
  }

  return this.sendRequest(sprintf('EXEC %s %s', app, params));
};

AGIChannel.prototype.getData = function (file, timeout, maxDigits) {
  timeout = (timeout == undefined) ? '' : timeout;
  maxDigits = (maxDigits == undefined) ? '' : maxDigits;

  var result = this.sendRequest(sprintf('GET DATA "%s" %s %s', file, timeout,
    maxDigits));

  return result.attributes.result;
};

AGIChannel.prototype.getFullVariable = function (variable, channel) {
  channel = (channel == undefined) ? '' : channel;

  var result = this.sendRequest(sprintf('GET FULL VARIABLE %s %s', variable, channel));

  if (result.extra) {
    return result.extra;
  } else {
    return null;
  }
};

AGIChannel.prototype.getOption = function (file, escapeDigits, timeout) {
  escapeDigits = (escapeDigits == undefined) ? '' : escapeDigits;
  timeout = (timeout == undefined) ? '' : timeout;

  return this.sendRequest(sprintf('GET OPTION "%s" %s" %s', file, escapeDigits, timeout));
};

AGIChannel.prototype.getVariable = function (variable) {
  var result = this.sendRequest(sprintf('GET VARIABLE "%s"', variable));

  if (result.extra) {
    return result.extra;
  } else {
    return null;
  }
};


AGIChannel.prototype.noop = function () {
  return this.sendRequest('NOOP');
};

AGIChannel.prototype.recordFile = function (file, format, escapeDigits, timeout, silenceSeconds,
  beep) {
  format = format || 'wav';
  escapeDigits = escapeDigits || '';
  timeout = (timeout == undefined) ? -1 : timeout;
  silenceSeconds = (silenceSeconds == undefined) ? '' : 's=' + silenceSeconds;
  beep = (beep) ? 'BEEP' : '';


  return this.sendRequest(sprintf('RECORD FILE "%s" "%s" "%s" %s %s %s',
    file, format, escapeDigits, timeout, beep, silenceSeconds));
};


AGIChannel.prototype.streamFile = function (file, escapeDigits) {
  escapeDigits = escapeDigits || '';

  return this.sendRequest(sprintf('STREAM FILE "%s" "%s"', file, escapeDigits));
};

AGIChannel.prototype.hangup = function () {
  return this.sendRequest('HANGUP');
};


AGIChannel.prototype.setContext = function (context) {
  return this.sendRequest(sprintf('SET CONTEXT %s', context));
};

AGIChannel.prototype.setExtension = function (extension) {
  return this.sendRequest(sprintf('SET EXTENSION %s', extension));
};

AGIChannel.prototype.setPriority = function (priority) {
  return this.sendRequest(sprintf('SET PRIORITY %s', priority));
};

AGIChannel.prototype.setVariable = function (variable, value) {
  return this.sendRequest(sprintf('SET VARIABLE %s %s', variable, value));
};

AGIChannel.prototype.continueAt = function (context, extension, priority) {
  extension = extension || this.request.extension;
  priority = priority || 1;

  this.setContext(context);
  this.setExtension(extension);
  this.setPriority(priority);

  return;
};

AGIChannel.parseBuffer = function (buffer) {
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
};


module.exports = AGIChannel;
