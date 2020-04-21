'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { PlayerGame } = require('./PlayerGame.js');
const { Settings, UserSettings } = require('./Utils.js');
const io = require('socket.io-client');

(function () {
	const socket = io();
	let game, gameId;
	let cpuGames = [];

	// Dictionary of all URL query parameters
	const urlParams = new URLSearchParams(window.location.search);

	const cpu = urlParams.get('cpu') === 'true';			// Flag to play against a CPU
	const ai = urlParams.get('ai') || 'Test';				// AI of the CPU
	const speed = Number(urlParams.get('speed')) || 100;	// Speed of the CPU

	const createRoom = urlParams.get('createRoom') === 'true';	// Flag to create a room
	const roomSize = Number(urlParams.get('size')) || 2;		// Size of the room

	const ranked = urlParams.get('ranked') === 'true';		// Flag to join ranked queue
	const joinId = urlParams.get('joinRoom');				// Id of room to join

	// Frames to skip when drawing opponent boards
	const defaultSkipFrames = [0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25];
	const skipFrames = Number(urlParams.get('skipFrames')) || (roomSize > 15 ? -1 : defaultSkipFrames[roomSize]);

	const generateBoards = function(size) {
		const playArea = document.getElementById('playArea');
		const firstRow = playArea.insertRow(-1);

		let runningId = 1;

		const createGameCanvas = function(id, row, size) {
			const board = row.insertCell(-1);
			const gameArea = document.createElement('div');
			gameArea.id = 'gameArea' + id;
			board.appendChild(gameArea);

			const nuisanceQueueArea = document.createElement('div');
			nuisanceQueueArea.id = 'nuisanceQueueArea' + id;
			gameArea.appendChild(nuisanceQueueArea);

			const nuisanceQueueCanvas = document.createElement('canvas');
			nuisanceQueueCanvas.id = 'nuisanceQueue' + id;
			nuisanceQueueCanvas.height = 50 * size;
			nuisanceQueueCanvas.width = 300 * size;
			nuisanceQueueArea.appendChild(nuisanceQueueCanvas);

			const centralArea = document.createElement('div');
			centralArea.id = 'centralArea' + id;
			gameArea.appendChild(centralArea);

			const boardCanvas = document.createElement('canvas');
			boardCanvas.id = 'board' + id;
			boardCanvas.height = 600 * size;
			boardCanvas.width = 300 * size;
			boardCanvas.style.border = '1px solid #2a52be';
			centralArea.appendChild(boardCanvas);

			const queueCanvas = document.createElement('canvas');
			queueCanvas.id = 'queue' + id;
			queueCanvas.height = 600 * size;
			queueCanvas.width = 80 * size;
			queueCanvas.style.border = '1px solid #2a52be';
			centralArea.appendChild(queueCanvas);

			const pointsArea = document.createElement('div');
			pointsArea.id = 'pointsArea' + id;
			gameArea.appendChild(pointsArea);

			const pointsDisplay = document.createElement('span');
			pointsDisplay.id = 'pointsDisplay' + id;
			pointsDisplay.className = 'numDisplay';
			pointsDisplay.innerHTML = 'Score: 000000';
			pointsArea.appendChild(pointsDisplay);

			return board;
		};

		let playerBoard = createGameCanvas(runningId, firstRow, 1);
		runningId++;

		// Set up the number of boards displayed
		if(size < 5) {
			for(let i = 0; i < size - 1; i++) {
				createGameCanvas(runningId, firstRow, 1);
				runningId++;
			}
		}
		else if (size < 10) {
			playerBoard.setAttribute('rowspan', '2');
			// Create a larger top row
			for(let i = 0; i < Math.ceil((size - 1) / 2); i++) {
				createGameCanvas(runningId, firstRow, 0.5);
				runningId++;
			}
			// And a smaller bottom row
			const secondRow = playArea.insertRow(-1);
			for(let i = 0; i < Math.floor((size - 1) / 2); i++) {
				createGameCanvas(runningId, secondRow, 0.5);
				runningId++;
			}
		}
		else {
			playerBoard.setAttribute('rowspan', '3');
			const minPerRow = Math.floor((size - 1) / 3);
			let extras = size - 1 - minPerRow * 3;
			// Spread rows over the first two rows
			for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
				createGameCanvas(runningId, firstRow, 3/10);
				runningId++;
			}
			extras--;
			const secondRow = playArea.insertRow(-1);
			for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
				createGameCanvas(runningId, secondRow, 3/10);
				runningId++;
			}
			// Do the final bottom row, guaranteed to be no extras
			const thirdRow = playArea.insertRow(-1);
			for(let i = 0; i < minPerRow; i++) {
				createGameCanvas(runningId, thirdRow, 3/10);
				runningId++;
			}
		}
	};

	const clearBoards = function() {
		const playArea = document.getElementById('playArea');
		while(playArea.firstChild) {
			playArea.firstChild.remove();
		}
	}

	let gameInfo = { gameId: null, roomSize, settingsString: new Settings().toString(), joinId };

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
		generateBoards(1);
	});

	socket.on('giveRoomId', id => {
		console.log('Other players can join this room by appending ?joinRoom=' + id);
	});

	socket.on('joinFailure', (errMessage) => {
		console.log('ERROR: ' + errMessage);
	});

	socket.on('roomUpdate', (allIds, roomSize, settingsString, quickPlay) => {
		console.log('Current players: ' + JSON.stringify(allIds));

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(allIds.length);

		if(quickPlay) {
			if (allIds.length === 1) {
				console.log('Waiting for more players to start...');
			}
			else {
				console.log('Game starting soon!');
			}
		}
		else {
			console.log('Room size: ' + (allIds.length) + '/' + roomSize + ' players');
		}
		console.log('Settings: ' + settingsString);
	});

	socket.on('start', (opponentIds, cpuIds, settingsString) => {
		console.log('Game starting!');
		console.log('Opponents: ' + JSON.stringify(opponentIds) + ' CPUs: ' + JSON.stringify(cpuIds));

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(opponentIds.length + cpuIds.length + 1);

		const allOpponentIds = opponentIds.concat(cpuIds);
		const userSettings = new UserSettings();
		userSettings.set('skipFrames', skipFrames);

		// Set up the player's game
		game = new PlayerGame(
			gameId,
			allOpponentIds,
			socket,
			Settings.fromString(settingsString),
			userSettings
		);

		let boardDrawerCounter = 2;
		const allIds = allOpponentIds.concat(gameId);

		let settings = Settings.fromString(settingsString);
		let cpuSpeed = Number(speed) || 50;
		let cpuAI = Cpu.fromString(ai, settings);

		// Create the CPU games
		cpuGames = cpuIds.map(id => {
			const thisSocket = io();
			const thisOppIds = allIds.slice();
			thisOppIds.splice(allIds.indexOf(id), 1);

			const thisGame = new CpuGame(
				id,
				thisOppIds,
				thisSocket,
				boardDrawerCounter,
				cpuAI,
				cpuSpeed,
				settings,
				userSettings
			);

			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, id, remove: false };
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
				// Set the game to be removed
				cpuGame.remove = true;
			}
		});
		cpuGames = cpuGames.filter(cpuGame => !cpuGame.remove);
	}
})();
