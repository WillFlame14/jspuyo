'use strict';

import express = require('express');
const app = express();

import http_lib = require('http');
const http = http_lib.createServer(app);

import { Server, Socket } from 'socket.io';
const io = new Server(http, { perMessageDeflate: false });

import { io as io_client } from 'socket.io-client';
const port = process.env.PORT || 3000;

import { CpuInfo } from './src/Room';
import { RoomManager } from './src/RoomManager';
import { Settings } from './src/utils/Settings';

const defaultSettings = new Settings().toString();

let cpuCounter = 1;

const socketIdToId = new Map<string, string>();
const cpuInfos = new Map<string, Map<string, CpuInfo>>();

app.use(express.static('./public'));

const routes = {
	info: 'about',
	guide: 'guide',
	gallery: 'gallery',
	privacy: 'privacy',
	terms: 'terms',
	'': 'index'
};

for(const [route, dest] of Object.entries(routes)) {
	app.get(`/${route}`, (req, res) => {
		res.sendFile(`./public/pages/${dest}.html`, { root: __dirname });
	});
}

io.on('connection', function(socket: Socket) {
	socket.on('register', (gameId: string) => {
		if(Array.from(socketIdToId.values()).includes(gameId)) {
			// TODO: User is registering on two separate tabs. Might want to prevent this in the future.
		}
		socketIdToId.set(socket.id, gameId);
		console.log(`User ${gameId.substring(0, 6)} has logged in.`);
		socket.emit('registered');
	});

	socket.on('getOnlineUsers', () => {
		socket.emit('onlineUsersCount', Array.from(socketIdToId.keys()).length);
	});

	socket.on('addCpu', (gameId: string, callback: (index: number) => void) => {
		const index = RoomManager.addCpu(gameId);
		callback(index);
	});

	socket.on('removeCpu', (gameId: string, callback: (index: number) => void) => {
		const index = RoomManager.removeCpu(gameId);
		callback(index);
	});

	socket.on('requestCpus', (gameId: string) => {
		const cpus = RoomManager.requestCpus(gameId);
		socket.emit('requestCpusReply', cpus);
	});

	socket.on('setCpus', (gameInfo: {gameId: string, cpus: CpuInfo[]}) => {
		const { gameId, cpus } = gameInfo;

		const promises: Promise<void>[] = [];

		// Temporarily store in a shared map
		cpuInfos.set(gameId, new Map());

		// Assign each cpu a negative id
		cpus.forEach(cpu => {
			const cpuSocket = io_client('http://localhost:3000');
			const cpuId = `CPU-${cpuCounter}`;
			cpuCounter++;

			// Add the client socket
			Object.assign(cpu, { client_socket: cpuSocket });
			cpuInfos.get(gameId).set(cpuId, cpu);

			const promise: Promise<void> =	new Promise(resolve => {
				cpuSocket.emit('cpuAssign', gameId, cpuId, () => resolve());
			});

			promises.push(promise);
		});

		Promise.all(promises).then(() => {
			RoomManager.setCpus(gameId, cpuInfos.get(gameId));

			// Delete the temporarily stored info
			cpuInfos.delete(gameId);
		}).catch((err: string) => {
			console.log(`Error setting CPUs. ${err}`);
		});
	});

	socket.on('cpuAssign', (gameId: string, cpuId: string, callback: () => void) => {
		socketIdToId.set(socket.id, cpuId);

		const cpuInfo = cpuInfos.get(gameId).get(cpuId);
		cpuInfo.socket = socket;
		cpuInfos.get(gameId).set(cpuId, cpuInfo);

		// Resolve the promise to indicate that a socket has been created
		callback();
	});

	socket.on('setRoomPassword', (gameId: string, password: string) => {
		RoomManager.setRoomPassword(gameId, password);
	});

	socket.on('startRoom', (gameId: string) => {
		RoomManager.startRoomWithGameId(gameId, socket);
	});

	socket.on('createRoom', (gameInfo: { gameId: string, settingsString: string, roomSize: number, roomType: string}) => {
		const { gameId, settingsString, roomSize, roomType } = gameInfo;

		const members = new Map().set(gameId, { socket, frames: 0 });
		// Room creator becomes the host
		const host = gameId;

		const roomId = RoomManager.createRoom(gameId, members, host, roomSize, settingsString, roomType).roomId;
		socket.emit('giveRoomId', roomId);
	});

	socket.on('requestJoinLink', gameId => {
		const roomId = RoomManager.getRoomIdFromId(gameId);
		socket.emit('giveRoomId', roomId);
	});

	socket.on('changeSettings', (gameId, settingsString, roomSize) => {
		RoomManager.changeSettings(gameId, settingsString, roomSize);
	});

	socket.on('joinRoom', (gameInfo: { gameId: string, joinId: string, roomPassword: string }) => {
		const { gameId, joinId, roomPassword } = gameInfo;
		try {
			RoomManager.joinRoom(gameId, joinId, socket, roomPassword);
		}
		catch(err) {
			if(err instanceof Error) {
				socket.emit('joinFailure', err.message);
			}
		}
	});

	socket.on('spectate', (gameId, roomId = null) => {
		// RoomId is null if the user wishes to spectate their own room
		if(roomId !== null) {
			RoomManager.leaveRoom(gameId);
		}
		RoomManager.spectateRoom(gameId, socket, roomId);
	});

	socket.on('getAllRooms', gameId => {
		socket.emit('allRooms', RoomManager.getAllRooms(gameId));
	});

	socket.on('getPlayers', (roomId: string, callback: (players: string[]) => void) => {
		callback(RoomManager.getPlayers(roomId));
	});

	socket.on('ranked', (gameInfo: { gameId: string }) => {
		const { gameId } = gameInfo;

		// No pending ranked game
		if(RoomManager.rankedRoomId === null) {
			const members = new Map().set(gameId, { socket, frames: 0 });
			const roomSize = 2;		// Fixed room size
			const host = null;		// No host for ranked games

			RoomManager.createRoom(gameId, members, host, roomSize, defaultSettings, 'ranked');
		}
		// Pending ranked game
		else {
			try {
				const room = RoomManager.joinRoom(gameId, RoomManager.rankedRoomId, socket);
				// Start game in 10s if there are 2 players
				if(room.members.size === 2 && room.quickPlayTimer === null) {
					room.quickPlayTimer = setTimeout(() => {
						// Double-check that the room still contains 2 players
						if(room.members.size === 2) {
							RoomManager.startRoomWithRoomId(room.roomId);
						}
					}, 10000);
					room.quickPlayStartTime = Date.now() + 10000;
				}
			}
			catch(err) {
				if(err instanceof Error) {
					socket.emit('joinFailure', err.message);
				}
			}
		}
		console.log(`${gameId.substring(0, 6)} has joined the ranked queue.`);
	});

	socket.on('freeForAll', (gameInfo: { gameId: string }) => {
		const { gameId } = gameInfo;

		if(RoomManager.defaultQueueRoomId === null) {
			const members = new Map().set(gameId, { socket });
			const roomSize = 2;		// Fixed room size
			const host = null;		// No host for FFA games

			// Fixed settings for FFA rooms
			RoomManager.createRoom(gameId, members, host, roomSize, defaultSettings, 'ffa');
		}
		else {
			try {
				const room = RoomManager.joinRoom(gameId, RoomManager.defaultQueueRoomId, socket);

				// Start game in 30s if there are at least 2 players
				if(room.members.size >= 2 && !room.ingame && room.quickPlayTimer === null) {
					room.quickPlayTimer = setTimeout(() => {
						// Double-check that the room still contains at least 2 players
						if(room.members.size >= 2) {
							RoomManager.startRoomWithRoomId(room.roomId);
						}
					}, 30000);
					room.quickPlayStartTime = Date.now() + 30000;
				}
			}
			catch(err) {
				if(err instanceof Error) {
					socket.emit('joinFailure', err.message);
				}
			}
		}
		console.log(`${gameId.substring(0, 6)} has joined the default queue.`);
	});

	// Upon receiving an emission from a client socket, broadcast it to all other client sockets
	socket.on('sendState', (gameId, boardHash, currentScore, totalNuisance) => {
		socket.to(RoomManager.getRoomIdFromId(gameId)).emit('sendState', gameId, boardHash, currentScore, totalNuisance);
		RoomManager.advanceFrame(gameId);
	});

	// Player sent a chat message
	socket.on('sendMessage', (gameId, message, roomId = null) => {
		// Send to everyone in the room, including sender
		io.in(roomId || RoomManager.getRoomIdFromId(gameId)).emit('sendMessage', gameId, message);
	});

	// Player emitted a sound
	socket.on('sendSound', (gameId, sfx_name, index) => {
		socket.to(RoomManager.getRoomIdFromId(gameId)).emit('sendSound', gameId, sfx_name, index);
	});

	// Player emitted a voiced clip
	socket.on('sendVoice', (gameId, character, audio_name, index) => {
		socket.to(RoomManager.getRoomIdFromId(gameId)).emit('sendVoice', gameId, character, audio_name, index);
	});

	// Player started sending nuisance
	socket.on('sendNuisance', (gameId, nuisance) => {
		socket.to(RoomManager.getRoomIdFromId(gameId)).emit('sendNuisance', gameId, nuisance);
	});

	// Player finished a chain
	socket.on('activateNuisance', gameId => {
		socket.to(RoomManager.getRoomIdFromId(gameId)).emit('activateNuisance', gameId);
	});

	// Player was eliminated
	socket.on('gameOver', gameId => {
		const roomId = RoomManager.getRoomIdFromId(gameId);
		RoomManager.beenDefeated(gameId, roomId);
	});

	socket.on('forceDisconnect', (gameId, roomId) => {
		RoomManager.leaveRoom(gameId, roomId);
	});

	socket.on('focus', (gameId, focused) => {
		RoomManager.setFocus(gameId, focused);
	});

	// Called when logging out, since the same socket is used but with a different user
	socket.on('unlinkUser', () => {
		socketIdToId.delete(socket.id);
	});

	socket.on('disconnect', () => {
		const gameId = socketIdToId.get(socket.id);

		// gameId will be undefined if the user has not logged in yet
		if(gameId){
			// CPU sockets get disconnected by the server - they have already been removed from the room
			if(!gameId.includes('CPU')) {
				RoomManager.leaveRoom(gameId);
			}
			else {
				socketIdToId.delete(socket.id);
				console.log(`Disconnected ${gameId.substring(0, 6)}`);
			}
		}
	});
});

http.listen(port, function() {
	console.log(`Listening on port: ${port}`);
});
