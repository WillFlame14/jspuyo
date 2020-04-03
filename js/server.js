'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
	perMessageDeflate: false
});
const port = process.env.PORT || 3000;

// Temporary fixed size of all games. Investigate better lobby system in the future.
const game_size = 2;

let gameCounter = 1;
let waitingOpponents = [];
let waitingSettingsStr = null;

app.use(express.static('./'));

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);
		console.log('assigned gameId ' + gameCounter);
		gameCounter++;
	});

	socket.on('findOpponent', gameInfo => {
		const { gameId, cpu, settingsString } = gameInfo;
		// For now, cannot play mixed games with CPUs and real opponents
		if(cpu) {
			const cpuIds = [];
			for(let i = 0; i < game_size - 1; i++) {
				cpuIds.push(-gameCounter);
				gameCounter++;
			}
			socket.emit('start', cpuIds, settingsString);
		}
		else {
			// Room is not yet full
			if(waitingOpponents.length < game_size - 1) {
				waitingOpponents.push({ gameId, socket });

				// Player to open the room
				if(waitingSettingsStr === null) {
					waitingSettingsStr = settingsString;
				}
			}
			// Room is full
			else {
				waitingOpponents.forEach(player => {
					player.socket.emit('start', waitingOpponents.map(p => p.gameId).filter(id => id !== player.gameId).concat(gameId), waitingSettingsStr);
				});
				// NOTE: the default settings object must be replaced if changing any modifiable global variables (e.g. board size)
				socket.emit('start', waitingOpponents.map(player => player.gameId), waitingSettingsStr);
				console.log('matched gameIds:' + gameId + " " + JSON.stringify(waitingOpponents.map(player => player.gameId)));
				waitingOpponents = [];
				waitingSettingsStr = null;
			}
		}
	});

	// Upon receiving an emission from a client socket, broadcast it to all other client sockets
	socket.on('sendState', (gameId, boardHash, currentScore, totalNuisance) => {
		socket.broadcast.emit('sendState', gameId, boardHash, currentScore, totalNuisance);
	});

	socket.on('sendSound', (gameId, sfx_name, index) => {
		socket.broadcast.emit('sendSound', gameId, sfx_name, index);
	})

	socket.on('sendNuisance', (gameId, nuisance) => {
		socket.broadcast.emit('sendNuisance', gameId, nuisance);
	})

	socket.on('activateNuisance', gameId => {
		socket.broadcast.emit('activateNuisance', gameId);
	});

	socket.on('gameOver', gameId => {
		socket.broadcast.emit('gameOver', gameId);
	})

	socket.on('disconnect', () => {
		if(waitingOpponents.length > 0) {
			waitingOpponents = waitingOpponents.filter(player => player.socket !== socket);
		}
	});
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});