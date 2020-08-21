'use strict';

const { GameArea } = require('./GameDrawer.js');
const { PlayerGame, SpectateGame } = require('./PlayerGame.js');
const { Session } = require('./Session.js');
const { Settings, UserSettings, AudioPlayer } = require('./Utils.js');

const { dialogInit, showDialog } = require('./webpage/dialog.js');
const { PlayerInfo, initApp, signOut } = require('./webpage/firebase.js');
const { mainpageInit, clearMessages, updatePlayers, hidePlayers, toggleHost, toggleSpectate } = require('./webpage/mainpage.js');
const navbarInit = require('./webpage/navbar.js');
const { panelsInit, clearModal, updateUserSettings } = require('./webpage/panels.js');

const io = require('socket.io-client');
const globalSocket = io();

const globalAudioPlayer = new AudioPlayer(globalSocket);

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
		}).catch(err => {
			console.log(err);
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
		try {
			updateUserSettings(await PlayerInfo.getUserProperty(currentUID, 'userSettings'));
		}
		catch(error) {
			console.log(error);
			console.log('Your account was not correctly set up. You will now be logged out.');
			signOut();
			return;
		}

		// Check if a joinRoom link was used
		const urlParams = new URLSearchParams(window.location.search);
		const joinId = urlParams.get('joinRoom');				// Id of room to join

		if(joinId !== null) {
			globalSocket.emit('joinRoom', { gameId: currentUID, joinId, spectate: false });
			console.log('Joining a room...');
		}
		else {
			globalSocket.emit('freeForAll', { gameId: currentUID });
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

let quickPlayTimer = null;

// Set up all the event listeners
async function init(socket) {
	socket.on('roomUpdate', (roomId, allIds, roomSize, settingsString, roomType, host, spectating, quickPlayStartTime) => {
		// Clear messages only if joining a new room
		if(currentRoomId && currentRoomId !== roomId) {
			clearMessages();
		}
		currentRoomId = roomId;
		clearModal();
		clearCells();
		generateCells(1, Settings.fromString(settingsString));
		if(mainContent.classList.contains('ingame')) {
			mainContent.classList.remove('ingame');
		}

		document.getElementById('spectateNotice').style.display = 'none';
		document.getElementById('statusArea').style.display = 'flex';
		sidebar.style.display = 'flex';

		const statusMsg = document.getElementById('statusMsg');
		const statusGamemode = document.getElementById('statusGamemode');
		const statusExtra = document.getElementById('statusExtra');
		const roomManageOptions = document.getElementById('roomManage');

		if(roomType !== 'default' && quickPlayTimer === null && quickPlayStartTime) {
			quickPlayTimer = setInterval(() => {
				const timeLeft = Math.round((quickPlayStartTime - Date.now()) / 1000);		// in seconds
				if(timeLeft <= 0) {
					clearInterval(quickPlayTimer);
					quickPlayTimer = null;
					statusMsg.innerHTML = `Game starting soon!`;
				}
				else {
					statusMsg.innerHTML = `Game starting in ${timeLeft}...`;
				}
			}, 1000);
		}

		// Set up visual layout
		if(roomType === 'ffa' || roomType === 'ranked') {
			statusMsg.style.display = 'block';
			statusGamemode.style.display = 'block';
			statusExtra.style.display = 'block';
			roomManageOptions.style.display = 'none';

			if (allIds.length === 1) {
				statusMsg.innerHTML = 'Waiting for more players to start...';
				clearInterval(quickPlayTimer);
				quickPlayTimer = null;
			}

			if(spectating) {
				toggleSpectate();
				roomManageOptions.style.display = 'block';
				statusExtra.innerHTML = 'You are currently spectating this room.';
			}
			else {
				statusExtra.innerHTML = 'Good luck!';
			}
		}
		// Custom room
		else {
			if(spectating) {
				toggleSpectate();
				statusExtra.innerHTML = 'You are currently spectating this room.';
				statusExtra.style.display = 'block';
			}
			else {
				toggleHost(host);
				statusExtra.innerHTML = '';
				statusExtra.style.display = 'none';
			}
			statusMsg.style.display = 'none';
			statusGamemode.style.display = 'none';
			roomManageOptions.style.display = 'block';
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
		clearCells();
		const gameAreas = generateCells(opponentIds.length + 1, settings, userSettings.appearance);

		// Stop and reset the quick play timer if not already done
		clearInterval(quickPlayTimer);
		quickPlayTimer = null;

		// Set up the player's game
		const game = new PlayerGame(getCurrentUID(), opponentIds, socket, settings, userSettings, gameAreas, globalAudioPlayer);

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

		document.getElementById('spectateNotice').style.display = 'block';

		// Adjust the number of boards drawn
		clearCells();
		const gameAreas = generateCells(allIds.length, settings, userSettings.appearance);

		const game = new SpectateGame(getCurrentUID(), allIds, socket, settings, userSettings, gameAreas, globalAudioPlayer);

		// Create the session
		currentSession = new Session(getCurrentUID(), game, socket, roomId);
		currentSession.spectate = true;
		currentSession.run();
	});

	socket.on('showDialog', message => {
		showDialog(message);
	});

	// Alert the server whenever the browser tab goes into or out of focus
	document.addEventListener('visibilitychange', () => {
		if(document.hidden) {
			socket.emit('focus', getCurrentUID(), false);
		}
		else {
			socket.emit('focus', getCurrentUID(), true);
		}
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
function generateCells(numCells, settings, appearance = new UserSettings().appearance) {
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

	const playerCell = createGameCanvas(runningId, firstRow, 1);
	runningId++;

	// Set up the number of boards displayed
	if(numCells < 5) {
		for(let i = 0; i < numCells - 1; i++) {
			createGameCanvas(runningId, firstRow, 1);
			runningId++;
		}
	}
	else if (numCells < 10) {
		playerCell.setAttribute('rowspan', '2');
		// Create a larger top row
		for(let i = 0; i < Math.ceil((numCells - 1) / 2); i++) {
			createGameCanvas(runningId, firstRow, 0.5);
			runningId++;
		}
		// And a smaller bottom row
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < Math.floor((numCells - 1) / 2); i++) {
			createGameCanvas(runningId, secondRow, 0.5);
			runningId++;
		}
	}
	else {
		playerCell.setAttribute('rowspan', '3');
		const minPerRow = Math.floor((numCells - 1) / 3);
		let extras = numCells - 1 - minPerRow * 3;
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
function clearCells() {
	const playArea = document.getElementById('playArea');
	while(playArea.firstChild) {
		playArea.firstChild.remove();
	}
	playArea.style.display = 'none';
}
