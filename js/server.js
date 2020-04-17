'use strict';

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
	perMessageDeflate: false
});
const port = process.env.PORT || 3000;

let gameCounter = 1;
const rooms = {};
const defaultQueue = {
	roomId: null,
	members: [],
	settingsString: null
};
const rankedQueue = {
	members: [],
	settingsString: null
};
const socketToIdMap = {};
const idToRoomMap = {};

let quickPlayStarted = false;
let abortQuickPlay = false;

app.use(express.static('./'));

io.on('connection', function(socket) {
	socket.on('register', () => {
		socket.emit('getGameId', gameCounter);

		socketToIdMap[socket.id] = gameCounter;
		console.log('Assigned gameId ' + gameCounter);
		gameCounter++;
	});

	socket.on('cpuMatch', gameInfo => {
		const { gameId, roomSize, settingsString } = gameInfo;
		const cpuIds = [];
		const roomId = generateRoomId(6);

		// Assign each cpu a negative id
		for(let i = 0; i < roomSize - 1; i++) {
			cpuIds.push(-gameCounter);
			idToRoomMap[-gameCounter] = roomId;
			gameCounter++;
		}

		const allIds = cpuIds.concat(gameId);
		const members = allIds.map(id => {
			return { gameId: id };
		});

		rooms[roomId] = {
			members,		// create the object array
			roomSize: allIds.length,
			settingsString,
			cpu: true,
			started: true
		};

		socket.emit('start', [], cpuIds, settingsString);
		idToRoomMap[gameId] = roomId;
	});

	socket.on('createRoom', gameInfo => {
		const { gameId, settingsString, roomSize } = gameInfo;
		const roomId = generateRoomId(6);
		socket.emit('giveRoomId', roomId);

		rooms[roomId] = { members: [{ gameId, socket }], roomSize, settingsString, started: false };
		// Add player to room map
		idToRoomMap[gameId] = roomId;
	});

	socket.on('joinRoom', gameInfo => {
		const { gameId, joinId } = gameInfo;
		const room = rooms[joinId];

		// Attempted to join with an invalid id
		if(room === undefined) {
			socket.emit('joinFailure');
			return;
		}

		// Add player to room map
		room.members.push({ gameId, socket });
		idToRoomMap[gameId] = joinId;
		console.log(gameId + ' has joined room ' + joinId);

		// Room is full
		if(room.members.length === room.roomSize) {
			const allIds = room.members.map(p => p.gameId);
			// Send start to all members
			room.members.forEach(player => {
				const currentOpponentIds = allIds.filter(id => id !== player.gameId);
				player.socket.emit('start', currentOpponentIds, [], room.settingsString);
			});

			room.started = true;
			console.log('Starting custom room ' + joinId + ' with gameIds: ' + JSON.stringify(allIds));
		}
		// Room is not full yet
		else {
			// Send progress update to all members
			room.members.forEach(player => {
				player.socket.emit('roomUpdate', room.members.map(p => p.gameId), room.roomSize, room.settingsString);
			});
		}
	});

	socket.on('ranked', gameInfo => {
		const { gameId, settingsString } = gameInfo;

		// First player in queue since starting server
		if(rankedQueue.settingsString === null) {
			rankedQueue.settingsString = settingsString;
		}

		rankedQueue.members.push({ gameId, socket });
		console.log(gameId + ' has joined ranked queue.');

		// Room is full
		if(rankedQueue.members.length === 2) {
			const allIds = rankedQueue.members.map(p => p.gameId);

			// Establish the room
			const roomId = generateRoomId(6);
			rooms[roomId] = {
				members: Array.from(rankedQueue.members),		// duplicate the array
				roomSize: 2,
				settingsString: rankedQueue.settingsString,
				started: true
			};

			// Send start to all members
			rankedQueue.members.forEach(player => {
				const currentOpponentIds = allIds.filter(id => id !== player.gameId);
				player.socket.emit('start', currentOpponentIds, [], rankedQueue.settingsString);
				idToRoomMap[player.gameId] = roomId;
			});

			console.log('Starting room ' + roomId + ' with gameIds: ' + JSON.stringify(allIds));

			// Clear the members array
			rankedQueue.members = [];
		}
	});

	const establishRoom = function() {
		// One timer got here first
		if(quickPlayStarted || abortQuickPlay) {
			quickPlayStarted = false;
			abortQuickPlay = false;
			return;
		}

		const allIds = defaultQueue.members.map(p => p.gameId);

		// Establish the room
		const roomId = generateRoomId(6);
		rooms[roomId] = {
			members: Array.from(defaultQueue.members),		// duplicate the array
			roomSize: defaultQueue.members.length,
			settingsString: defaultQueue.settingsString,
			started: true
		};

		// Send start to all members
		defaultQueue.members.forEach(player => {
			const currentOpponentIds = allIds.filter(id => id !== player.gameId);
			player.socket.emit('start', currentOpponentIds, [], defaultQueue.settingsString);
			idToRoomMap[player.gameId] = roomId;
		});

		console.log('Starting room ' + roomId + ' with gameIds: ' + JSON.stringify(allIds));

		// Reset values
		defaultQueue.members = [];
		quickPlayStarted = true;
	}

	socket.on('quickPlay', gameInfo => {
		const { gameId, settingsString } = gameInfo;

		// First player in queue since starting server
		if(defaultQueue.settingsString === null) {
			defaultQueue.settingsString = settingsString;
		}

		defaultQueue.members.push({ gameId, socket });
		console.log(gameId + ' has joined the default queue.');

		if (defaultQueue.members.length === 4) {
			// Start game in 15 seconds
			setTimeout(establishRoom, 15000);
			quickPlayStarted = false;
		}
		else if (defaultQueue.members.length === 2) {
			// Start game in 1 minute
			setTimeout(establishRoom, 60000);
			quickPlayStarted = false;
		}

		const allIds = defaultQueue.members.map(player => player.gameId);

		// Send update to all members
		defaultQueue.members.forEach(player => {
			player.socket.emit('roomUpdate', allIds, allIds.length, defaultQueue.settingsString);
		});
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

		// Find out if they are in the default queue, and if so, their index
		let defaultQueueIndex = -1;
		defaultQueue.members.forEach((player, index) => {
			if(defaultQueueIndex !== -1) {
				return;
			}
			if(player.gameId === gameId) {
				defaultQueueIndex = index;
			}
		});

		if(roomId === undefined && defaultQueueIndex === -1) {
			// Ignore undefined gameIds as they are from ended games
			if(gameId !== undefined) {
				console.log('ERROR: Received disconnect from socket with id ' + gameId + ' that was not assigned to a room.');
			}
			return;
		}

		// In queue, so only need to remove them from there and send update to others in queue
		if(defaultQueueIndex !== -1) {
			defaultQueue.members.splice(defaultQueueIndex, 1);

			const allIds = defaultQueue.members.map(player => player.gameId);

			// Send update to all members
			defaultQueue.members.forEach(player => {
				player.socket.emit('roomUpdate', allIds, allIds.length, defaultQueue.settingsString);
			});
		}
		// In a room
		else {
			const room = rooms[roomId];

			// In a CPU game. Since only games with 1 player and the rest CPU are supported, the game must end on player disconnect.
			if(room.cpu) {
				console.log('Ending CPU game ' + roomId + ' due to player disconnect.');

				// Remove all players from the room
				room.members.forEach(player => {
					idToRoomMap[player.gameId] = undefined;
				});

				// Reset the player's socket (Server does not maintain CPU sockets)
				socketToIdMap[socket.id] = undefined;

				// Clear the room entry
				rooms[roomId] = undefined;
				return;
			}

			// Game has already started, so need to also emit disconnect event to all sockets
			if(room.started) {
				socket.broadcast.emit('playerDisconnect', socketToIdMap[socket.id]);
			}

			// Find index within the room
			let roomIndex = -1;
			room.members.forEach((player, index) => {
				if(roomIndex !== -1) {
					return;
				}
				if(player.gameId === gameId) {
					roomIndex = index;
				}
			});

			if(roomIndex === -1) {
				console.log('ERROR: Could not find player with gameId ' + gameId + ' in room ' + roomId + '.');
				return;
			}

			// Remove player from maps
			room.members.splice(roomIndex, 1);
			idToRoomMap[gameId] = undefined;
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
