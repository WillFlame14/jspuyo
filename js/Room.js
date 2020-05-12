'use strict';

const roomIds = new Set();		// Set of roomIds currently in use
const roomIdToRoom = new Map();
const idToRoomId = new Map();

class Room {
	constructor(members, roomSize, settingsString, roomType = 'default') {
		this.roomId = generateRoomId(6);
		this.roomSize = (roomSize > 16) ? 16 : (roomSize < 1) ? 1 : roomSize;	// clamp between 1 and 16
		this.settingsString = settingsString;
		this.members = members;
		this.roomType = roomType;
		this.quickPlayTimer = null;		// Only used if roomType is 'ffa'

		this.started = false;
		this.paused = [];
		this.spectating = [];
		this.timeout = null;

		switch(this.roomType) {
			case 'ffa':
				Room.defaultQueueRoomId = this.roomId;
				break;
			case 'ranked':
				Room.rankedRoomId = this.roomId;
				break;
		}

		this.members.forEach((player, gameId) => {
			idToRoomId.set(gameId, this.roomId);

			// Send update to all players
			if(gameId > 0) {
				player.socket.emit('roomUpdate', Array.from(this.members.keys()), this.roomSize, this.settingsString, this.roomType === 'ffa');
			}
		});
		console.log(`Creating room ${this.roomId} with gameIds: ${JSON.stringify(Array.from(this.members.keys()))}`);
	}

	/**
	 * Adds a player to an existing room. Returns the new room size. Throws an error if the room cannot be joined.
	 */
	join(gameId, socket) {
		if(this.members.size === this.roomSize) {
			throw new Error(`The room you are trying to join (id ${this.roomId}) is already full.`);
		}
		else if(this.started) {
			throw new Error(`The room you are trying to join (id ${this.roomId}) has already started a game.`);
		}

		this.members.set(gameId, { socket, frames: 0 });
		idToRoomId.set(gameId, this.roomId);
		console.log(`Added gameId ${gameId} to room ${this.roomId}`);

		// Room is full
		if(this.members.size === this.roomSize && this.roomType !== 'ffa') {
			this.start();
		}
		// Room is not full yet - send progress update to all members who are not CPUs
		else {
			// Dynamic allocation of size for FFA matches (even if it might be full)
			if(this.roomType === 'ffa') {
				this.roomSize++;
			}
			this.members.forEach((player, id) => {
				if(id > 0) {
					console.log('sending update to ' + id);
					player.socket.emit('roomUpdate', Array.from(this.members.keys()), this.roomSize, this.settingsString, this.roomType === 'ffa');
				}
			});
		}
	}

	/**
	 * Starts a room by sending a 'start' event to all sockets.
	 */
	start() {
		const allIds = Array.from(this.members.keys());

		this.members.forEach((player, gameId) => {
			// Send start to all members who are not CPUs
			if(gameId > 0) {
				const opponentIds = allIds.filter(id => id > 0 && id !== gameId);
				const cpus = allIds.filter(id => id < 0).map(cpuId => {
					// Add the gameId to the cpu object
					const cpu = this.members.get(cpuId);
					cpu.gameId = cpuId;
					return cpu;
				});
				player.socket.emit('start', this.roomId, opponentIds, cpus, this.settingsString);
			}
		});

		switch(this.roomType) {
			case 'ffa':
				this.quickPlayTimer = null;
				Room.defaultQueueRoomId = null;
				break;
			case 'ranked':
				Room.rankedRoomId = null;
				break;
		}

		console.log(`Started room ${this.roomId}`);
		this.started = true;
	}

	/**
	 * Removes a player from a room (if possible).
	 */
	leave(gameId) {
		// In a CPU game. Since only games with 1 player and the rest CPU are supported, the game must end on player disconnect.
		if(this.roomType === 'cpu') {
			console.log(`Ending CPU game ${this.roomId} due to player disconnect.`);

			// Remove all players from the room
			this.members.forEach((player, id) => {
				idToRoomId[id] = undefined;
			});

			// Clear room entry
			roomIdToRoom.delete(this.roomId);
		}
		else {
			// Remove player from maps
			this.members.delete(gameId);
			idToRoomId.delete(gameId);

			console.log(`Removed ${gameId} from room ${this.roomId}`);

			// Game has started, so need to emit disconnect event to all members
			if(this.started) {
				this.members.forEach((player, id) => {
					if(id > 0) {
						player.socket.emit('playerDisconnect', gameId);
					}
				});
			}
			// Game is waiting or in queue, so send update to all members
			else {
				this.members.forEach((player, id) => {
					if(id > 0) {
						player.socket.emit('roomUpdate', Array.from(this.members.keys()), this.roomSize, this.settingsString, this.roomType === 'ffa');
					}
				});

				// Cancel start if not enough players
				if(this.roomType === 'ffa' && this.members.size < 2 && this.quickPlayTimer !== null) {
					clearTimeout(this.quickPlayTimer);
					this.quickPlayTimer = null;
					console.log('Cancelled start. Not enough players.');
				}

				// Close custom room if it is empty
				if(this.members.size === 0 && this.roomType === 'default') {
					roomIdToRoom.delete(this.roomId);
					console.log(`Closed room ${this.roomId} since it was empty.`);
				}
			}
		}
	}

	/* ------------------------------ Helper Methods (RoomManager) ------------------------------*/

	static createRoom(members, roomSize, settingsString, roomType = 'default') {
		const room = new Room(members, roomSize, settingsString, roomType);
		roomIdToRoom.set(room.roomId, room);
		return room;
	}

	static joinRoom(gameId, roomId, socket) {
		const room = roomIdToRoom.get(roomId);
		room.join(gameId, socket);
		return room;
	}

	static startRoom(roomId) {
		const room = roomIdToRoom.get(roomId);
		room.start();
		return room;
	}

	static leaveRoom(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));
		if(room === undefined) {
			console.log(`Attempted to remove ${gameId}, but they were not in a room.`);
			return;
		}
		room.leave(gameId);
		return room;
	}

	static cpuAssign(gameId, socket) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		// Assign the socket to the CPU player in the room
		room.members.get(gameId).socket = socket;
	}

	static spectateOwnRoom(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));
		if(room === undefined) {
			console.log(`Attempted to make ${gameId} a spectator, but they were not in a room.`);
			return;
		}
		room.spectating.push(gameId);
	}

	static disconnectAll(roomId) {
		const room = roomIdToRoom.get(roomId);

		// Game has already been ended (usually caused by leaving a CPU game)
		if(room === undefined) {
			console.log(`ERROR: Received game end signal from non-existent room ${roomId}.`);
			return;
		}

		// Remove the players from the maps
		room.members.forEach((player, id) => {
			idToRoomId.delete(id);

			// Disconnect the CPU sockets
			if(id < 0) {
				player.socket.disconnect();
			}
		});

		// Clear the room entry
		roomIdToRoom.delete(room.roomId);
		console.log(`Ended game with room id ${room.roomId}`);
	}

	// clunky. try to remove if possible
	static getRoomFromId(gameId) {
		return roomIdToRoom.get(idToRoomId.get(gameId));
	}
}

const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRoomId(length = 6) {
	let result;
	do {
		result = '';
		for (let i = 0; i < length; i++) {
			result += validChars.charAt(Math.floor(Math.random() * validChars.length));
		}
	}
	while(roomIds.has(result));

	roomIds.add(result);
	return result;
}

Room.defaultQueueRoomId = null;
Room.rankedRoomId = null;

module.exports = { Room };
