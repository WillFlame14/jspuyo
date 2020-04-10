'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { PlayerGame } = require('./PlayerGame.js');
const { Settings, UserSettings } = require('./Utils.js');

(function () {
	const socket = window.io();
	let game, gameId;
	let cpuGames = [];

	// Dictionary of all URL query parameters
	const urlParams = new URLSearchParams(window.location.search);

	const cpu = urlParams.get('cpu') === 'true';	// Flag to play against a CPU
	const ai = urlParams.get('ai') || 'Test';		// AI of the CPU
	const speed = urlParams.get('speed');			// Speed of the CPU

	const createRoom = urlParams.get('createRoom') === 'true';	// Flag to create a room
	const roomSize = urlParams.get('size') || 2;				// Size of the room

	const ranked = urlParams.get('ranked') === 'true';		// Flag to join ranked queue
	const joinId = urlParams.get('joinRoom');				// Id of room to join

	let gameInfo = { gameId: null, settingsString: new Settings().toString(), joinId };

	// Send a registration request to the server to receive a gameId
	socket.emit('register');

	socket.on('getGameId', id => {
		gameId = id;
		gameInfo.gameId = id;

		// CPU overrides all other options
		if(cpu) {
			socket.emit('cpuMatch', gameInfo);
			console.log('Starting CPU match...');
		}
		else if(createRoom) {
			// TODO: Allow changing of room settings
			gameInfo.roomSize = Number(roomSize) || 2;

			socket.emit('createRoom', gameInfo);
			console.log('Creating a room...');
		}
		else if(joinId !== null) {
			socket.emit('joinRoom', gameInfo);
			console.log('Joining a room...');
		}
		else if(ranked) {
			socket.emit('ranked', gameInfo);
			console.log('Finding a match...')
		}
		else {
			socket.emit('quickPlay', gameInfo);
			console.log('Awaiting match...');
		}
	});

	socket.on('giveRoomId', id => {
		console.log('Other players can join this room by appending ?joinRoom=' + id);
	});

	socket.on('joinFailure', () => {
		console.log('ERROR: Unable to join room as this room id is not currently in use.');
	});

	socket.on('roomUpdate', (allIds, roomSize, settingsString) => {
		console.log('Current players: ' + JSON.stringify(allIds));
		if(roomSize > allIds.length) {
			console.log('Waiting for ' + (roomSize - allIds.length) + ' more players.');
		}
		console.log('Settings: ' + Settings.fromString(settingsString));
	});

	socket.on('start', (opponentIds, cpuIds, settingsString) => {
		console.log('Opponents: ' + JSON.stringify(opponentIds) + ' CPUs: ' + JSON.stringify(cpuIds));

		const allOpponentIds = opponentIds.concat(cpuIds);

		// Set up the player's game
		game = new PlayerGame(
			gameId,
			allOpponentIds,
			socket,
			Settings.fromString(settingsString),
			new UserSettings()
		);

		let boardDrawerCounter = 2;
		const allIds = allOpponentIds.concat(gameId);

		let settings = Settings.fromString(settingsString);
		let cpuSpeed = Number(speed) || 10;
		let cpuAI = Cpu.fromString(ai, settings);

		// Create the CPU games
		cpuGames = cpuIds.map(id => {
			const thisSocket = window.io();
			const thisOppIds = allIds.slice();
			thisOppIds.splice(allIds.indexOf(id), 1);

			const thisGame = new CpuGame(
				id,
				thisOppIds,
				thisSocket,
				boardDrawerCounter,
				cpuAI,
				cpuSpeed,
				settings
			);

			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, id };
		});
		main();
	});

	let finalMessage = null;		// The message to be displayed

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		cpuGames.forEach(cpuGame => cpuGame.game.step());
		if(finalMessage !== null) {
			window.cancelAnimationFrame(mainFrame);
			console.log(finalMessage);
			return;
		}
		const endResult = game.end();
		if(endResult !== null) {
			switch(endResult) {
				case 'Win':
					finalMessage = 'You win!';
					socket.emit('gameEnd', gameId);
					break;
				case 'Loss':
					finalMessage = 'You lose...';
					socket.emit('gameOver', gameId);
					break;
				case 'OppDisconnect':
					finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
					break;
			}
		}

		cpuGames.forEach(cpuGame => {
			const cpuEndResult = cpuGame.game.end();
			if(cpuEndResult !== null) {
				switch(cpuEndResult) {
					case 'Win':
						// finalMessage = 'You win!';
						cpuGame.socket.emit('gameEnd', cpuGame.id);
						break;
					case 'Loss':
						// finalMessage = 'You lose...';
						cpuGame.socket.emit('gameOver', cpuGame.id);
						break;
					case 'OppDisconnect':
						// finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
						break;
				}
			}
		});
	}
})();
