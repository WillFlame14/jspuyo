'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;
const path = require('path');

let gameCounter = 1;
let waitingOpponent = null;

app.use(express.static('./'));

app.get('/', function(req, res) {
  res.sendFile(path.resolve('index.html'));
});

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);
		console.log('assigned gameId ' + gameCounter);
		gameCounter++;
	});

	socket.on('findOpponent', (gameId, gameDrop_colours) => {
		if(waitingOpponent === null) {
			waitingOpponent = { gameId: gameId, gameDrop_colours: gameDrop_colours, socket: socket };
		}
		else {
			waitingOpponent.socket.emit('start', gameId, gameDrop_colours);
			socket.emit('start', waitingOpponent.gameId, waitingOpponent.gameDrop_colours);
			console.log('matched ' + gameId + ' with ' + waitingOpponent.gameId);
			waitingOpponent = null;
		}
	});

	socket.on('move', data => socket.broadcast.emit("move", data));
	socket.on('rotate', data => socket.broadcast.emit("rotate", data));
	socket.on('newDrop', (gameId, drop_colours)=> {
		socket.broadcast.emit('newDrop', gameId, drop_colours);
	});
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});