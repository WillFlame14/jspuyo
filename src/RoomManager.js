'use strict';

const { Room } = require('./Room.js');

const roomIds = new Set();		// Set of roomIds currently in use
const roomIdToRoom = new Map();
const idToRoomId = new Map();

const undefinedSendState = new Map();		// Map of gameId --> time of last undefined sendState

class RoomManager {
	static createRoom(gameId, members, host, roomSize, settingsString, roomType = 'default') {
		if(idToRoomId.has(gameId)) {
			// Leave old room first
			roomIdToRoom.get(idToRoomId.get(gameId)).leave(gameId);
		}

		const roomId = generateRoomId(6);
		const room = new Room(roomId, members, host, roomSize, settingsString, roomType);

		switch(roomType) {
			case 'ffa':
				RoomManager.defaultQueueRoomId = roomId;
				break;
			case 'ranked':
				RoomManager.rankedRoomId = roomId;
				break;
		}

		roomIdToRoom.set(room.roomId, room);
		members.forEach((member, memberId) => {
			idToRoomId.set(memberId, roomId);
		});

		return room;
	}

	static changeSettings(gameId, settingsString, roomSize) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		room.changeSettings(settingsString, roomSize);
		return room;
	}

	static joinRoom(gameId, roomId = null, socket, roomPassword = null) {
		const room = (roomId === null) ? roomIdToRoom.get(idToRoomId.get(gameId)) : roomIdToRoom.get(roomId);

		if(room === undefined) {
			throw new Error(`The room you are trying to join ${roomId ? `(id ${roomId}) `:''}does not exist.`);
		}
		else if(Array.from(room.members.keys()).includes(gameId)) {
			throw new Error(`You are already in this room.`);
		}
		else if(room.password !== null) {
			if(roomPassword === null) {
				socket.emit('requireRoomPassword', roomId);
				return;
			}
			else if(roomPassword !== room.password) {
				socket.emit('joinRoomPasswordFailure', 'This is not the correct password for the room.');
				return;
			}
		}
		else if(idToRoomId.has(gameId)) {
			// Leave old room first
			const oldRoom = roomIdToRoom.get(idToRoomId.get(gameId));
			if(oldRoom !== undefined) {
				oldRoom.leave(gameId);
			}
		}

		room.join(gameId, socket);
		idToRoomId.set(gameId, room.roomId);

		return room;
	}

	static spectateRoom(gameId, socket, roomId = null) {
		const room = (roomId === null) ? roomIdToRoom.get(idToRoomId.get(gameId)) : roomIdToRoom.get(roomId);

		if(room === undefined) {
			socket.emit('spectateFailure', 'The room you are trying to join does not exist or has ended.');
			return;
		}

		if(room.members.size === 1 && room.members.has(gameId)) {
			socket.emit('showDialog', 'You cannot spectate a room if you are the only player.');
			return;
		}

		room.spectate(gameId, socket);
		idToRoomId.set(gameId, room.roomId);

		return room;
	}

	static setRoomPassword(gameId, password) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));
		room.password = password;
	}

	static startRoom(roomId = null, gameId, socket) {
		const room = roomId === null ? roomIdToRoom.get(idToRoomId.get(gameId)) : roomIdToRoom.get(roomId);
		if(room.members.size + room.cpus.size > 1) {
			room.start();
		}
		else if(socket) {
			socket.emit('showDialog', 'There are not enough players in the room to start.');
		}
		else {
			console.log('Attempted to start a room automatically, but there weren\'t enough players.');
		}
		return room;
	}

	static endRoom(roomId) {
		const room = roomIdToRoom.get(roomId);

		if(room === undefined) {
			console.log(`Tried to end room ${roomId}, but it did not exist.`);
			return;
		}

		room.end();
		return room;
	}

	static leaveRoom(gameId, roomId = null, notify = false) {
		// The old roomId is explicitly provided when force disconnecting from a room, since joining happens faster than leaving
		const room = (roomId === null) ? roomIdToRoom.get(idToRoomId.get(gameId)) : roomIdToRoom.get(roomId);

		if(room === undefined) {
			if(notify) {
				console.log(`Attempted to remove ${gameId}, but they were not in a room.`);
			}
			return;
		}
		const empty = room.leave(gameId);

		// Clear from maps
		idToRoomId.delete(gameId);

		if(empty) {
			roomIdToRoom.delete(room.roomId);
			roomIds.delete(room.roomId);
			console.log(`Closed room ${room.roomId}`);
		}

		return room;
	}

	/**
	 * Visually adds a CPU to the 'Manage CPUs' modal box (does not actually add a CPU until confirmed.)
	 * Returns the index of the CPU that should be turned on (0-indexed), or -1 if the room is full.
	 */
	static addCpu(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room.members.size + room.numCpus === room.roomSize) {
			return -1;
		}
		else {
			room.numCpus++;
			return room.numCpus - 1;
		}
	}

	/**
	 * Visually removes a CPU to the 'Manage CPUs' modal box (does not actually remove a CPU until confirmed.)
	 * Returns the index of the CPU that should be turned off (0-indexed), or -1 if there are no CPUs.
	 */
	static removeCpu(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room.numCpus === 0) {
			return -1;
		}
		else {
			room.numCpus--;
			return room.numCpus;
		}
	}

	/**
	 * Returns the current list of CPUs in the room, or an empty array if there are none.
	 */
	static requestCpus(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room.numCpus === 0) {
			return [];
		}
		else {
			const cpuInfos = Array.from(room.cpus.values());
			const cpus = [];		// The cpuInfo object has too much data. Only send the speed and AI of each CPU.

			cpuInfos.forEach(cpuInfo => {
				const { ai, speed } = cpuInfo;
				// Undo the speed conversion
				cpus.push({ ai, speed: 10 - (speed / 500) });
			});

			return cpus;
		}
	}

	static setCpus(gameId, cpuInfos) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		// Disconnect previous cpus
		room.cpus.forEach((cpu, cpuId) => {
			room.leave(cpuId);
		});

		// Set new cpus and update the size
		room.cpus = cpuInfos;
		room.numCpus = room.cpus.size;

		room.cpus.forEach((cpu, cpuId) => {
			room.join(cpuId, cpu.socket, cpu, false);		// Don't notify for each CPU join
			idToRoomId.set(cpuId, room.roomId);
		});

		// Notify once every CPU has joined
		room.sendRoomUpdate();
	}

	static advanceFrame(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room === undefined) {
			if(!undefinedSendState.has(gameId) || Date.now() - undefinedSendState.get(gameId) > 5000) {
				console.log(`Received sendState from gameId ${gameId}, but they were not in a room.`);
				undefinedSendState.set(gameId, Date.now());
			}
			return;
		}

		room.advance(gameId);
	}

	static setFocus(gameId, focused) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room !== undefined) {
			if(focused && room.unfocused.includes(gameId)) {
				// Remove from unfocused list
				room.unfocused.splice(room.unfocused.indexOf(gameId), 1);
			}
			// Now unfocused
			else if(!focused && !room.unfocused.includes(gameId)) {
				room.unfocused.push(gameId);
			}
		}
	}

	static beenDefeated(gameId, roomId) {
		const room = roomIdToRoom.get(roomId);

		if(room !== undefined) {
			room.defeated.push(gameId);

			// If the remaining players lose at the same time
			if(room.defeated.length === room.roomSize) {
				room.end();
			}
		}
	}

	/**
	 * Returns a list of room ids excluding the one the player is already part of.
	 */
	static getAllRooms(gameId) {
		return Array.from(roomIds).filter(id => {
			const room = roomIdToRoom.get(id);
			return !room.members.has(gameId) && room.roomType === 'default';
		});
	}

	/**
	 * Returns a list of the players in the room, if the room is valid.
	 */
	static getPlayers(roomId) {
		const room = roomIdToRoom.get(roomId);

		if(room === undefined) {
			return [];
		}
		return Array.from(room.members.keys());
	}

	static getRoomIdFromId(gameId) {
		return idToRoomId.get(gameId);
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

RoomManager.defaultQueueRoomId = null;
RoomManager.rankedRoomId = null;

module.exports = { RoomManager };
