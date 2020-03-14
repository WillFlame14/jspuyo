'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
	perMessageDeflate: false
});
const port = process.env.PORT || 3000;
const path = require('path');

// Temporary fixed size of all games. Investigate better lobby system in the future.
const game_size = 2;

let gameCounter = 1;
let waitingOpponents = [];

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

	socket.on('findOpponent', gameId => {
		if(waitingOpponents.length < game_size - 1) {
			waitingOpponents.push({ gameId: gameId, socket: socket });
		}
		else {
			waitingOpponents.forEach(player => {
				player.socket.emit('start', waitingOpponents.map(p => p.gameId).filter(id => id !== player.gameId).concat(gameId));
			});
			socket.emit('start', waitingOpponents.map(player => player.gameId));
			console.log('matched gameIds:' + gameId + " " + JSON.stringify(waitingOpponents.map(player => player.gameId)));
			waitingOpponents = [];
		}
	});

	socket.on('sendBoard', (gameId, boardHash) => {
		socket.broadcast.emit('sendBoard', gameId, boardHash);
	});

	socket.on('sendNuisance', (gameId, nuisance) => {
		socket.broadcast.emit('sendNuisance', gameId, nuisance);
	})

	socket.on('activateNuisance', gameId => {
		socket.broadcast.emit('activateNuisance', gameId);
	});

	socket.on('disconnect', () => {
		if(waitingOpponents.length > 0) {
			waitingOpponents = waitingOpponents.filter(player => player.socket !== socket);
		}
	});
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});