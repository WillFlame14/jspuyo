'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { perMessageDeflate: false });
const port = process.env.PORT || 3000;

const defaultSettings = 'Tsu 0.036 12 6 0.27 4 70';
const MAX_FRAME_DIFFERENCE = 20;

let gameCounter = 1;		// The running number of games (used for assigning ids)

const rooms = {};
let defaultQueueRoomId = null;
let rankedRoomId = null;

const socketToIdMap = {};
const idToRoomMap = {};

let quickPlayTimer = null;

app.use(express.static('./'));

function createRoom(members, roomSize, settingsString, roomType = null) {
	const roomId = generateRoomId(6);

	// Temporary max room size
	if(roomSize > 16) {
		roomSize = 16;
	}
	else if (roomSize < 1) {
		roomSize = 1;
	}

	const room = {
		members,
		roomSize,
		settingsString,
		started: false,
		cpu: roomType === 'cpu',
		quickPlay: roomType === 'ffa',
		paused: []
	};

	// Set up the maps
	rooms[roomId] = room;
	const allIds = Object.keys(room.members);

	allIds.forEach(gameId => {
		idToRoomMap[gameId] = roomId;

		// Send update to all players
		if(gameId > 0) {
			room.members[gameId].socket.emit('roomUpdate', allIds, room.roomSize, room.settingsString, room.quickPlay);
		}
	});
	console.log(`Creating room ${roomId} with gameIds: ${JSON.stringify(allIds)}`);
	return roomId;
}

/**
 * Adds a player to an existing room. Throws an error if the room cannot be joined.
 */
function joinRoom(gameId, roomId, socket) {
	const room = rooms[roomId];

	if(room === undefined) {
		throw new Error(`The room you are trying to join (id ${roomId}) does not exist.`);
	}
	else if(Object.keys(room.members).length === room.roomSize) {
		throw new Error(`The room you are trying to join (id ${roomId}) is already full.`);
	}
	else if(room.started) {
		throw new Error(`The room you are trying to join (id ${roomId}) has already started a game.`);
	}

	room.members[gameId] = { socket, frames: 0 };
	idToRoomMap[gameId] = roomId;
	console.log(`Added gameId ${gameId} to room ${roomId}`);

	const allIds = Object.keys(room.members);

	// Dynamic allocation of size
	if(allIds.length === room.roomSize && room.quickPlay) {
		room.roomSize++;
	}

	// Room is full
	if(allIds.length === room.roomSize) {
		startRoom(roomId);
	}
	// Room is not full yet - send progress update to all members who are not CPUs
	else {
		allIds.filter(id => id > 0).forEach(playerId => {
			room.members[playerId].socket.emit('roomUpdate', allIds, room.roomSize, room.settingsString, room.quickPlay);
		});
	}
	return true;
}

/**
 * Starts a room by sending a 'start' event to all sockets.
 */
function startRoom(roomId) {
	const room = rooms[roomId];
	const allIds = Object.keys(room.members);

	// Send start to all members who are not CPUs
	allIds.filter(id => id > 0).forEach(playerId => {
		const opponentIds = allIds.filter(id => id > 0 && id !== playerId).map(id => Number(id));
		const cpus = allIds.filter(id => id < 0).map(cpuId => {
			// Add the gameId to the cpu object
			const cpu = room.members[cpuId];
			cpu.gameId = Number(cpuId);
			return cpu;
		});

		room.members[playerId].socket.emit('start', roomId, opponentIds, cpus, room.settingsString);
	});

	console.log(`Started room ${roomId}`);
	room.started = true;

	if(room.quickPlay) {
		quickPlayTimer = null;
		defaultQueueRoomId = null;
	}
	else if(roomId === rankedRoomId) {
		rankedRoomId = null;
	}
}

/**
 * Removes a player from a room.
 */
function leaveRoom(gameId, roomId) {
	const room = rooms[roomId];

	if(room === undefined) {
		console.log(`Attempted to remove ${gameId} from non-existent room ${roomId}`);
		return;
	}

	// In a CPU game. Since only games with 1 player and the rest CPU are supported, the game must end on player disconnect.
	if(room.cpu) {
		console.log(`Ending CPU game ${roomId} due to player disconnect.`);

		// Remove all players from the room
		Object.keys(room.members).forEach(id => {
			idToRoomMap[id] = undefined;
		});

		// Clear room entry
		rooms[roomId] = undefined;
	}
	else {
		// Remove player from maps
		delete room.members[gameId];
		idToRoomMap[gameId] = undefined;

		console.log(`Removed ${gameId} from room ${roomId}`);

		const remainingIds = Object.keys(room.members);

		// Game has started, so need to emit disconnect event to all members
		if(room.started) {
			remainingIds.filter(id => id > 0).forEach(playerId => {
				room.members[playerId].socket.emit('playerDisconnect', gameId);
			});
		}
		// Game is waiting or in queue, so send update to all members
		else {
			remainingIds.filter(id => id > 0).forEach(playerId => {
				console.log(`sending update to ${playerId}`);
				room.members[playerId].socket.emit('roomUpdate', remainingIds, room.roomSize, room.settingsString, room.quickPlay);
			});

			// Cancel start if not enough players
			if(room.quickPlay && remainingIds.length < 2) {
				clearTimeout(quickPlayTimer);
				quickPlayTimer = null;
				console.log('Cancelled start. Not enough players.')
			}

			// Close custom room if it is empty
			if(remainingIds.length === 0 && defaultQueueRoomId !== roomId && rankedRoomId !== roomId) {
				rooms[roomId] = undefined;
				console.log(`Closed room ${roomId} since it was empty.`);
			}
		}
	}
}

/**
 * Attempts to leave the current room (to allow joining another one).
 */
function leaveCurrentRoomIfPossible(gameId) {
	if(idToRoomMap[gameId] !== undefined) {
		leaveRoom(gameId, idToRoomMap[gameId]);
	}
}

/*--------------------------------------------------------------------------------------------------------*/

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);
		socketToIdMap[socket.id] = gameCounter;
		console.log(`Assigned gameId ${gameCounter}`);
		gameCounter++;
	});

	socket.on('cpuMatch', gameInfo => {
		const { gameId, roomSize, settingsString, cpus } = gameInfo;

		leaveCurrentRoomIfPossible(gameId);

		const members = { [gameId] : { socket, frames: 0 } };

		// Assign each cpu a negative id
		for(let i = 0; i < roomSize - 1; i++) {
			// TODO: Support more CPUS. In the meantime, any extras are given these defaults:
			const speed = cpus[i] ? cpus[i].speed : 100;
			const ai = cpus[i] ? cpus[i].ai : 'Test';

			members[-gameCounter] = { socket: null, frames: 0, speed, ai };
			gameCounter++;
		}

		const roomId = createRoom(members, roomSize, settingsString, 'cpu');
		startRoom(roomId);
	});

	socket.on('cpuAssign', gameId => {
		const room = rooms[idToRoomMap[gameId]];

		// Assign the socket to the CPU player in the room
		room.members[gameId].socket = socket;
	})

	socket.on('createRoom', gameInfo => {
		const { gameId, settingsString, roomSize } = gameInfo;

		leaveCurrentRoomIfPossible(gameId);

		const members = { [gameId]: { socket, frames: 0 } };
		const roomId = createRoom(members, roomSize, settingsString);
		socket.emit('giveRoomId', roomId);
	});

	socket.on('joinRoom', gameInfo => {
		const { gameId, joinId } = gameInfo;

		leaveCurrentRoomIfPossible(gameId);

		try {
			joinRoom(gameId, joinId, socket);
		}
		catch(err) {
			socket.emit('joinFailure', err.message);
			return;
		}
		console.log(`${gameId} has joined room ${joinId}.`);
	});

	socket.on('ranked', gameInfo => {
		const { gameId } = gameInfo;

		leaveCurrentRoomIfPossible(gameId);

		// No pending ranked game
		if(rankedRoomId === null) {
			const members = { [gameId] : { socket, frames: 0 } };

			// Fixed settings for ranked rooms
			const roomId = createRoom(members, 2, defaultSettings);
			rankedRoomId = roomId;
		}
		// Pending ranked game
		else {
			try {
				joinRoom(gameId, rankedRoomId, socket);
			}
			catch(err) {
				socket.emit('joinFailure', err.message);
				return;
			}
		}
		console.log(`${gameId} has joined the ranked queue.`);
	});

	socket.on('freeForAll', gameInfo => {
		const { gameId } = gameInfo;

		leaveCurrentRoomIfPossible(gameId);

		if(defaultQueueRoomId === null) {
			const members = { [gameId] : { socket, frames: 0 } };

			// Fixed settings for FFA rooms
			const roomId = createRoom(members, 2, defaultSettings, 'ffa');
			defaultQueueRoomId = roomId;
		}
		else {
			try {
				joinRoom(gameId, defaultQueueRoomId, socket);
			}
			catch(err) {
				socket.emit('joinFailure', err.message);
				return;
			}
			// Start game in 1 minute if there are at least 2 players
			if(Object.keys(rooms[defaultQueueRoomId].members).length >= 2 && quickPlayTimer === null) {
				quickPlayTimer = setTimeout(startRoom, 60000, defaultQueueRoomId);
			}
		}
		console.log(`${gameId} has joined the default queue.`);
	});

	// Upon receiving an emission from a client socket, broadcast it to all other client sockets
	socket.on('sendState', (gameId, boardHash, currentScore, totalNuisance) => {
		socket.broadcast.emit('sendState', gameId, boardHash, currentScore, totalNuisance);

		const room = rooms[idToRoomMap[gameId]];
		const player = room.members[gameId];
		player.frames++;

		let minSteps = Infinity;

		Object.keys(room.members).forEach(id => {
			const frames = room.members[id].frames;
			if(frames < minSteps) {
				minSteps = frames;
			}
		});

		// Too fast
		if(player.frames - minSteps > MAX_FRAME_DIFFERENCE) {
			socket.emit('pause');
			room.paused.push(gameId);
		}
		// Caught up
		else if(player.frames === minSteps) {
			const toRemove = [];
			room.paused.forEach(id => {
				// Restart every socket that is no longer too far ahead
				if(room.members[id].frames - player.frames < MAX_FRAME_DIFFERENCE - 5) {
					room.members[id].socket.emit('play');
					toRemove.push(id);
				}
			});

			// Remove the restarted ids
			room.paused = room.paused.filter(id => !toRemove.includes(id));
		}
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

		// Disconnect any cpus who have lost to conserve resources
		if(gameId < 0) {
			socket.disconnect();
		}
	});

	// Game is over for all players
	socket.on('gameEnd', (gameId, roomId) => {
		const room = rooms[roomId];

		// Game has already been ended (usually caused by leaving a CPU game)
		if(room === undefined) {
			if(gameId !== undefined) {
				console.log(`ERROR: Received game end signal from gameId ${gameId} that was not assigned to a room.`);
			}
			return;
		}

		// Remove the players from the maps
		Object.keys(room.members).forEach(id => {
			idToRoomMap[id] = undefined;

			// Disconnect the CPU sockets
			if(id < 0) {
				room.members[id].socket.disconnect();
			}
		});

		// Clear the room entry
		rooms[roomId] = undefined;
		console.log(`Ended game with room id ${roomId}`);
	});

	socket.on('disconnect', () => {
		const gameId = socketToIdMap[socket.id];
		const roomId = idToRoomMap[gameId];
		const room = rooms[roomId];

		if(room === undefined) {
			// Room had already been deleted
			return;
		}

		leaveRoom(gameId, roomId);
		socketToIdMap[socket.id] = undefined;
		console.log(`Disconnected id ${gameId}`);
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
