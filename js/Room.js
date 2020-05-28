'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { Settings } = require('./Utils.js');

const roomIds = new Set();		// Set of roomIds currently in use
const roomIdToRoom = new Map();
const idToRoomId = new Map();

const MAX_FRAME_DIFFERENCE = 20;

class Room {
	constructor(members, cpus, roomSize, settingsString, roomType = 'default') {
		this.roomId = generateRoomId(6);
		this.members = members;
		this.cpus = cpus;
		this.cpuGames = [];
		this.roomSize = (roomSize > 16) ? 16 : (roomSize < 1) ? 1 : roomSize;	// clamp between 1 and 16
		this.settingsString = settingsString;
		this.roomType = roomType;
		this.quickPlayTimer = null;		// Only used if roomType is 'ffa'

		this.ingame = false;
		this.paused = [];
		this.spectating = new Map();
		this.defeated = [];
		this.timeout = null;

		this.cpuFrame = 0;

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
			player.socket.emit('roomUpdate', this.roomId, Array.from(this.members.keys()), this.roomSize, this.settingsString, this.roomType === 'ffa');
			player.socket.join(this.roomId);
		});

		this.cpus.forEach((cpu, gameId) => {
			idToRoomId.set(gameId, this.roomId);
			cpu.socket.join(this.roomId);
		});

		console.log(`Creating room ${this.roomId} with gameIds: ${JSON.stringify(Array.from(this.members.keys()))}`);
	}

	/**
	 * Adds a player/CPU to an existing room.
	 */
	join(gameId, socket, cpuInfo = null) {
		// Room is full
		if(this.members.size === this.roomSize) {
			if(cpuInfo === null) {
				throw new Error('The room is full.');
			}
			else {
				this.spectate(gameId, socket);
			}
			return;
		}
		// Room is currently in a game
		else if(this.ingame) {
			this.spectate(gameId, socket);
			return;
		}

		if(this.spectating.has(gameId)) {
			this.spectating.delete(gameId);
		}
		else {
			socket.join(this.roomId);
			idToRoomId.set(gameId, this.roomId);
		}

		if(cpuInfo === null) {
			this.members.set(gameId, { socket, frames: 0 });
		}
		else {
			const { speed, ai } = cpuInfo;
			this.cpus.set(gameId, { socket, frames: 0, speed, ai });
		}
		console.log(`Added gameId ${gameId} to room ${this.roomId}`);

		this.members.forEach((player, id) => {
			if(id > 0) {
				player.socket.emit('roomUpdate', this.roomId, Array.from(this.members.keys()), this.roomSize, this.settingsString, this.roomType === 'ffa');
			}
		});
	}

	/**
	 * Spectates a room (receives player data but does not play).
	 */
	spectate(gameId, socket) {
		if(this.members.has(gameId)) {
			this.members.delete(gameId);
		}
		else {
			socket.join(this.roomId);
			idToRoomId.set(gameId, this.roomId);
			socket.emit('spectate', this.roomId, Array.from(this.members.keys()), this.settingsString);
		}
		this.spectating.set(gameId, socket);
		console.log(`Added gameId ${gameId} to room ${this.roomId} as a spectator`);
	}

	/**
	 * Starts a room by sending a 'start' event to all sockets.
	 */
	start() {
		const allIds = Array.from(this.members.keys()).concat(Array.from(this.cpus.keys()));
		const settings = Settings.fromString(this.settingsString);

		// Clear the CPU games, then regenerate them
		this.cpuGames = [];
		this.cpuFrame = 0;

		this.cpus.forEach((cpu, cpuId) => {
			const { client_socket, speed, ai } = cpu;
			const opponentIds = allIds.filter(id => id !== cpuId);

			const game = new CpuGame(
				cpuId,
				opponentIds,
				client_socket,
				Cpu.fromString(ai, settings),
				Number(speed),
				settings
			);

			this.cpuGames.push({ game, socket: client_socket, gameId: cpuId, remove: false });
		});

		console.log(allIds);

		// Send start to the players
		this.members.forEach((player, gameId) => {
			const opponentIds = allIds.filter(id => id !== gameId);
			player.frames = 0;
			player.socket.emit('start', this.roomId, opponentIds, this.settingsString);
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
	leave(gameId, notify = true) {
		if(this.spectating.has(gameId)) {
			const socket = this.spectating.get(gameId);
			socket.leave(this.roomId);
			idToRoomId.delete(gameId);
			console.log(`Removed spectator ${gameId} from room ${this.roomId}`);
			return;
		}

		// Select the correct map to remove the player from
		const playerList = (gameId > 0) ? this.members : this.cpus;

		const socket = playerList.get(gameId).socket;
		socket.leave(this.roomId);

		// Remove player from maps
		playerList.delete(gameId);
		if(this.paused.includes(gameId)) {
			this.paused.splice(this.paused.indexOf(gameId), 1);
		}
		idToRoomId.delete(gameId);

		console.log(`Removed ${gameId} from room ${this.roomId}`);

		// Disconnect the CPU socket, since they cannot exist outside of the room
		if(gameId < 0) {
			socket.disconnect();
			return;
		}

		// Game has started, so need to emit disconnect event to all members
		if(this.ingame) {
			this.members.forEach((player, id) => {
				if(id > 0) {
					player.socket.emit('playerDisconnect', gameId);
				}
			});
			return;
		}

		if(notify) {
			this.members.forEach((player) => {
				player.socket.emit('roomUpdate', this.roomId, Array.from(this.members.keys()), this.roomSize, this.settingsString, this.roomType === 'ffa');
			});
		}

		// Cancel start if not enough players
		if(this.roomType === 'ffa' && this.members.size < 2 && this.quickPlayTimer !== null) {
			clearTimeout(this.quickPlayTimer);
			this.quickPlayTimer = null;
			console.log('Cancelled start. Not enough players.');
		}

		// Close room if it contains no more players
		if(this.members.size === 0 && this.roomType === 'default') {
			this.cpus.forEach((cpu, cpuId) => {
				this.leave(cpuId, false);
			});

			// Clear room entry
			roomIdToRoom.delete(this.roomId);
			roomIds.delete(this.roomId);
			console.log(`Closed room ${this.roomId}`);
		}
	}

	/**
	 * Ends the room by removing all players (triggering room cleanup).
	 */
	end() {
		this.members.forEach((player, id) => {
			this.leave(id, false);
		});
	}

	/**
	 * Increments the frame counter for a player, and determines whether other games should be paused/resumed.
	 * Also increments CPU games to match with the slowest player.
	 */
	advance(gameId) {
		const thisPlayer = this.members.get(gameId);
		thisPlayer.frames++;

		let minFrames = Infinity, minId = null;

		this.members.forEach((player, id) => {
			if(!this.defeated.includes(id)) {		// Exclude defeated players
				const frames = player.frames;
				if(frames < minFrames) {
					minFrames = frames;
					minId = id;
				}
			}
		});

		// CPU games are behind
		if(minFrames > this.cpuFrame) {
			this.cpuGames.forEach(cpuGame => {
				cpuGame.game.step();
				const cpuEndResult = cpuGame.game.end();
				if(cpuEndResult !== null) {
					switch(cpuEndResult) {
						case 'Win':
							cpuGame.socket.emit('gameEnd', this.roomId);
							break;
						case 'Loss':
							cpuGame.socket.emit('gameOver', cpuGame.gameId);
							break;
						case 'OppDisconnect':
							// finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
							break;
					}
					// Set the game to be removed
					cpuGame.remove = true;
				}
			});
			// Prevent topped out games from being advanced further by removing them
			this.cpuGames = this.cpuGames.filter(cpuGame => !cpuGame.remove);
		}

		// Too fast
		if(thisPlayer.frames - minFrames > MAX_FRAME_DIFFERENCE) {
			thisPlayer.socket.emit('pause');
			this.paused.push(gameId);

			// Start timeout if everyone except one player is paused
			if(this.paused.length === this.members.size - 1 && this.timeout === null) {
				this.timeout = setTimeout(() => {
					this.members.get(minId).socket.emit('timeout');

					// Resume all other members
					this.members.forEach((player, id) => {
						if(id !== minId) {
							player.socket.emit('play');
							player.socket.emit('timeoutDisconnect', minId);
						}
					});

					this.leave(minId);
				}, 30000);
			}
		}
		// Catching up
		else if(thisPlayer.frames === minFrames) {
			const toRemove = [];
			this.paused.forEach(id => {
				// Restart every socket that is no longer too far ahead
				if(this.members.get(id).frames - thisPlayer.frames < MAX_FRAME_DIFFERENCE - 5) {
					this.members.get(id).socket.emit('play');
					toRemove.push(id);
				}
			});

			// Remove the restarted ids
			this.paused = this.paused.filter(id => !toRemove.includes(id));

			// If anyone has resumed, stop timeout
			if(this.paused.length < this.members.size - 1 && this.timeout !== null) {
				clearTimeout(this.timeout);
				this.timeout = null;
			}
		}
	}

	/* ------------------------------ Helper Methods (RoomManager) ------------------------------*/

	static createRoom(gameId, members, cpus, roomSize, settingsString, roomType = 'default') {
		const room = new Room(members, cpus, roomSize, settingsString, roomType);
		roomIdToRoom.set(room.roomId, room);
		return room;
	}

	static joinRoom(gameId, roomId, socket, cpuInfo) {
		const room = roomIdToRoom.get(roomId);

		if(room === undefined) {
			socket.emit('joinFailure', `The room you are trying to join (id ${roomId}) does not exist.`);
			return;
		}

		room.join(gameId, socket, cpuInfo);
		return room;
	}

	static spectateRoom(gameId, socket, roomId = null) {
		const room = (roomId === null) ? roomIdToRoom.get(idToRoomId.get(gameId)) : roomIdToRoom.get(roomId);

		if(room === undefined) {
			socket.emit('spectateFailure', 'The room you are trying to join does not exist or has ended.');
			return;
		}

		room.spectate(gameId, socket);
		return room;
	}

	static startRoom(roomId) {
		const room = roomIdToRoom.get(roomId);
		room.start();
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
		room.leave(gameId);
		return room;
	}

	static advanceFrame(gameId) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		if(room === undefined) {
			console.log(`Received sendState from gameId ${gameId}, but they were not in a room.`);
			return;
		}

		room.advance(gameId);
	}

	/**
	 * Returns a list of room ids excluding the one the player is already part of.
	 */
	static getAllRooms(gameId) {
		return Array.from(roomIds).filter(id => {
			const room = roomIdToRoom.get(id);
			return room.started && !room.members.has(gameId);
		});
	}

	/**
	 * Returns a list of the players in the room, if the room is valid.
	 */
	static getPlayers(roomId) {
		const room = roomIdToRoom.get(roomId);

		if(room === undefined || !room.started) {
			return [];
		}
		return Array.from(room.members.keys());
	}

	static cpuAssign(gameId, socket) {
		const room = roomIdToRoom.get(idToRoomId.get(gameId));

		// Assign the socket to the CPU player in the room
		room.members.get(gameId).socket = socket;
		socket.join(room.roomId);
	}

	static disconnectAll(roomId) {
		const room = roomIdToRoom.get(roomId);

		// Game has already been ended (usually caused by leaving a CPU game)
		if(room === undefined) {
			console.log(`ERROR: Received game end signal from non-existent room ${roomId}.`);
			return;
		}

		room.end();
		console.log(`Ended game with room id ${room.roomId}`);
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

Room.defaultQueueRoomId = null;
Room.rankedRoomId = null;

module.exports = { Room };
