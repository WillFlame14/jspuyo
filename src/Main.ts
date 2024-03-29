'use strict';

import { User } from 'firebase/auth';
import * as Vue from 'vue';
import mitt from 'mitt';
import { io, Socket } from 'socket.io-client';

import { ServerToClientEvents, ClientToServerEvents } from './@types/events';
import { GameArea } from './draw/GameArea';
import { PlayerGame, SpectateGame } from './PlayerGame';
import { PlayerSession } from './PlayerSession';
import { Settings, UserSettings } from './utils/Settings';
import { AudioPlayer } from './utils/AudioPlayer';

import { PlayerInfo, basicInit, initApp, signOut } from './webpage/firebase';
import { panelsInit, clearModal, showDialog, updateUserSettings } from './webpage/panels';
import { vueInit } from './webpage/vue_loader';

import { initCharts } from './webpage/pages/gallery';
import { initGuide } from './webpage/pages/guide';

import store from './webpage/store';

const globalSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
const globalAudioPlayer = new AudioPlayer(globalSocket);
const globalEmitter = mitt();

let currentUID = '';

declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		audioPlayer: AudioPlayer,
		emitter: ReturnType<typeof mitt>,
		socket: Socket<ServerToClientEvents, ClientToServerEvents>,
		getCurrentUID: () => string,
		stopCurrentSession: () => Promise<void>
	}
}

// This is the "main" function, which starts up the entire app.
(function() {
	const app = Vue.createApp(Vue.defineComponent({
		provide: {
			audioPlayer: globalAudioPlayer,
			socket: globalSocket,
			getCurrentUID,
			stopCurrentSession
		}
	}));

	app.config.globalProperties.emitter = globalEmitter;

	const backgrounds = [
		'forest.jpg',
		'forest2.jpg',
		'winter.jpg',
		'wildlife.jpg'
	];

	// Set a random background image
	const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
	document.documentElement.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url("images/backgrounds/${background}")`;

	switch(window.location.pathname) {
		case '/info':
		case '/privacy':
		case '/terms':
			// No need for anything special
			break;
		case '/guide':
			basicInit();
			initGuide(app);
			break;
		case '/gallery':
			initCharts();
			break;
		default:
			vueInit(app);
			init(globalSocket);			// game-related
			panelsInit(globalEmitter, globalSocket, globalAudioPlayer);

			// Set up the login process for firebase. loginSuccess() will be called after login finishes
			initApp(globalSocket, loginSuccess);
			break;
	}
})();

/**
 * Called after successfully logging in.
 * Links the current user to the socket and registers with the game server.
 */
function loginSuccess(user: User) {
	globalSocket.emit('register', user.uid);

	globalSocket.off('registered', undefined);
	globalSocket.on('registered', () => {
		currentUID = user.uid;
		updateUserSettings(user, currentUID).then(() => {
			// Check if a joinRoom link was used
			const urlParams = new URLSearchParams(window.location.search);
			const joinId = urlParams.get('joinRoom');				// Id of room to join

			if(joinId !== null) {
				globalSocket.emit('joinRoom', { gameId: currentUID, joinId });
				console.log('Joining a room...');
			}
			else {
				globalSocket.emit('freeForAll', { gameId: currentUID });
				document.getElementById('statusGamemode').innerHTML = 'Free For All';
			}
		}).catch((error) => {
			console.log(error);
			console.log('Your account was not correctly set up. You will now be logged out.');
			void signOut();
			return;
		});
	});
}

/**
 * Retrieves the current UID, as logging out and logging in as a different user will change this value.
 */
function getCurrentUID() {
	return currentUID;
}

/*----------------------------------------------------------*/

let currentSession: PlayerSession = null;
let currentRoomId: string = null;

const defaultSkipFrames = [0, 0, 0, 0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25];

const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('sidebar');

let quickPlayTimer: ReturnType<typeof setTimeout> = null;

// Set up all the event listeners
function init(socket: Socket<ServerToClientEvents, ClientToServerEvents>): void {
	socket.on('roomUpdate', (roomId, playerScores, roomSize, settingsString, roomType, host, spectating, quickPlayStartTime) => {
		// Clear messages only if joining a new room
		if(currentRoomId && currentRoomId !== roomId) {
			globalEmitter.emit('clearMessages');
		}
		currentRoomId = roomId;
		clearModal();
		clearCells();
		generateCells([getCurrentUID()], Settings.fromString(settingsString));
		if(mainContent.classList.contains('ingame')) {
			mainContent.classList.remove('ingame');
		}

		// Show the status bar
		document.getElementById('statusHover').style.display = 'block';
		document.getElementById('statusClick').style.display = 'block';

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

			if (Object.keys(playerScores).length === 1) {
				statusMsg.innerHTML = 'Waiting for more players to start...';
				clearInterval(quickPlayTimer);
				quickPlayTimer = null;
			}

			if(spectating) {
				store.toggleSpectate();
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
				store.toggleSpectate();
				statusExtra.innerHTML = 'You are currently spectating this room.';
				statusExtra.style.display = 'block';
			}
			else {
				store.toggleHost(host);
				statusExtra.innerHTML = '';
				statusExtra.style.display = 'none';
			}
			statusMsg.style.display = 'none';
			statusGamemode.style.display = 'none';
			roomManageOptions.style.display = 'block';
		}

		globalEmitter.emit('updatePlayers', { playerScores, showWins: !roomType.includes('FT') });
	});

	socket.on('start', async (roomId, playerScores, opponentIds, settingsString) => {
		currentRoomId = roomId;
		showGameOnly();

		const settings = Settings.fromString(settingsString);
		const userSettings = await PlayerInfo.getUserProperty(currentUID, 'userSettings') as UserSettings;

		// Add default skipFrames
		userSettings.skipFrames += defaultSkipFrames[opponentIds.length + 1];

		// Adjust the number of boards drawn
		clearCells();
		const gameAreas = generateCells([getCurrentUID(), ...opponentIds], settings, userSettings.appearance, playerScores);

		// Hide the status bar
		document.getElementById('statusHover').style.display = 'none';
		document.getElementById('statusClick').style.display = 'none';

		// Stop and reset the quick play timer if not already done
		clearInterval(quickPlayTimer);
		quickPlayTimer = null;

		// Set up the player's game
		const game = new PlayerGame(getCurrentUID(), opponentIds, socket, settings, userSettings, gameAreas, globalAudioPlayer);

		// Create the session
		currentSession = new PlayerSession(getCurrentUID(), opponentIds, game, socket, roomId);
		currentSession.run();
	});

	socket.on('spectate', async (roomId, playerScores, allIds, settingsString) => {
		currentRoomId = roomId;
		showGameOnly();

		const settings = Settings.fromString(settingsString);
		const userSettings = await PlayerInfo.getUserProperty(currentUID, 'userSettings') as UserSettings;

		// Add default skipFrames
		userSettings.skipFrames += defaultSkipFrames[allIds.length];

		document.getElementById('spectateNotice').style.display = 'block';

		// Adjust the number of boards drawn
		clearCells();
		const gameAreas = generateCells(allIds, settings, userSettings.appearance, playerScores);

		const game = new SpectateGame(getCurrentUID(), allIds, socket, settings, userSettings, gameAreas, globalAudioPlayer);

		// Create the session
		currentSession = new PlayerSession(getCurrentUID(), allIds, game, socket, roomId, true);
		currentSession.run();
	});

	socket.on('showDialog', message => {
		showDialog(message);
	});

	// Alert the server whenever the browser tab goes into or out of focus
	document.addEventListener('visibilitychange', () => {
		socket.emit('focus', getCurrentUID(), !document.hidden);
	});
}

/**
 * Causes the current session to stop updating and emit a "Disconnect" event.
 */
async function stopCurrentSession(): Promise<void> {
	if(currentSession !== null) {
		// Returning true means the session had not ended yet
		if (await currentSession.stop() && !currentSession.spectating) {
			showDialog('You have disconnected from the previous game. That match will be counted as a loss.');
			globalEmitter.emit('clearMessages');
		}
	}
	return Promise.resolve();
}

/**
 * Hides all elements on the mainpage except the game area, which is maximized.
 */
function showGameOnly() {
	clearModal();
	globalEmitter.emit('clearMessages');
	document.getElementById('statusArea').style.display = 'none';
	sidebar.style.display = 'none';
	if(!mainContent.classList.contains('ingame')) {
		mainContent.classList.add('ingame');
	}
}

/**
 * Creates canvas elements on screen for each player. Currently supports up to 16 total players nicely.
 */
export function generateCells(
	gameIds: string[],
	settings: Settings,
	appearance = new UserSettings().appearance,
	playerScores?: Record<string, number>
): Record<number, GameArea> {
	const numCells = gameIds.length;
	const playArea = document.getElementById('playArea') as HTMLTableElement;
	playArea.style.display = 'table';

	const firstRow = playArea.insertRow(-1);
	let runningId = 1;
	const gameAreas: Record<number, GameArea> = {};

	const createGameCanvas = function(id: number, gameId: string, row: HTMLTableRowElement, size: number) {
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

		const pointsDisplay = document.createElement('div');
		pointsDisplay.id = `pointsDisplay${id}`;
		pointsDisplay.className = 'pointsDisplay';
		pointsDisplay.innerHTML = '00000000';
		pointsDisplay.style.fontSize = `${52 * size}`;
		pointsArea.appendChild(pointsDisplay);

		const playerName = document.createElement('div');
		let string = '';
		void PlayerInfo.getUserProperty(gameId, 'username').then((username: string) => {
			string += username;
		}).catch(() => {
			// No username found (i.e. CPU or test)
			string += gameId;
		}).then(() => {
			if(playerScores !== undefined) {
				string += ` ${playerScores[gameId]} ★`;
			}
			playerName.innerHTML = string;
		});

		playerName.className = 'playerDisplay';
		playerArea.appendChild(playerName);
		return cell;
	};

	const playerCell = createGameCanvas(runningId, gameIds[runningId - 1], firstRow, 1);
	runningId++;

	// Set up the number of boards displayed
	if(numCells < 5) {
		for(let i = 0; i < numCells - 1; i++) {
			createGameCanvas(runningId, gameIds[runningId - 1], firstRow, 1);
			runningId++;
		}
	}
	else if (numCells < 10) {
		playerCell.setAttribute('rowspan', '2');
		// Create a larger top row
		for(let i = 0; i < Math.ceil((numCells - 1) / 2); i++) {
			createGameCanvas(runningId, gameIds[runningId - 1], firstRow, 0.5);
			runningId++;
		}
		// And a smaller bottom row
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < Math.floor((numCells - 1) / 2); i++) {
			createGameCanvas(runningId, gameIds[runningId - 1], secondRow, 0.5);
			runningId++;
		}
	}
	else {
		playerCell.setAttribute('rowspan', '3');
		const minPerRow = Math.floor((numCells - 1) / 3);
		let extras = numCells - 1 - minPerRow * 3;
		// Spread rows over the first two rows
		for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
			createGameCanvas(runningId, gameIds[runningId - 1], firstRow, 0.33);
			runningId++;
		}
		extras--;
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
			createGameCanvas(runningId, gameIds[runningId - 1], secondRow, 0.33);
			runningId++;
		}
		// Do the final bottom row, guaranteed to be no extras
		const thirdRow = playArea.insertRow(-1);
		for(let i = 0; i < minPerRow; i++) {
			createGameCanvas(runningId, gameIds[runningId - 1], thirdRow, 0.33);
			runningId++;
		}
	}
	return gameAreas;
}

/**
 * Removes all boards on screen.
 */
export function clearCells(): void {
	const playArea = document.getElementById('playArea');
	while(playArea.firstChild) {
		playArea.firstChild.remove();
	}
	playArea.style.display = 'none';
}
