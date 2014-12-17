var net = require('net');
var dgram = require('dgram');
var url = require('url');

module.exports = function(listenUri, tunnelUri) {
  var messageCount = 0;

  var udp = dgram.createSocket('udp4');
  udp.bind(listenUri.port, function(err) {
    console.log("Server bound to " + url.format(listenUri));
  });

  var client = net.connect(tunnelUri.port, tunnelUri.hostname);

  client.on('connect', function() {
    console.log('Connected to destination ' + url.format(tunnelUri));
  });

  client.on('close', function() {
    console.error('Connection to destination ' + url.format(tunnelUri) + ' lost, reconnecting');
    setTimeout(function() {
      client.connect(tunnelUri.port, tunnelUri.hostname);
    }, 1000);
  })

  client.on('error', function(err) {
    console.log(err);
  });

  var handler = function handler(msg) {
    messageCount += 1;
    var buff = Buffer(2);
    buff.writeUInt16BE(msg.length, 0);
    client.write(buff);
    client.write(msg);
  };

  udp.on('message', handler);

  setInterval(function() {
    console.log("Received " + messageCount + " messages.");
    messageCount = 0;
  }, 10 * 1000);
};
