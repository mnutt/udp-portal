var EventEmitter = require('events').EventEmitter;
var net = require('net');
var dgram = require('dgram');
var url = require('url');

module.exports = function(tunnelUri, destinationUri) {
  var ee = new EventEmitter();
  var server = net.createServer();

  tunnelUri = url.parse(tunnelUri);

  server.listen(tunnelUri.port, function() {
    console.log("Server bound to " + url.format(tunnelUri));
  });

  var handler = function(socket) {
    console.log("Client connected: " + socket.remoteAddress);

    var messageCount = 0;
    var current_buff = undefined;
    var current_size = 0;
    var current_offset = 0;

    var debug = setInterval(function() {
      console.log("Client " + socket.remoteAddress + " sent " + messageCount + " messages.");
      messageCount = 0;
    }, 10 * 1000);

    socket.on('close', function() {
      clearInterval(debug);
    });

    socket.on('data', function(chunk) {

      var read_offset = 0;

      while (read_offset < chunk.length) {

        if (!current_buff) {
          var msg_size = chunk.readUInt16BE(read_offset);
          current_buff = new Buffer(msg_size);
          current_size = msg_size;
          current_offset = 0;
          read_offset += 2;

          // let next loop iteration read the chunk
          continue;
        }

        // we already have a working buffer
        var remaining_read = current_size - current_offset;
        var read_bytes = Math.min(remaining_read, chunk.length - read_offset);
        chunk.copy(current_buff, current_offset, read_offset, read_offset + read_bytes);
        current_offset += read_bytes;
        read_offset += read_bytes;

        if (current_offset < current_size) {
          continue;
        }

        messageCount += 1;
        ee.emit('message', current_buff);

        current_buff = undefined;
        current_size = 0;
        current_offset = 0;
      }
    });
  };

  server.on('connection', handler);


  var destinationPort = destinationUri.port;
  var destinationIp = destinationUri.hostname;

  var udp = dgram.createSocket('udp4');

  udp.bind(destinationPort, function(err) {
    if (err) {
      return ee.emit('error', err);
    }

    console.log("Connected to tunnel " + url.format(destinationUri));

    //udp.addMembership(destinationIp);
  });

  var out_queue = [];

  ee.on('message', function(buff) {
    if (out_queue.length > 0) {
      return out_queue.push(buff);
    }

    flush_queue(buff);
  });

  function flush_queue(buff) {
    if (!buff) {
      return;
    }

    udp.send(buff, 0, buff.length, destinationPort, destinationIp, function(err) {
      if (err) {
        return ee.emit('error', err);
      }

      setImmediate(flush_queue, out_queue.shift());
    });
  }

  return ee;
};
