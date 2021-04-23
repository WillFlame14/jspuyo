'use strict';

import { Room } from './Room';

const roomIds = new Set<string>();		// Set of roomIds currently in use
const roomIdToRoom = new Map<string, Room>();
const idToRoomId = new Map<string | number, string>();

const undefinedSendState = new Map<string, number>();		// Map of gameId --> time of last undefined sendState

export class RoomManager {
	static defaultQueueRoomId: string = null;
	static rankedRoomId: string = null;

	static createRoom(
		gameId: string,
		members: Map<string, { socket: SocketIO.Socket, frames: number }>,
		host: string,
		roomSize: number,
		settingsString: string,
		roomType = 'default'
	): Room {
		if(idToRoomId.has(gameId)) {
			// Leave old room first
			RoomManager.leaveRoom(gameId);
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

	static changeSettings(gameId: string, settingsString: string, roomSize: number): Room {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		room.changeSettings(settingsString, roomSize);
		return room;
	}

	static joinRoom(gameId: string, roomId: string, socket: SocketIO.Socket, roomPassword: string = null): Room {
		const room = roomIdToRoom.get(roomId);

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
				socket.emit('joinRoomPasswordFailure', 'That is not the correct password for the room.');
				return;
			}
		}
		else if(idToRoomId.has(gameId)) {
			// Leave old room first if it is a different room
			const oldRoom = roomIdToRoom.get(idToRoomId.get(gameId));

			if(oldRoom !== undefined && oldRoom.roomId !== room.roomId) {
				RoomManager.leaveRoom(gameId, oldRoom.roomId);
			}
		}

		room.join(gameId, socket);
		idToRoomId.set(gameId, room.roomId);

		return room;
	}

	static spectateRoom(gameId: string, socket: SocketIO.Socket, roomId: string = null): Room {
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

	static setRoomPassword(gameId: string, password: string): Room {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));
		room.password = password;

		return room;
	}

	static startRoomWithRoomId(roomId: string): Room {
		const room = roomIdToRoom.get(roomId);
		if(room.members.size + room.cpus.size > 1) {
			room.start();
		}
		else {
			console.log('Attempted to start a room automatically, but there weren\'t enough players.');
		}
		return room;
	}

	static startRoomWithGameId(gameId: string, socket: SocketIO.Socket): Room {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));
		if(room.members.size + room.cpus.size > 1) {
			room.start();
		}
		else {
			socket.emit('showDialog', 'There are not enough players in the room to start.');
		}
		return room;
	}

	static leaveRoom(gameId: string, roomId: string = null, notify = false): Room {
		// The old roomId is explicitly provided when force disconnecting from a room, since joining happens faster than leaving
		const room = (roomId === null) ? roomIdToRoom.get(idToRoomId.get(gameId)) : roomIdToRoom.get(roomId);

		if(room === undefined) {
			if(notify) {
				console.log(`Attempted to remove ${gameId.substring(0, 6)}, but they were not in a room.`);
			}
			return;
		}
		const empty = room.leave(gameId);

		if(empty) {
			RoomManager.closeRoom(room);
		}

		// Clear from maps
		idToRoomId.delete(gameId);
		return room;
	}

	static closeRoom(room: Room): void {
		roomIdToRoom.delete(room.roomId);
		roomIds.delete(room.roomId);
		console.log(`Closed room ${room.roomId}`);
	}

	/**
	 * Visually adds a CPU to the 'Manage CPUs' modal box (does not actually add a CPU until confirmed.)
	 * Returns the index of the CPU that should be turned on (0-indexed), or -1 if the room is full.
	 */
	static addCpu(gameId: string): number {
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
	static removeCpu(gameId: string): number {
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
	static requestCpus(gameId: string): { speed: number, ai: string }[] {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		// Reset the number of CPUs, in case user did not submit CPU selections last time
		room.numCpus = room.cpus.size;

		if(room.numCpus === 0) {
			return [];
		}
		else {
			const cpuInfos = Array.from(room.cpus.values());
			const cpus: { speed: number, ai: string }[] = [];		// The cpuInfo object has too much data. Only send the speed and AI of each CPU.

			cpuInfos.forEach((cpuInfo: CpuInfo) => {
				const { ai, speed } = cpuInfo;
				// Undo the speed conversion
				cpus.push({ ai, speed: 10 - (speed / 500) });
			});

			return cpus;
		}
	}

	static setCpus(gameId: string, cpuInfos: Map<string, CpuInfo>): void {
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

	static advanceFrame(gameId: string): void {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room === undefined) {
			if(!undefinedSendState.has(gameId) || Date.now() - undefinedSendState.get(gameId) > 5000) {
				console.log(`Received sendState from gameId ${gameId.substring(0, 6)}, but they were not in a room.`);
				undefinedSendState.set(gameId, Date.now());
			}
			return;
		}

		room.advance(gameId);
	}

	static setFocus(gameId: string, focused: boolean): void {
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

	static beenDefeated(gameId: string, roomId: string): void {
		const room = roomIdToRoom.get(roomId);

		if(room !== undefined) {
			room.addDefeat(gameId);
		}
	}

	/**
	 * Returns a list of room ids excluding the one the player is already part of.
	 */
	static getAllRooms(gameId: string): string[] {
		return Array.from(roomIds).filter(id => {
			const room = roomIdToRoom.get(id);
			return !room.members.has(gameId) && room.roomType === 'default';
		});
	}

	/**
	 * Returns a list of the players in the room, if the room is valid.
	 */
	static getPlayers(roomId: string): string[] {
		const room = roomIdToRoom.get(roomId);

		if(room === undefined) {
			return [];
		}
		return Array.from(room.members.keys());
	}

	static getRoomIdFromId(gameId: string): string {
		return idToRoomId.get(gameId);
	}
}

const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRoomId(length = 6): string {
	let result: string;
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
