'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;
const path = require('path');

app.use(express.static('./'));

app.get('/', function(req, res) {
  res.sendFile(path.resolve('index.html'));
});

io.on('connection', function(socket) {
  socket.on('move', data => socket.broadcast.emit("move", data));
  socket.on('rotate', data => socket.broadcast.emit("rotate", data));
});

http.listen(port, function() {
  console.log('Listening on port: ' + port);
});