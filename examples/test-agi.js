'use strict';

/* eslint no-var: 0 */
var AGIServer = require('../index').AGIServer;

function fakeCallback(param, callback) {
  setTimeout(function () {
    callback(null, param);
  }, 2000);
}

function testScript(channel) {
  try {
    console.log('Script got call %s -> %s', channel.request.callerid, channel.request.extension);
    channel.exec('ANSWER');
    channel.streamFile('beep');
    channel.hangup();

  } catch (ex) {
    console.log('Error in script', ex);
  }

  // var answerReply = channel.answer();
  // console.log('ANSWER', answerReply);

  // console.log('CHANNEL STATUS', channel.channelStatus());
  // console.log('GET UNIQUEID', channel.getVariable('UNIQUEID'));
  // console.log('GET JUNK', channel.getVariable('JUNK'));

  // console.log('beeping in 2 seconds');
  // channel.streamFile(fakeCallback.sync(null, 'beep'));


  // console.log('PLAYBACK', channel.streamFile('conf-adminmenu'));
  // console.log('PLAYBACK', channel.streamFile('conf-adminmenu'));

  // console.log('GET DATA:', channel.getData('beep'));

  // console.log('EXEC: ',
  //   channel.exec('Playback', 'beep'));
  // console.log('STREAM: ',
  //   channel.streamFile('conf-adminmenu', '5'));
  // console.log('STREAM2: ',
  //   channel.streamFile('beep', '5'));


  // console.log('CHANNEL STATUS',
  //   channel.channelStatus());
  // console.log('HANGUP: ',
  //   yield channel.hangup());
}

var server = new AGIServer(testScript, 4573);
