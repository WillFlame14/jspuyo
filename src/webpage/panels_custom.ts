'use strict';

import mitt from 'mitt';
import { Socket } from 'socket.io-client';

import { PlayerInfo, signOut } from './firebase';
import { preloadSprites } from '../draw/SpriteDrawer';
import { AudioPlayer } from '../utils/AudioPlayer';
import { Settings, UserSettings } from '../utils/Settings';

export const puyoImgs: string[] = ['red', 'blue', 'green', 'yellow', 'purple', 'teal'];

interface RoomSettings {
	settings: Settings;
	roomSize: number;
	mode: string;
	roomType: string;
}

export function initCustomPanels(
	emitter: ReturnType<typeof mitt>,
	clearModal: () => void,
	stopCurrentSession: () => Promise<void>,
	socket: Socket,
	audioPlayer: AudioPlayer,
	getCurrentUID: () => string
): void {
	// Custom - Create Room
	document.getElementById('createRoom').onclick = () => {
		emitter.emit('setActiveModal', { name: 'RoomOptionsModal', props: { createRoomMode: 'create' } });

		emitter.emit('disableRoomSettings', false);
	};

	emitter.on('submitRoomSettings', ({ settings, roomSize, mode, roomType }: RoomSettings) => {
		const settingsString = Object.assign(new Settings(), settings).toString();
		switch(mode) {
			case 'create':
				void stopCurrentSession().then(() => {
					socket.emit('createRoom', { gameId: getCurrentUID(), settingsString, roomSize, roomType });
				});
				break;
			case 'set':
				socket.emit('changeSettings', getCurrentUID(), settingsString, roomSize, roomType);
				break;
		}
		audioPlayer.playSfx('submit');

		// Close the CPU options menu
		emitter.emit('clearModal');
	});

	// Receiving the id of the newly created room
	socket.on('giveRoomId', (roomId: string) => {
		emitter.emit('setActiveModal', { name: 'JoinIdModal', props: { roomId } });
	});

	// Custom - Join Room
	document.getElementById('joinRoom').onclick = () => {
		emitter.emit('setActiveModal', { name: 'JoinRoomModal' });
	};

	// Received when room cannot be joined
	socket.on('joinFailure', (errorMsg: string) => {
		// Display modal elements if they are not already being displayed (e.g. arrived from direct join link)
		emitter.emit('setActiveModal', { name:'JoinRoomModal', props: { errorMsg } });
	});

	// Event received when attempting to join a password-protected room
	socket.on('requireRoomPassword', (roomId: string) => {
		emitter.emit('setActiveModal', { name:'JoinRoomPasswordModal', props: { roomId } });
	});

	// Event received when entering the wrong password to a password-protected room
	socket.on('joinRoomPasswordFailure', (errorMsg: string) => {
		emitter.emit('setActiveModal', { name: 'JoinRoomPasswordModal', props: { errorMsg } });
	});

	// Custom - Spectate
	document.getElementById('spectate').onclick = () => {
		void stopCurrentSession();
		socket.emit('getAllRooms', getCurrentUID());
	};

	socket.on('allRooms', (allRoomIds: string[]) => {
		emitter.emit('setActiveModal', { name:'SpectateRoomModal', props: { allRoomIds } });
	});

	// Received when attempting to spectate an invalid room
	socket.on('spectateFailure', (errorMsg: string) => {
		emitter.emit('setActiveModal', { name:'SpectateRoomModal', props: { errorMsg } });
	});

	document.getElementById('gallery').onclick = async function() {
		void stopCurrentSession();
		// Leave the room
		socket.emit('forceDisconnect');

		try {
			const stats = await PlayerInfo.getUserProperty(getCurrentUID(), 'stats');

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

		emitter.emit('setActiveModal', { name:'SettingsModal' });
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
