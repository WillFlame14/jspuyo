'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { Settings } = require('./Utils.js');

const MAX_FRAME_DIFFERENCE = 20;

class Room {
	constructor(roomId, members, host, roomSize, settingsString, roomType = 'default') {
		this.roomId = roomId;
		this.password = null;
		this.members = members;
		this.cpus = new Map();
		this.numCpus = 0;
		this.games = new Map();

		this.roomSize = roomSize;
		this.settingsString = settingsString;
		this.roomType = roomType;
		this.quickPlayTimer = null;		// This, and the below variable are only used if roomType is 'ffa'
		this.quickPlayStartTime = null;

		this.ingame = false;
		this.host = host;
		this.paused = [];
		this.unfocused = [];
		this.spectating = new Map();
		this.defeated = [];
		this.timeout = null;

		this.members.forEach((player, gameId) => {
			// Send update to all players
			player.socket.emit(
				'roomUpdate',
				this.roomId,
				Array.from(this.members.keys()),
				this.roomSize,
				this.settingsString,
				this.roomType,
				gameId === this.host,
				false		// Not spectating
			);

			player.socket.join(this.roomId);
		});

		console.log(`Creating room ${this.roomId} with gameIds: ${JSON.stringify(Array.from(this.members.keys()).map(id => id.substring(0, 6)))}`);
	}

	/**
	 * Sets new settings of the room.
	 */
	changeSettings(settingsString, roomSize) {
		this.settingsString = settingsString;
		this.roomSize = roomSize;
	}

	/**
	 * Adds a player/CPU to an existing room.
	 */
	join(gameId, socket, cpuInfo = null, notify = true) {
		// Room is full or ingame
		if((this.members.size === this.roomSize && cpuInfo === null) || this.ingame) {
			this.spectate(gameId, socket);
			return;
		}

		// Spectators require much less work to join actively
		if(this.spectating.has(gameId)) {
			this.spectating.delete(gameId);
		}
		else {
			socket.join(this.roomId);
		}

		// Determine if adding a CPU or player
		if(cpuInfo === null) {
			this.members.set(gameId, { socket });
		}
		else {
			this.cpus.set(gameId, cpuInfo);
		}
		console.log(`Added gameId ${gameId.substring(0, 6)} to room ${this.roomId}`);

		if(notify) {
			this.sendRoomUpdate();
		}
	}

	/**
	 * Spectates a room (receives player data but does not play).
	 */
	spectate(gameId, socket) {
		if(this.members.has(gameId)) {
			this.leave(gameId, true, true);
		}
		else {
			// Need to separate socket join since leaving (and re-joining) is extremely slow
			socket.join(this.roomId);
		}

		this.spectating.set(gameId, socket);

		// Send start if ingame, otherwise
		if(this.ingame) {
			socket.emit(
				'spectate',
				this.roomId,
				Array.from(this.members.keys()).concat(Array.from(this.cpus.keys())),
				this.settingsString
			);
		}
		else {
			socket.emit(
				'roomUpdate',
				this.roomId,
				Array.from(this.members.keys()).concat(Array.from(this.cpus.keys())),
				this.roomSize,
				this.settingsString,
				this.roomType,
				false,		// Not host
				true 		// Spectating
			);
		}

		console.log(`Added gameId ${gameId.substring(0, 6)} to room ${this.roomId} as a spectator`);
	}

	/**
	 * Starts a room by generating necessary CPU games and sending a 'start' event to all sockets in the room.
	 */
	start() {
		const allIds = Array.from(this.members.keys()).concat(Array.from(this.cpus.keys()));

		// Generate a random seed and use it in the settings for this game
		this.settingsString = Settings.seedString(this.settingsString);
		const settings = Settings.fromString(this.settingsString);

		// Reset the defeated array
		this.defeated = [];

		// Generate the CPU games
		this.cpus.forEach((cpu, cpuId) => {
			const { client_socket, socket, speed, ai } = cpu;
			const opponentIds = allIds.filter(id => id !== cpuId);

			const game = new CpuGame(
				cpuId,
				opponentIds,
				client_socket,
				Cpu.fromString(ai, settings),
				Number(speed),
				settings
			);

			let cpuTimer;

			// Called every "frame" to simulate the game loop
			const timeout = () => {
				game.step();

				const cpuEndResult = game.end();
				if(cpuEndResult !== null) {
					switch(cpuEndResult) {
						case 'Win':
							// TODO: Win animation
							game.socket.emit('gameEnd', this.roomId);
							break;
						case 'Loss':
							game.socket.emit('gameOver', cpuId);
							break;
						case 'OppDisconnect':
							// Ignore if CPU wins due to player disconnect
							break;
					}
				}
				else {
					// If CPU game has not ended, recursively set a new timeout
					cpuTimer = setTimeout(timeout, 16.67);
				}
			};

			// Start the timer
			cpuTimer = setTimeout(timeout, 16.67);

			this.games.set(cpuId, { frames: 0, socket, timeout: cpuTimer });
		});

		// Send start to the players
		this.members.forEach((player, gameId) => {
			const opponentIds = allIds.filter(id => id !== gameId);
			this.games.set(gameId, { frames: 0, socket: player.socket });
			player.socket.emit('start', this.roomId, opponentIds, this.settingsString);
		});

		// Send start to the spectators
		this.spectating.forEach(socket => {
			socket.emit(
				'spectate',
				this.roomId,
				Array.from(this.members.keys()).concat(Array.from(this.cpus.keys())),
				this.settingsString
			);
		});

		switch(this.roomType) {
			case 'ffa':
				this.quickPlayTimer = null;
				break;
			case 'ranked':
				Room.rankedRoomId = null;
				this.quickPlayTimer = null;
				break;
		}

		console.log(`Started room ${this.roomId}`);
		this.ingame = true;
	}

	/**
	 * Removes a player from a room (if possible).
	 * Returns true if the room is now empty, and false if it is not.
	 */
	leave(gameId, notify = true, spectate = false) {
		if(this.spectating.has(gameId)) {
			const socket = this.spectating.get(gameId);
			socket.leave(this.roomId);
			console.log(`Removed spectator ${gameId.substring(0, 6)} from room ${this.roomId}`);
			return;
		}

		// Select the correct map to remove the player from
		const playerList = (gameId.includes('CPU')) ? this.cpus : this.members;

		if(playerList.get(gameId) === undefined) {
			console.log(`Attempted to remove ${gameId.substring(0, 6)}, but they were not in the room.`);
			return;
		}

		const socket = playerList.get(gameId).socket;
		if(!spectate) {
			socket.leave(this.roomId);
		}

		// Remove player from maps
		playerList.delete(gameId);
		if(this.paused.includes(gameId)) {
			this.paused.splice(this.paused.indexOf(gameId), 1);
		}

		// Transfer host privileges to next oldest member in room
		if(gameId === this.host) {
			this.host = Array.from(this.members.keys())[0];
		}

		console.log(`Removed ${gameId.substring(0, 6)} from room ${this.roomId}`);

		// Disconnect the CPU socket, since they cannot exist outside of the room
		if(gameId.includes('CPU')) {
			if(this.games.has(gameId)) {
				clearTimeout(this.games.timeout);
				this.games.delete(gameId);
			}
			socket.disconnect();
			return;
		}

		if(this.ingame) {
			this.games.delete(gameId);

			// Emit midgame disconnect event to all players in the room
			this.games.forEach(player => {
				player.socket.emit('playerDisconnect', gameId);
			});
		}
		else {
			if(notify) {
				this.sendRoomUpdate();
			}

			// Cancel start if not enough players
			if((this.roomType === 'ffa' || this.roomType === 'ranked') && this.members.size < 2 && this.quickPlayTimer !== null) {
				clearTimeout(this.quickPlayTimer);
				this.quickPlayTimer = null;
				this.quickPlayStartTime = null;
				console.log('Cancelled start. Not enough players.');
			}
		}

		// Close room if it contains no more players
		if(this.members.size === 0 && this.roomType === 'default') {
			this.cpus.forEach((cpu, cpuId) => {
				this.leave(cpuId, false);
			});

			this.spectating.forEach((spectatorSocket, id) => {
				this.leave(id, false);
				// TODO: Kick to main menu? Leave a message?
			});
			return true;
		}
		return false;
	}

	/**
	 * Ends the game.
	 */
	end() {
		this.ingame = false;

		// Stop all CPU timers
		this.games.forEach((player, id) => {
			if(id < 0) {
				clearTimeout(player.timeout);
			}
		});
		this.games.clear();

		// Bring back to room info screen in 5 seconds.
		setTimeout(() => {
			// Set a new timer if this is the FFA/Ranked room
			if(this.roomType !== 'default' && this.members.size >= 2) {
				const timer = (this.roomType === 'ffa' ? 30000 : 10000);
				this.quickPlayTimer = setTimeout(() => this.start(), timer);
				this.quickPlayStartTime = Date.now() + timer;
			}

			this.sendRoomUpdate();
		}, 5000);

		console.log(`Ended room ${this.roomId}`);
	}

	/**
	 * Increments the frame counter for a player, and determines whether other games should be paused/resumed.
	 */
	advance(gameId) {
		const thisPlayer = this.games.get(gameId);
		if(thisPlayer === undefined) {
			console.log(`Attempted to advance undefined game with id ${gameId.substring(0, 6)}`);
			return;
		}
		thisPlayer.frames++;

		let minFrames = Infinity, minId = null;

		this.games.forEach((player, id) => {
			// Exclude defeated players
			if(!this.defeated.includes(id)) {
				const frames = player.frames;
				if(frames < minFrames) {
					minFrames = frames;
					minId = id;
				}
			}
		});

		// Too fast
		if(thisPlayer.frames - minFrames > MAX_FRAME_DIFFERENCE && !this.paused.includes(gameId)) {
			thisPlayer.socket.emit('pause');
			this.paused.push(gameId);

			// Start timeout if everyone except one player is paused
			if(this.paused.length === this.games.size - 1 && this.timeout === null) {
				this.timeout = setTimeout(() => {
					// Time out the user if they are still in the game
					if(this.games.has(minId)) {
						this.games.get(minId).socket.emit('timeout');
					}

					// Resume all other players
					this.games.forEach((player, id) => {
						if(id !== minId) {
							player.socket.emit('play');
						}
					});
					this.leave(minId);
				}, (this.unfocused.includes(minId) ? 3000 : 15000));
			}
		}
		// Catching up
		else if(thisPlayer.frames === minFrames) {
			const toRemove = [];
			this.paused.forEach(id => {
				// Restart every socket that is no longer too far ahead
				if(this.games.get(id).frames - thisPlayer.frames < MAX_FRAME_DIFFERENCE - 5) {
					this.games.get(id).socket.emit('play');
					toRemove.push(id);
				}
			});

			// Remove the restarted ids
			this.paused = this.paused.filter(id => !toRemove.includes(id));

			// If anyone has resumed, stop timeout
			if(this.paused.length < this.games.size - 1 && this.timeout !== null) {
				clearTimeout(this.timeout);
				this.timeout = null;
			}
		}
	}

	/**
	 * Sends a room update to all the members and spectators of the room.
	 */
	sendRoomUpdate() {
		// Get all display names of members and CPUs
		const playersInRoom = Array.from(this.members.keys()).concat(Array.from(this.cpus.keys()));

		// Temporary timer if it has not been updated yet
		let tempTimer = null;

		if(this.roomType !== 'default') {
			const delay = (this.roomType === 'ffa') ? 30000 : 10000;

			if(this.quickPlayStartTime === null || Date.now() - this.quickPlayStartTime > 1000) {
				tempTimer = Date.now() + delay;
			}
		}

		this.members.forEach((player, id) => {
			player.socket.emit(
				'roomUpdate',
				this.roomId,
				playersInRoom,
				this.roomSize,
				this.settingsString,
				this.roomType,
				id === this.host,
				false,		// Not spectating,
				tempTimer || this.quickPlayStartTime
			);
		});

		this.spectating.forEach(socket => {
			socket.emit(
				'roomUpdate',
				this.roomId,
				playersInRoom,
				this.roomSize,
				this.settingsString,
				this.roomType,
				false,		// Not host
				true		// Spectating
			);
		});
	}
}

module.exports = { Room };
