'use strict';

import * as Vue from 'vue';
import mitt from 'mitt';

import { AudioPlayer } from '../utils/AudioPlayer';
import { PlayerInfo, signOut } from './firebase';
import { UserSettings } from '../utils/Settings';

import { SettingsModal } from './SettingsModal';

export function initProfilePanels(
	app: Vue.App<Element>,
	emitter: ReturnType<typeof mitt>,
	clearModal: () => void,
	socket: SocketIOClient.Socket,
	audioPlayer: AudioPlayer,
	stopCurrentSession: () => Promise<void>,
	getCurrentUID: () => string ): void {
	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	app.component('settings-modal', SettingsModal);

	app.mount('#modal-background');

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

	});

	// User Panel - Log Out
	document.getElementById('logout').onclick = function() {
		socket.emit('forceDisconnect', getCurrentUID());
		socket.emit('unlinkUser');
		void signOut();
	};
}
