'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { perMessageDeflate: false });
const port = process.env.PORT || 3000;

const { Settings } = require('./Utils.js');
const defaultSettings = new Settings().toString();

let gameCounter = 1;		// The running number of games (used for assigning ids)

const rooms = {};
let defaultQueueRoomId = null;
let rankedRoomId = null;

const socketToIdMap = {};
const idToRoomMap = {};

let quickPlayTimer = null;

app.use(express.static('./'));

function indexInRoom(gameId, roomId) {
	const room = rooms[roomId];
	let index = -1;

	room.members.some((player, curr_index) => {
		if(player.gameId === gameId) {
			index = curr_index;
			return true;
		}
	});

	return index;
}

function createRoom(members, roomSize, settingsString, cpu = false, quickPlay = false) {
	const roomId = generateRoomId(6);

	// Temporary max room size
	if(roomSize > 16) {
		roomSize = 16;
	}
	else if (roomSize < 1) {
		roomSize = 1;
	}

	const room = {
		members: members.slice(),	// duplicate the array
		roomSize,
		settingsString,
		started: false,
		cpu,
		quickPlay
	};

	// Set up the maps
	rooms[roomId] = room;
	room.members.forEach(member => {
		idToRoomMap[member.gameId] = roomId;
	});

	console.log('Creating room ' + roomId + ' with gameIds: ' + JSON.stringify(room.members.map(member => member.gameId)));
	return roomId;
}

function joinRoom(gameId, roomId, socket) {
	const room = rooms[roomId];

	// If the room does not exist or is already full
	if(room === undefined || room.members.length === room.roomSize) {
		return false;
	}

	room.members.push({ gameId, socket});
	idToRoomMap[gameId] = roomId;
	console.log('Added gameId ' + gameId + ' to room ' + roomId);

	// Dynamic allocation of size
	if(room.members.length === room.roomSize && room.quickPlay) {
		room.roomSize++;
	}

	// Room is full
	if(room.members.length === room.roomSize) {
		startRoom(roomId);
	}
	// Room is not full yet
	else {
		// Send progress update to all members who are not CPUs
		room.members.filter(player => player.gameId > 0).forEach(player => {
			player.socket.emit('roomUpdate', room.members.map(p => p.gameId), room.roomSize, room.settingsString, room.quickPlay);
		});
	}
	return true;
}

function startRoom(roomId) {
	const room = rooms[roomId];

	// Send start to all members who are not CPUs
	room.members.filter(player => player.gameId > 0).forEach(player => {
		const opponentIds = room.members.filter(player2 => player2.gameId !== player.gameId).map(player => player.gameId);
		const playerOppIds = opponentIds.filter(id => id > 0);
		const cpuOppIds = opponentIds.filter(id => id < 0);

		player.socket.emit('start', playerOppIds, cpuOppIds, room.settingsString);
	});

	console.log('Started room ' + roomId);
	room.started = true;
	if(room.quickPlay) {
		quickPlayTimer = null;
		defaultQueueRoomId = null;
	}
}

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);
		socketToIdMap[socket.id] = gameCounter;
		console.log('Assigned gameId ' + gameCounter);
		gameCounter++;
	});

	socket.on('cpuMatch', gameInfo => {
		const { gameId, roomSize, settingsString } = gameInfo;
		const members = [{ gameId, socket }];

		// Assign each cpu a negative id
		for(let i = 0; i < roomSize - 1; i++) {
			members.push({ gameId: -gameCounter, socket: null });
			gameCounter++;
		}

		const roomId = createRoom(members, roomSize, settingsString, true);
		startRoom(roomId);
	});

	socket.on('createRoom', gameInfo => {
		const { gameId, settingsString, roomSize } = gameInfo;
		const members = [{ gameId, socket}];

		const roomId = createRoom(members, roomSize, settingsString, true);
		socket.emit('giveRoomId', roomId);
	});

	socket.on('joinRoom', gameInfo => {
		const { gameId, joinId } = gameInfo;

		if(!joinRoom(gameId, joinId, socket)) {
			socket.emit('joinFailure', 'Unable to join room. Make sure the room id is still valid.');
		}
	});

	socket.on('ranked', gameInfo => {
		const { gameId } = gameInfo;

		// No pending ranked game
		if(rankedRoomId === null) {
			const members = [{ gameId, socket }];
			const roomId = createRoom(members, 2, defaultSettings, false);
			rankedRoomId = roomId;
		}
		// Pending ranked game
		else {
			if(!joinRoom(gameId, rankedRoomId, socket)) {
				socket.emit('joinFailure', 'Unable to join ranked queue. Please try again.');
				return;
			}
			else {
				rankedRoomId = null;
			}
		}
		console.log(gameId + ' has joined the ranked queue.');
	});

	socket.on('quickPlay', gameInfo => {
		const { gameId } = gameInfo;

		if(defaultQueueRoomId === null) {
			const members = [{ gameId, socket }];
			const roomId = createRoom(members, 2, defaultSettings, false, true);
			defaultQueueRoomId = roomId;
		}
		else {
			if(!joinRoom(gameId, defaultQueueRoomId, socket)) {
				socket.emit('joinFailure', 'Unable to join quick play. Please try again.');
				return;
			}
			else if(rooms[defaultQueueRoomId].members.length >= 2 && quickPlayTimer === null) {
				// Start game in 1 minute
				quickPlayTimer = setTimeout(startRoom, 60000, defaultQueueRoomId);
			}
		}
		console.log(gameId + ' has joined the default queue.');
	});

	// Upon receiving an emission from a client socket, broadcast it to all other client sockets
	socket.on('sendState', (gameId, boardHash, currentScore, totalNuisance) => {
		socket.broadcast.emit('sendState', gameId, boardHash, currentScore, totalNuisance);
	});

	// Player emitted a sound
	socket.on('sendSound', (gameId, sfx_name, index) => {
		socket.broadcast.emit('sendSound', gameId, sfx_name, index);
	})

	// Player started sending nuisance
	socket.on('sendNuisance', (gameId, nuisance) => {
		socket.broadcast.emit('sendNuisance', gameId, nuisance);
	})

	// Player finished a chain
	socket.on('activateNuisance', gameId => {
		socket.broadcast.emit('activateNuisance', gameId);
	});

	// Player was eliminated
	socket.on('gameOver', gameId => {
		socket.broadcast.emit('gameOver', gameId);
	});

	// Game is over for all players
	socket.on('gameEnd', gameId => {
		const roomId = idToRoomMap[gameId];

		if(roomId === undefined) {
			// Ignore undefined gameIds as they are from ended games
			if(gameId !== undefined) {
				console.log('ERROR: Received game end signal from gameId ' + gameId + ' that was not assigned to a room.');
			}
			return;
		}

		// Remove the players from the maps
		rooms[roomId].members.forEach(player => {
			idToRoomMap[player.gameId] = undefined;

			// Exclude CPU games as server does not maintain those sockets
			if(!rooms[roomId].cpu) {
				socketToIdMap[player.socket.id] = undefined;
			}
		});

		// Clear the room entry
		rooms[roomId] = undefined;
		console.log('Ended game with room id ' + roomId);
	});

	socket.on('disconnect', () => {
		const gameId = socketToIdMap[socket.id];
		const roomId = idToRoomMap[gameId];
		const room = rooms[roomId];

		if(room === undefined) {
			// Room had already been deleted
			return;
		}

		// In a CPU game. Since only games with 1 player and the rest CPU are supported, the game must end on player disconnect.
		if(room.cpu) {
			console.log('Ending CPU game ' + roomId + ' due to player disconnect.');

			// Remove all players from the room
			room.members.forEach(player => {
				idToRoomMap[player.gameId] = undefined;
			});

			// Clear room entry
			rooms[roomId] = undefined;
		}
		else {
			// Remove player from maps
			const index = indexInRoom(gameId, roomId);
			room.members.splice(index, 1);
			idToRoomMap[gameId] = undefined;

			// Game has started, so need to emit disconnect event to all members
			if(room.started) {
				room.members.forEach(player => {
					player.socket.emit('playerDisconnect', gameId);
				});
			}
			// Game is waiting or in queue, so send update to all members
			else {
				room.members.forEach(player => {
					player.socket.emit('roomUpdate', room.members.map(p => p.gameId), room.roomSize, room.settingsString, room.quickPlay);
				});

				// Cancel start if not enough players
				if(room.quickPlay && room.members.length < 2) {
					clearTimeout(quickPlayTimer);
					quickPlayTimer = null;
				}
			}
		}
		socketToIdMap[socket.id] = undefined;
		console.log('Disconnected id ' + gameId);
	});
});

http.listen(port, function() {
	console.log('Listening on port: ' + port);
});


const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRoomId(length = 6) {
	let result = '';
	for (let i = 0; i < length; i++) {
      result += validChars.charAt(Math.floor(Math.random() * validChars.length));
   }
   return result;
}
