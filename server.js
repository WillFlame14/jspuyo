'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { perMessageDeflate: false });
const io_client = require('socket.io-client');
const port = process.env.PORT || 3000;

const { Room } = require('./src/Room.js');

const defaultSettings = 'Tsu 0.036 12 6 0.27 4 70';

let cpuCounter = 1;

const socketIdToId = new Map();
const cpuInfos = new Map();

app.use('/', express.static('./public/'));

io.on('connection', function(socket) {
	socket.on('register', displayName => {
		console.log(Array.from(socketIdToId.values()));
		if(Array.from(socketIdToId.values()).includes(displayName)) {
			console.log('duplicate register???');
		}
		socketIdToId.set(socket.id, displayName);
		console.log(`User ${displayName} has logged in.`);
		socket.emit('registered');
	});

	socket.on('addCpu', gameId => {
		const index = Room.addCpu(gameId);
		socket.emit('addCpuReply', index);
	});

	socket.on('removeCpu', gameId => {
		const index = Room.removeCpu(gameId);
		socket.emit('removeCpuReply', index);
	});

	socket.on('requestCpus', gameId => {
		const cpus = Room.requestCpus(gameId);
		socket.emit('requestCpusReply', cpus);
	});

	socket.on('setCpus', async (gameInfo) => {
		const { gameId, cpus } = gameInfo;

		const promises = [];

		// Temporarily store in a shared map
		cpuInfos.set(gameId, new Map());

		// Assign each cpu a negative id
		cpus.forEach(cpu => {
			const cpuSocket = io_client.connect('http://localhost:3000');
			const cpuId = 'CPU-' + cpuCounter;
			cpuCounter++;

			cpuInfos.get(gameId).set(cpuId, { client_socket: cpuSocket });

			const promise =	new Promise(resolve => {
				cpuSocket.emit('cpuAssign', gameId, cpuId, cpu, () => resolve());
			});
			promises.push(promise);
		});
		await Promise.all(promises);

		Room.setCpus(gameId, cpuInfos.get(gameId));

		// Delete the temporarily stored info
		cpuInfos.delete(gameId);
	});

	socket.on('startRoom', async gameId => {
		Room.startRoom(null, gameId, socket);
	});

	socket.on('cpuAssign', (gameId, cpuId, cpu, callback) => {
		const { speed, ai } = cpu;

		socketIdToId.set(socket.id, cpuId);
		const cpuInfo = cpuInfos.get(gameId).get(cpuId);
		cpuInfo.socket = socket;
		cpuInfo.speed = speed;
		cpuInfo.ai = ai;
		cpuInfos.get(gameId).set(cpuId, cpuInfo);

		// Resolve the promise to indicate that a socket has been created
		callback();
	});

	socket.on('createRoom', gameInfo => {
		const { gameId, settingsString, roomSize } = gameInfo;
		Room.leaveRoom(gameId);

		const members = new Map().set(gameId, { socket, frames: 0 });
		// Room creator becomes the host
		const host = gameId;

		const roomId = Room.createRoom(gameId, members, host, roomSize, settingsString).roomId;
		socket.emit('giveRoomId', roomId);
	});

	socket.on('requestJoinLink', gameId => {
		const roomId = Room.getRoomIdFromId(gameId);
		socket.emit('giveRoomId', roomId);
	});

	socket.on('changeSettings', (gameId, settingsString, roomSize) => {
		Room.changeSettings(gameId, settingsString, roomSize);
	});

	socket.on('joinRoom', gameInfo => {
		const { gameId, joinId } = gameInfo;
		Room.leaveRoom(gameId);
		Room.joinRoom(gameId, joinId, socket);
	});

	socket.on('spectate', (gameId, roomId = null) => {
		// RoomId is null if the user wishes to spectate their own room
		if(roomId !== null) {
			Room.leaveRoom(gameId);
		}
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
			const roomSize = 2;		// Fixed room size
			const host = null;		// No host for ranked games

			Room.createRoom(gameId, members, roomSize, host, defaultSettings, 'ranked');
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
			const roomSize = 2;		// Fixed room size
			const host = null;		// No host for FFA games

			// Fixed settings for FFA rooms
			Room.createRoom(gameId, members, roomSize, host, defaultSettings, 'ffa');
			console.log('room created');
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
		Room.advanceFrame(gameId);
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
		const roomId = Room.getRoomIdFromId(gameId);
		socket.to(roomId).emit('gameOver', gameId);
		Room.beenDefeated(gameId, roomId);
	});

	// Game is over for all players
	socket.on('gameEnd', roomId => {
		Room.endRoom(roomId);
	});

	socket.on('forceDisconnect', (gameId, roomId) => {
		Room.leaveRoom(gameId, roomId);
	});

	socket.on('disconnect', () => {
		const gameId = socketIdToId.get(socket.id);

		// CPU sockets get disconnected by the server - they have already been removed from the room
		if(gameId && !gameId.includes('CPU')) {
			Room.leaveRoom(gameId);
		}
		socketIdToId.delete(socket.id);
		console.log(`Disconnected ${gameId}`);
	});
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});
