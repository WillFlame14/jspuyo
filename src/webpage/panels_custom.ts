'use strict';

import mitt from 'mitt';

import { PlayerInfo, signOut } from './firebase';
import { preloadSprites } from '../draw/SpriteDrawer';
import { AudioPlayer } from '../utils/AudioPlayer';
import { Settings, UserSettings } from '../utils/Settings';

export const puyoImgs: string[] = ['red', 'blue', 'green', 'yellow', 'purple', 'teal'];

export function initCustomPanels(
	emitter: ReturnType<typeof mitt>,
	clearModal: () => void,
	stopCurrentSession: () => Promise<void>,
	socket: SocketIOClient.Socket,
	audioPlayer: AudioPlayer,
	getCurrentUID: () => string
): void {
	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	// Custom - Create Room
	document.getElementById('createRoom').onclick = () => {
		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		emitter.emit('setMode', 'create');
		emitter.emit('disableRoomSettings', false);
	};

	emitter.on('submitRoomSettings', ({settings, roomSize, mode}: {settings: Settings, roomSize: number, mode: string}) => {
		const settingsString = Object.assign(new Settings(), settings).toString();
		switch(mode) {
			case 'create':
				void stopCurrentSession().then(() => {
					socket.emit('createRoom', { gameId: getCurrentUID(), settingsString, roomSize });
				});
				break;
			case 'set':
				socket.emit('changeSettings', getCurrentUID(), settingsString, roomSize);
				break;
		}
		audioPlayer.playSfx('submit');

		// Close the CPU options menu
		document.getElementById('createRoomModal').style.display = 'none';
		modal.style.display = 'none';
	});

	// Receiving the id of the newly created room
	socket.on('giveRoomId', (id: string) => {
		emitter.emit('setLink', `${window.location.href.split('?')[0]}?joinRoom=${id}`);

		modal.style.display = 'block';
		document.getElementById('giveJoinId').style.display = 'block';
	});

	// Custom - Join Room
	document.getElementById('joinRoom').onclick = () => {
		modal.style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'block';
	};

	// Received when room cannot be joined
	socket.on('joinFailure', (errMessage: string) => {
		// Display modal elements if they are not already being displayed (e.g. arrived from direct join link)
		modal.style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'block';

		emitter.emit('joinFailure', errMessage);
	});

	// Event received when attempting to join a password-protected room
	socket.on('requireRoomPassword', (roomId: string) => {
		modal.style.display = 'block';
		document.getElementById('joinRoomPasswordModal').style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'none';

		emitter.emit('setJoinId', roomId);
	});

	// Event received when entering the wrong password to a password-protected room
	socket.on('joinRoomPasswordFailure', (message: string) => {
		modal.style.display = 'block';

		emitter.emit('joinRoomPasswordFailure', message);
	});

	// Custom - Spectate
	document.getElementById('spectate').onclick = () => {
		void stopCurrentSession();
		socket.emit('getAllRooms', getCurrentUID());

		modal.style.display = 'block';
		document.getElementById('spectateRoomModal').style.display = 'block';
	};

	socket.on('allRooms', (roomIds: string[]) => {
		emitter.emit('allRooms', roomIds);
	});

	// Received when attempting to spectate an invalid room
	socket.on('spectateFailure', (errMessage: string) => {
		emitter.emit('spectateFailure', errMessage);
	});

	document.getElementById('gallery').onclick = async function() {
		void stopCurrentSession();
		// Leave the room
		socket.emit('forceDisconnect');

		let stats;

		try {
			stats = await PlayerInfo.getUserProperty(getCurrentUID(), 'stats');

			// Need to stringify object before storing, otherwise the data will not be stored correctly
			window.localStorage.setItem('stats', JSON.stringify(stats));
		}
		catch(err) {
			// No games played yet. Special warning message?
			window.localStorage.setItem('stats', JSON.stringify([]));
			console.log(err);
		}

		// Redirect to gallery subdirectory
		window.location.assign('/gallery');
	};

	// Profile Panel - Settings
	document.getElementById('settings').onclick = function() {
		void stopCurrentSession();

		modal.style.display = 'block';

		document.getElementById('settingsModal').style.display = 'block';
	};

	emitter.on('saveSettings', (newSettings: UserSettings) => {
		void PlayerInfo.getUserProperty(getCurrentUID(), 'userSettings').then((userSettings: UserSettings) => {
			userSettings = Object.assign(userSettings, newSettings);

			// Configure audio player with new volume settings
			audioPlayer.configureVolume(userSettings);

			// Update values
			PlayerInfo.updateUser(getCurrentUID(), 'userSettings', userSettings);

			audioPlayer.playSfx('submit');
			clearModal();
		});

		preloadSprites(newSettings.appearance);
	});

	// User Panel - Log Out
	document.getElementById('logout').onclick = function() {
		socket.emit('forceDisconnect', getCurrentUID());
		socket.emit('unlinkUser');
		void signOut();
	};
}
