'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { perMessageDeflate: false });
const io_client = require('socket.io-client');
const port = process.env.PORT || 3000;

const { Room } = require('./Room.js');

const defaultSettings = 'Tsu 0.036 12 6 0.27 4 70';

let gameCounter = 1;		// The running number of games (used for assigning ids)
let cpuCounter = 1;

const socketIdToId = new Map();
const cpuInfos = new Map();

app.use(express.static('./'));

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);
		socketIdToId.set(socket.id, gameCounter);
		console.log(`Assigned gameId ${gameCounter}`);
		gameCounter++;
	});

	socket.on('cpuMatch', async gameInfo => {
		const { gameId, roomSize, settingsString, cpus } = gameInfo;
		Room.leaveRoom(gameId);

		const members = new Map().set(gameId, { socket, frames: 0 });
		const promises = [];
		cpuInfos.set(gameId, new Map());

		// Assign each cpu a negative id
		cpus.forEach(cpu => {
			// TODO: Support more CPUS. In the meantime, any extras are given these defaults:
			const cpuSocket = io_client.connect('http://localhost:3000');
			const cpuId = -cpuCounter;
			cpuCounter++;

			cpuInfos.get(gameId).set(cpuId, { client_socket: cpuSocket });

			const promise =	new Promise(resolve => {
				cpuSocket.emit('cpuAssign', gameId, cpuId, cpu, () => resolve());
			});
			promises.push(promise);
		});
		await Promise.all(promises);

		const roomId = Room.createRoom(gameId, members, cpuInfos.get(gameId), roomSize, settingsString).roomId;
		cpuInfos.delete(gameId);
		Room.startRoom(roomId);
	});

	socket.on('cpuAssign', (gameId, cpuId, cpu, callback) => {
		const { speed, ai } = cpu;

		socketIdToId.set(socket.id, cpuId);
		const cpuInfo = cpuInfos.get(gameId).get(cpuId);
		cpuInfo.socket = socket;
		cpuInfo.speed = speed;
		cpuInfo.ai = ai;
		cpuInfos.get(gameId).set(cpuId, cpuInfo);

		callback();
	});

	socket.on('createRoom', gameInfo => {
		const { gameId, settingsString, roomSize } = gameInfo;
		Room.leaveRoom(gameId);

		const members = new Map().set(gameId, { socket, frames: 0 });

		const roomId = Room.createRoom(gameId, members, [], roomSize, settingsString).roomId;
		socket.emit('giveRoomId', roomId);
	});

	socket.on('joinRoom', gameInfo => {
		const { gameId, joinId } = gameInfo;
		Room.leaveRoom(gameId);
		Room.joinRoom(gameId, joinId, socket);
	});

	socket.on('spectate', gameInfo => {
		console.log(gameInfo);
		console.log(socket.id);
		const { gameId, roomId } = gameInfo;
		Room.leaveRoom(gameId);
		Room.spectateRoom(gameId, socket, roomId);
	});

	socket.on('getAllRooms', () => {
		socket.emit('allRooms', Room.getAllRooms());
	});

	socket.on('getPlayers', roomId => {
		socket.emit('givePlayers', Room.getPlayers(roomId));
	});

	socket.on('ranked', gameInfo => {
		const { gameId } = gameInfo;
		Room.leaveRoom(gameId);

		// No pending ranked game
		if(Room.rankedRoomId === null) {
			const members = new Map().set(gameId, { socket, frames: 0 });

			// Fixed settings for ranked rooms
			Room.createRoom(gameId, members, [], 2, defaultSettings, 'ranked');
		}
		// Pending ranked game
		else {
			try {
				Room.joinRoom(gameId, Room.rankedRoomId, socket);
				console.log(`${gameId} has joined the ranked queue.`);
			}
			catch(err) {
				socket.emit('joinFailure', err.message);
			}
		}
	});

	socket.on('freeForAll', (gameInfo, suppress) => {
		const { gameId } = gameInfo;

		// Suppress error from leaving non-existent room
		if(!suppress === 'suppress') {
			Room.leaveRoom(gameId);
		}

		if(Room.defaultQueueRoomId === null) {
			const members = new Map().set(gameId, { socket, frames: 0 });

			// Fixed settings for FFA rooms
			Room.createRoom(gameId, members, [], 2, defaultSettings, 'ffa');
		}
		else {
			try {
				const room = Room.joinRoom(gameId, Room.defaultQueueRoomId, socket);

				// Start game in 30s if there are at least 2 players
				if(room.members.size >= 2 && room.quickPlayTimer === null) {
					room.quickPlayTimer = setTimeout(() => {
						Room.startRoom(room.roomId);
					}, 30000);
				}
			}
			catch(err) {
				socket.emit('joinFailure', err.message);
			}
		}
		console.log(`${gameId} has joined the default queue.`);
	});

	// Upon receiving an emission from a client socket, broadcast it to all other client sockets
	socket.on('sendState', (gameId, boardHash, currentScore, totalNuisance) => {
		socket.to(Room.getRoomIdFromId(gameId)).emit('sendState', gameId, boardHash, currentScore, totalNuisance);

		// CPUs do not trigger frame advances
		if(gameId > 0) {
			Room.advanceFrame(gameId);
		}
	});

	// Player sent a chat message
	socket.on('sendMessage', (gameId, message) => {
		// Send to everyone in the room, including sender
		io.in(Room.getRoomIdFromId(gameId)).emit('sendMessage', gameId, message);
	});

	// Player emitted a sound
	socket.on('sendSound', (gameId, sfx_name, index) => {
		socket.to(Room.getRoomIdFromId(gameId)).emit('sendSound', gameId, sfx_name, index);
	});

	// Player emitted a voiced clip
	socket.on('sendVoice', (gameId, character, audio_name, index) => {
		socket.to(Room.getRoomIdFromId(gameId)).emit('sendVoice', gameId, character, audio_name, index);
	});

	// Player started sending nuisance
	socket.on('sendNuisance', (gameId, nuisance) => {
		socket.to(Room.getRoomIdFromId(gameId)).emit('sendNuisance', gameId, nuisance);
	});

	// Player finished a chain
	socket.on('activateNuisance', gameId => {
		socket.to(Room.getRoomIdFromId(gameId)).emit('activateNuisance', gameId);
	});

	// Player was eliminated
	socket.on('gameOver', gameId => {
		socket.to(Room.getRoomIdFromId(gameId)).emit('gameOver', gameId);
	});

	// Game is over for all players
	socket.on('gameEnd', roomId => {
		Room.disconnectAll(roomId);
	});

	socket.on('forceDisconnect', (gameId, roomId) => {
		Room.leaveRoom(gameId, roomId);
	});

	socket.on('disconnect', () => {
		const gameId = socketIdToId.get(socket.id);

		// CPU sockets get disconnected by the server - they have already been removed from the room
		if(gameId > 0) {
			Room.leaveRoom(gameId);
		}
		socketIdToId.delete(socket.id);
		console.log(`Disconnected id ${gameId}`);
	});
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});
