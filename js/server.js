'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { perMessageDeflate: false });
const port = process.env.PORT || 3000;

const { Room } = require('./Room.js');

const defaultSettings = 'Tsu 0.036 12 6 0.27 4 70';
const MAX_FRAME_DIFFERENCE = 20;

let gameCounter = 1;		// The running number of games (used for assigning ids)

const socketIdToId = new Map();

app.use(express.static('./'));

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);
		socketIdToId.set(socket.id, gameCounter);
		console.log(`Assigned gameId ${gameCounter}`);
		gameCounter++;
	});

	socket.on('cpuMatch', gameInfo => {
		const { gameId, roomSize, settingsString, cpus } = gameInfo;
		Room.leaveRoom(gameId);

		const members = new Map().set(gameId, { socket, frames: 0 });

		// Assign each cpu a negative id
		for(let i = 0; i < roomSize - 1; i++) {
			// TODO: Support more CPUS. In the meantime, any extras are given these defaults:
			const speed = cpus[i] ? cpus[i].speed : 100;
			const ai = cpus[i] ? cpus[i].ai : 'Test';

			members.set(-gameCounter, { socket: null, frames: 0, speed, ai });
			gameCounter++;
		}

		const roomId = Room.createRoom(members, roomSize, settingsString, 'cpu').roomId;
		Room.startRoom(roomId);
	});

	socket.on('cpuAssign', gameId => {
		socketIdToId.set(socket.id, gameId);
		Room.cpuAssign(gameId, socket);
	});

	socket.on('createRoom', gameInfo => {
		const { gameId, settingsString, roomSize } = gameInfo;
		Room.leaveRoom(gameId);

		const members = new Map().set(gameId, { socket, frames: 0 });

		const roomId = Room.createRoom(members, roomSize, settingsString).roomId;
		socket.emit('giveRoomId', roomId);
	});

	socket.on('joinRoom', gameInfo => {
		const { gameId, joinId } = gameInfo;
		Room.leaveRoom(gameId);

		try {
			Room.joinRoom(gameId, joinId, socket);
			console.log(`${gameId} has joined room ${joinId}.`);
		}
		catch(err) {
			socket.emit('joinFailure', err.message);
		}
	});

	socket.on('ranked', gameInfo => {
		const { gameId } = gameInfo;
		Room.leaveRoom(gameId);

		// No pending ranked game
		if(Room.rankedRoomId === null) {
			const members = new Map().set(gameId, { socket, frames: 0 });

			// Fixed settings for ranked rooms
			Room.createRoom(members, 2, defaultSettings, 'ranked');
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
			Room.createRoom(members, 2, defaultSettings, 'ffa');
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

		const room = Room.getRoomFromId(gameId);

		if(room === undefined) {
			// Leftover socket emissions from a disconnected player
			return;
		}

		const thisPlayer = room.members.get(gameId);
		thisPlayer.frames++;

		let minSteps = Infinity, minId = null;

		room.members.forEach((player, id) => {
			if(!room.spectating.includes(id)) {		// Exclude spectators
				const frames = player.frames;
				if(frames < minSteps) {
					minSteps = frames;
					minId = id;
				}
			}
		});

		// Too fast
		if(thisPlayer.frames - minSteps > MAX_FRAME_DIFFERENCE) {
			socket.emit('pause');
			room.paused.push(gameId);

			// Start timeout if everyone except one player is paused
			if(room.paused.length === room.members.size - 1 && room.timeout === null) {
				room.timeout = setTimeout(() => {
					room.members.get(minId).socket.emit('timeout');

					// Restart all other members
					room.members.forEach((player, id) => {
						if(id !== minId) {
							player.socket.emit('play');
							player.socket.emit('timeoutDisconnect', minId);
						}
					});

					Room.leaveRoom(minId);
				}, 30000);
			}
		}
		// Caught up
		else if(thisPlayer.frames === minSteps) {
			const toRemove = [];
			room.paused.forEach(id => {
				// Restart every socket that is no longer too far ahead
				if(room.members.get(id).frames - thisPlayer.frames < MAX_FRAME_DIFFERENCE - 5) {
					room.members.get(id).socket.emit('play');
					toRemove.push(id);
				}
			});

			// Remove the restarted ids
			room.paused = room.paused.filter(id => !toRemove.includes(id));

			// If the slow player has caught up, stop timeout
			if(room.paused.length < room.members.size - 1 && room.timeout !== null) {
				clearTimeout(room.timeout);
				room.timeout = null;
			}
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

		// Disconnect any cpus who have lost to conserve resources
		if(gameId < 0) {
			Room.leaveRoom(gameId);
			socket.disconnect();
		}
		else {
			Room.spectateOwnRoom(gameId);
		}
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
