'use strict';

const { PlayerGame, SpectateGame } = require('./PlayerGame.js');
const { Session } = require('./Session.js');
const { Utils, Settings, UserSettings } = require('./Utils.js');

const navbarInit = require('./webpage/navbar.js');
const { panelsInit, clearModal } = require('./webpage/panels.js');
const { dialogInit, showDialog } = require('./webpage/dialog.js');
const { mainpageInit, clearMessages, updatePlayers, hidePlayers, toggleHost } = require('./webpage/mainpage.js');

const io = require('socket.io-client');

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
	const playerInfo = new PlayerInfo();
	await playerInfo.ready();

	// Set up behaviour
	await Promise.all([init(playerInfo), navbarInit(), panelsInit(playerInfo, stopCurrentSession), dialogInit(), mainpageInit(playerInfo)]);

	// Check if a joinRoom link was used
	const urlParams = new URLSearchParams(window.location.search);
	const joinId = urlParams.get('joinRoom');				// Id of room to join

	if(joinId !== null) {
		playerInfo.socket.emit('joinRoom', { gameId: playerInfo.gameId, joinId, spectate: false });
		console.log('Joining a room...');
	}
	else {
		playerInfo.socket.emit('freeForAll', { gameId: playerInfo.gameId }, 'suppress');
		document.getElementById('statusGamemode').innerHTML = 'Free For All';
	}
})();

/*----------------------------------------------------------*/

let currentSession = null;
let currentRoomId = null;

const defaultSkipFrames = [0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25];

const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('sidebar');

// Set up all the event listeners
async function init(playerInfo) {
	const { socket, gameId, userSettings } = playerInfo;

	socket.on('roomUpdate', (roomId, allIds, roomSize, settingsString, roomType, host, spectating) => {
		// Clear messages only if joining a new room
		if(currentRoomId && currentRoomId !== roomId) {
			clearMessages();
		}
		currentRoomId = roomId;
		clearModal();
		clearBoards();
		generateBoards(1);
		if(mainContent.classList.contains('ingame')) {
			mainContent.classList.remove('ingame');
		}

		document.getElementById('statusArea').style.display = 'flex';
		sidebar.style.display = 'flex';

		const statusMsg = document.getElementById('statusMsg');
		const statusGamemode = document.getElementById('statusGamemode');
		const statusSettings = document.getElementById('statusSettings');
		const roomManageOptions = document.getElementById('roomManage');

		if(roomType === 'ffa' || roomType === 'ranked') {
			statusMsg.style.display = 'block';
			statusGamemode.style.display = 'block';
			roomManageOptions.style.display = 'none';
			if (allIds.length === 1) {
				statusMsg.innerHTML = 'Waiting for more players to start...';
			}
			else {
				statusMsg.innerHTML = 'Game starting soon!';
			}
			statusSettings.innerHTML = 'Settings: ' + settingsString;
		}
		else if (!spectating) {
			toggleHost(host);
			roomManageOptions.style.display = 'block';
			statusMsg.style.display = 'none';
			statusGamemode.style.display = 'none';
		}
		else {		// Spectating
			roomManageOptions.style.display = 'none';
			statusMsg.style.display = 'block';
			statusGamemode.style.display = 'none';

			statusMsg.innerHTML = 'You are currently spectating this room.';
		}

		updatePlayers(allIds);
	});

	socket.on('start', (roomId, opponentIds, settingsString) => {
		currentRoomId = roomId;
		showGameOnly();

		const settings = Settings.fromString(settingsString);
		const userSettingsCopy = Utils.objectCopy(userSettings);

		// Add default skipFrames
		userSettingsCopy.skipFrames = userSettingsCopy.skipFrames + defaultSkipFrames[opponentIds.length + 1];

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(opponentIds.length + 1);

		// Set up the player's game
		const game = new PlayerGame(gameId, opponentIds, socket, settings, userSettingsCopy);

		// Create the session
		currentSession = new Session(gameId, game, socket, roomId);
		currentSession.run();
	});

	socket.on('spectate', (roomId, allIds, settingsString) => {
		currentRoomId = roomId;
		showGameOnly();

		const settings = Settings.fromString(settingsString);
		const userSettingsCopy = Utils.objectCopy(userSettings);

		// Add default skipFrames
		userSettingsCopy.skipFrames = userSettingsCopy.skipFrames + defaultSkipFrames[allIds.length];

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(allIds.length);

		const game = new SpectateGame(gameId, allIds, socket, settings, userSettingsCopy);

		// Create the session
		currentSession = new Session(gameId, game, socket, roomId);
		currentSession.spectate = true;
		currentSession.run();
	});

	socket.on('showDialog', message => {
		showDialog(message);
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
		if (currentSession.stop() && !currentSession.spectate) {
			showDialog('You have disconnected from the previous game. That match will be counted as a loss.');
			clearMessages();
		}
	}
	document.getElementById('statusMsg').innerHTML = 'You\'re not curently in any game.';
	document.getElementById('statusGamemode').innerHTML = '';
	document.getElementById('statusSettings').innerHTML = '';
	sidebar.style.display = 'none';
	updatePlayers([]);
}

/**
 * Hides all elements on the mainpage except the game area, which is maximized.
 */
function showGameOnly() {
	clearModal();
	clearMessages();
	document.getElementById('statusArea').style.display = 'none';
	sidebar.style.display = 'none';
	if(!mainContent.classList.contains('ingame')) {
		mainContent.classList.add('ingame');
	}
	hidePlayers();
}

/**
 * Creates canvas elements on screen for each player. Currently supports up to 16 total players nicely.
 */
function generateBoards (numBoards) {
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

		// Only draw queue if size is at least 50%
		if(size > 0.5) {
			const queueCanvas = document.createElement('canvas');
			queueCanvas.id = 'queue' + id;
			queueCanvas.height = 540 * size;
			queueCanvas.width = 72 * size;
			centralArea.appendChild(queueCanvas);
		}

		const pointsArea = document.createElement('div');
		pointsArea.id = 'pointsArea' + id;
		pointsArea.className = 'pointsArea';
		gameArea.appendChild(pointsArea);

		const pointsDisplay = document.createElement('span');
		pointsDisplay.id = 'pointsDisplay' + id;
		pointsDisplay.className = 'pointsDisplay';
		pointsDisplay.innerHTML = '00000000';
		pointsDisplay.style.fontSize = 52 * size;
		pointsArea.appendChild(pointsDisplay);

		return board;
	};

	const playerBoard = createGameCanvas(runningId, firstRow, 1);
	runningId++;

	// Set up the number of boards displayed
	if(numBoards < 5) {
		for(let i = 0; i < numBoards - 1; i++) {
			createGameCanvas(runningId, firstRow, 1);
			runningId++;
		}
	}
	else if (numBoards < 10) {
		playerBoard.setAttribute('rowspan', '2');
		// Create a larger top row
		for(let i = 0; i < Math.ceil((numBoards - 1) / 2); i++) {
			createGameCanvas(runningId, firstRow, 0.5);
			runningId++;
		}
		// And a smaller bottom row
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < Math.floor((numBoards - 1) / 2); i++) {
			createGameCanvas(runningId, secondRow, 0.5);
			runningId++;
		}
	}
	else {
		playerBoard.setAttribute('rowspan', '3');
		const minPerRow = Math.floor((numBoards - 1) / 3);
		let extras = numBoards - 1 - minPerRow * 3;
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
