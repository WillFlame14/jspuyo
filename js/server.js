'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;
const path = require('path');

let gameCounter = 1;

app.use(express.static('./'));

app.get('/', function(req, res) {
  res.sendFile(path.resolve('index.html'));
});

io.on('connection', function(socket) {
	socket.on('register', () => {
		console.log('pinged');
		socket.emit('getGameId', gameCounter);
		gameCounter++;
	});
	socket.on('move', data => socket.broadcast.emit("move", data));
	socket.on('rotate', data => socket.broadcast.emit("rotate", data));
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});