'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { PlayerGame } = require('./PlayerGame.js');
const { Session } = require('./Session.js');
const { Utils, Settings, UserSettings } = require('./Utils.js');

const navbarInit = require('./webpage/navbar.js');
const { panelsInit, clearModal } = require('./webpage/panels.js');

const io = require('socket.io-client');
let playerInfo;

class PlayerInfo {
	constructor() {
		this.socket = io();
		this.gameId = null;

		// Send a registration request to the server to receive a gameId
		this.socket.emit('register');
		this.socket.on('getGameId', id => {
			this.gameId = id;
		});

		this.userSettings = new UserSettings();
	}

	ready() {
		const waitUntilReady = resolve => {
			if(this.gameId === null) {
				setTimeout(() => waitUntilReady(resolve), 20);
			}
			else {
				resolve();
			}
		};
		return new Promise(waitUntilReady);
	}
}

// Initialize session. This function is only run once.
(async function () {
	playerInfo = new PlayerInfo();
	await playerInfo.ready();

	// Set up behaviour
	await Promise.all([init(playerInfo), navbarInit(), panelsInit(playerInfo, stopCurrentSession)]);

	// Check if a joinRoom link was used
	const urlParams = new URLSearchParams(window.location.search);
	const joinId = urlParams.get('joinRoom');				// Id of room to join

	if(joinId !== null) {
		playerInfo.socket.emit('joinRoom', { gameId: playerInfo.gameId, joinId, spectate: false });
		console.log('Joining a room...');
	}
	else {
		playerInfo.socket.emit('freeForAll', { gameId: playerInfo.gameId });
	}
})();

/*----------------------------------------------------------*/

let currentSession = null;

const defaultSkipFrames = [0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25];

// Set up all the event listeners
async function init(playerInfo) {
	const { socket, gameId, userSettings } = playerInfo;

	socket.on('roomUpdate', (allIds, roomSize, settingsString, quickPlay) => {
		clearModal();
		document.getElementById('statusArea').style.display = 'flex';

		const statusMsg = document.getElementById('statusMsg');
		const statusSettings = document.getElementById('statusSettings');
		console.log('Current players: ' + JSON.stringify(allIds));

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(allIds.length);

		if(quickPlay) {
			if (allIds.length === 1) {
				statusMsg.innerHTML = 'Waiting for more players to start...';
			}
			else {
				statusMsg.innerHTML = 'Game starting soon!';
			}
		}
		else {
			statusMsg.innerHTML = 'Room size: ' + (allIds.length) + '/' + roomSize + ' players';
		}
		statusSettings.innerHTML = 'Settings: ' + settingsString;
	});

	socket.on('start', (roomId, opponentIds, cpus, settingsString) => {
		clearModal();
		document.getElementById('statusArea').style.display = 'none';

		const cpuIds = cpus.map(cpu => cpu.gameId);
		const allOpponentIds = opponentIds.concat(cpuIds);
		const allIds = allOpponentIds.concat(gameId);
		const settings = Settings.fromString(settingsString);
		const userSettingsCopy = Utils.objectCopy(userSettings);

		// Add default skipFrames
		userSettingsCopy.skipFrames = userSettingsCopy.skipFrames + defaultSkipFrames[allIds.length];

		console.log('Game starting!');
		console.log('Opponents: ' + JSON.stringify(opponentIds) + ' CPUs: ' + JSON.stringify(cpuIds));

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(opponentIds.length + cpus.length + 1);

		// Set up the player's game
		const game = new PlayerGame(gameId, allOpponentIds, socket, settings, userSettingsCopy);

		let boardDrawerCounter = 2;

		// Create the CPU games
		const cpuGames = cpus.map(cpu => {
			const { gameId, speed, ai } = cpu;
			const thisSocket = io();
			const thisOppIds = allIds.slice();
			// Remove the cpu player from list of ids
			thisOppIds.splice(allIds.indexOf(gameId), 1);

			const thisGame = new CpuGame(
				gameId,
				thisOppIds,
				thisSocket,
				boardDrawerCounter,
				Cpu.fromString(ai, settings),
				Number(speed),
				settings,
				userSettingsCopy
			);

			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, gameId, remove: false };
		});

		// Create the session
		const playerGame = { game, socket, gameId };
		currentSession = new Session(playerGame, cpuGames, roomId);
		currentSession.run();
	});

	// Return a promise that instantly resolves
	return new Promise(resolve => resolve());
}


/**
 * Causes the current session to stop updating and emit a "Disconnect" event.
 */
function stopCurrentSession() {
	if(currentSession !== null) {
		// Returning true means the session had not ended yet
		if (currentSession.stop()) {
			document.getElementById('modal-background-disable').style.display = 'block';
			document.getElementById('forceStopPenalty').style.display = 'block';
		}
	}
	// clearBoards();
	document.getElementById('statusMsg').innerHTML = 'You\'re not curently in any game.';
}

/**
 * Creates canvas elements on screen for each player. Currently supports up to 16 total players nicely.
 */
function generateBoards (size) {
	const playArea = document.getElementById('playArea');
	playArea.style.display = 'table';
	
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
		nuisanceQueueCanvas.height = 45 * size;
		nuisanceQueueCanvas.width = 270 * size;
		nuisanceQueueCanvas.className = 'nuisanceQueue';
		nuisanceQueueArea.appendChild(nuisanceQueueCanvas);

		const centralArea = document.createElement('div');
		centralArea.id = 'centralArea' + id;
		gameArea.appendChild(centralArea);

		const boardCanvas = document.createElement('canvas');
		boardCanvas.id = 'board' + id;
		boardCanvas.height = 540 * size;
		boardCanvas.width = 270 * size;
		centralArea.appendChild(boardCanvas);

		const queueCanvas = document.createElement('canvas');
		queueCanvas.id = 'queue' + id;
		queueCanvas.height = 540 * size;
		queueCanvas.width = 72 * size;
		centralArea.appendChild(queueCanvas);

		const pointsArea = document.createElement('div');
		pointsArea.id = 'pointsArea' + id;
		pointsArea.className = 'pointsArea';
		gameArea.appendChild(pointsArea);

		const pointsDisplay = document.createElement('span');
		pointsDisplay.id = 'pointsDisplay' + id;
		pointsDisplay.className = 'pointsDisplay';
		pointsDisplay.innerHTML = '00000000';
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
		Array.from(document.getElementsByClassName('pointsDisplay')).forEach(element => {
			if(element.id === "pointsDisplay1") {
				return;
			}
			element.style.fontSize = "26";
			element.style.width = "50%";
		});
	}
	else {
		playerBoard.setAttribute('rowspan', '3');
		const minPerRow = Math.floor((size - 1) / 3);
		let extras = size - 1 - minPerRow * 3;
		// Spread rows over the first two rows
		for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
			createGameCanvas(runningId, firstRow, 0.33);
			runningId++;
		}
		extras--;
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
			createGameCanvas(runningId, secondRow, 0.33);
			runningId++;
		}
		// Do the final bottom row, guaranteed to be no extras
		const thirdRow = playArea.insertRow(-1);
		for(let i = 0; i < minPerRow; i++) {
			createGameCanvas(runningId, thirdRow, 0.33);
			runningId++;
		}
		Array.from(document.getElementsByClassName('pointsDisplay')).forEach(element => {
			if(element.id === "pointsDisplay1") {
				return;
			}
			element.style.fontSize = "16";
			element.style.width = "33%";
		});
	}
}

/**
 * Removes all boards on screen.
 */
function clearBoards() {
	const playArea = document.getElementById('playArea');
	while(playArea.firstChild) {
		playArea.firstChild.remove();
	}
	playArea.style.display = 'none';
}
