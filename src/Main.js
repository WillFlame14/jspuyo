'use strict';

const { GameArea } = require('./BoardDrawer.js');
const { PlayerGame, SpectateGame } = require('./PlayerGame.js');
const { Session } = require('./Session.js');
const { Settings } = require('./Utils.js');

const { dialogInit, showDialog } = require('./webpage/dialog.js');
const { PlayerInfo, initApp, signOut } = require('./webpage/firebase.js');
const { mainpageInit, clearMessages, updatePlayers, hidePlayers, toggleHost } = require('./webpage/mainpage.js');
const navbarInit = require('./webpage/navbar.js');
const { panelsInit, clearModal, updateUserSettings } = require('./webpage/panels.js');

const io = require('socket.io-client');
const globalSocket = io();

let currentUID;
let initialized;

// This is the "main" function, which starts up the entire app.
(function() {
	// Start login process
	initApp(globalSocket, loginSuccess);

	// Set up behaviour
	initialized = new Promise((resolve) => {
		Promise.all([
			init(globalSocket, getCurrentUID),
			navbarInit(),
			panelsInit(globalSocket, getCurrentUID, stopCurrentSession),
			dialogInit(),
			mainpageInit(globalSocket, getCurrentUID)
		]).then(() => {
			resolve();
		});
	});
})();

/**
 * Called after successfully logging in.
 * Links the current user to the socket and registers with the game server.
 */
async function loginSuccess(user) {
	// Make sure initialization is finished
	await initialized;

	globalSocket.emit('register', user.uid);

	globalSocket.off('registered');
	globalSocket.on('registered', async () => {
		currentUID = user.uid;
		let userData;
		try {
			userData = await PlayerInfo.loadUserData(currentUID);
		}
		catch(error) {
			console.log(error);
			console.log('Your account was not correctly set up. You will now be logged out.');
			signOut();
			return;
		}
		updateUserSettings(userData.userSettings);

		// Check if a joinRoom link was used
		const urlParams = new URLSearchParams(window.location.search);
		const joinId = urlParams.get('joinRoom');				// Id of room to join

		if(joinId !== null) {
			globalSocket.emit('joinRoom', { gameId: currentUID, joinId, spectate: false });
			console.log('Joining a room...');
		}
		else {
			globalSocket.emit('freeForAll', { gameId: currentUID }, 'suppress');
			document.getElementById('statusGamemode').innerHTML = 'Free For All';
		}
	});
}

/**
 * Retrieves the current UID, as logging out and logging in as a different user will change this value.
 */
function getCurrentUID() {
	return currentUID;
}

/*----------------------------------------------------------*/

let currentSession = null;
let currentRoomId = null;

const defaultSkipFrames = [0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25];

const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('sidebar');

// Set up all the event listeners
async function init(socket) {
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

	socket.on('start', async (roomId, opponentIds, settingsString) => {
		currentRoomId = roomId;
		showGameOnly();

		const settings = Settings.fromString(settingsString);
		const userSettings = await PlayerInfo.getUserProperty(currentUID, 'userSettings');

		// Add default skipFrames
		userSettings.skipFrames += defaultSkipFrames[opponentIds.length + 1];

		// Adjust the number of boards drawn
		clearBoards();
		const gameAreas = generateBoards(opponentIds.length + 1);

		// Set up the player's game
		const game = new PlayerGame(getCurrentUID(), opponentIds, socket, settings, userSettings, gameAreas);

		// Create the session
		currentSession = new Session(getCurrentUID(), game, socket, roomId);
		currentSession.run();
	});

	socket.on('spectate', async (roomId, allIds, settingsString) => {
		currentRoomId = roomId;
		showGameOnly();

		const settings = Settings.fromString(settingsString);
		const userSettings = await PlayerInfo.getUserProperty(currentUID, 'userSettings');

		// Add default skipFrames
		userSettings.skipFrames += defaultSkipFrames[allIds.length];

		// Adjust the number of boards drawn
		clearBoards();
		const gameAreas = generateBoards(allIds.length);

		const game = new SpectateGame(getCurrentUID(), allIds, socket, settings, userSettings, gameAreas);

		// Create the session
		currentSession = new Session(getCurrentUID(), game, socket, roomId);
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
function generateBoards(numBoards, appearance, settings) {
	const playArea = document.getElementById('playArea');
	playArea.style.display = 'table';

	const firstRow = playArea.insertRow(-1);
	let runningId = 1;
	const gameAreas = {};

	const createGameCanvas = function(id, row, size) {
		gameAreas[id] = new GameArea(settings, appearance, size);

		const cell = row.insertCell(-1);

		const playerArea = document.createElement('div');
		cell.appendChild(playerArea);

		const canvasArea = document.createElement('div');
		playerArea.appendChild(canvasArea);
		canvasArea.appendChild(gameAreas[id].canvas);

		const pointsArea = document.createElement('div');
		pointsArea.className = 'pointsArea';
		playerArea.appendChild(pointsArea);

		const pointsDisplay = document.createElement('span');
		pointsDisplay.id = 'pointsDisplay' + id;
		pointsDisplay.className = 'pointsDisplay';
		pointsDisplay.innerHTML = '00000000';
		pointsDisplay.style.fontSize = 52 * size;
		pointsArea.appendChild(pointsDisplay);

		return cell;
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
	return gameAreas;
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
