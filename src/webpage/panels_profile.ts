'use strict';

import { AudioPlayer } from '../utils/AudioPlayer';
import { PlayerInfo, signOut } from './firebase';
import { UserSettings } from '../utils/Settings';

// Default key bindings
let keyBindings = {
	moveLeft: 'ArrowLeft',
	moveRight: 'ArrowRight',
	rotateCCW: 'KeyZ',
	rotateCW: 'KeyX',
	softDrop: 'ArrowDown',
	hardDrop: 'ArrowUp'
};
let keyBindingRegistration: string = null;
let selectedAppearance = 'TsuClassic';

export function initProfilePanels(
	clearModal: () => void,
	socket: SocketIOClient.Socket,
	audioPlayer: AudioPlayer,
	stopCurrentSession: () => Promise<void>,
	getCurrentUID: () => string ): void {
	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	window.onkeydown = function(event: KeyboardEvent) {
		if(keyBindingRegistration !== null) {
			(document.getElementById(keyBindingRegistration) as HTMLInputElement).value = codeToDisplay(event.code);

			// set the actual key binding
			keyBindings[keyBindingRegistration.replace('Binding', '')] = event.code;

			keyBindingRegistration = null;
		}
	};

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

		// Use saved settings
		Array.from(document.getElementsByClassName('keyBinding')).forEach((button: HTMLButtonElement) => {
			button.value = codeToDisplay(keyBindings[button.id.replace('Binding', '')]);
		});

		document.getElementById('settingsModal').style.display = 'block';
	};

	// Attach onclick events for each key binding
	Array.from(document.getElementsByClassName('keyBinding')).forEach((button: HTMLButtonElement)=> {
		button.onclick = function() {
			button.value = '...';
			keyBindingRegistration = button.id;
		};
	});

	// Attach onclick events for each icon
	Array.from(document.getElementsByClassName('appearanceIcon')).forEach((icon: HTMLElement) => {
		icon.onclick = function() {
			// Remove selection from previous icon
			document.getElementById(selectedAppearance).classList.remove('selected');

			// Add newly selected icon
			icon.classList.add('selected');
			selectedAppearance = icon.id;
		};
	});

	document.getElementById('settingsSubmit').onclick = async function() {
		const userSettings = await PlayerInfo.getUserProperty(getCurrentUID(), 'userSettings') as UserSettings;

		const das = Number((document.getElementById('das') as HTMLInputElement).value);
		if(!Number.isNaN(das) && das >= 0) {
			userSettings['das'] = das;
		}

		const arr = Number((document.getElementById('arr') as HTMLInputElement).value);
		if(!Number.isNaN(arr) && arr >= 0) {
			userSettings['arr'] = arr;
		}

		// Ranges from 0 to 50, default 50 - map to 50 to 0
		const skipFrames = Number((document.getElementById('skipFrames') as HTMLInputElement).value);
		if(!Number.isNaN(skipFrames)) {
			userSettings['skipFrames'] = 50 - Math.floor(skipFrames);
		}

		// Ranges from 0 to 100, default 50
		const sfxVolume = Number((document.getElementById('sfxVolume') as HTMLInputElement).value);
		if(!Number.isNaN(sfxVolume)) {
			userSettings['sfxVolume'] = (sfxVolume / 100)**2 * 0.4;
		}

		// Configure audio player with new volume settings
		audioPlayer.configureVolume(userSettings.sfxVolume, userSettings.musicVolume);

		// Ranges from 0 to 100, default 50
		const musicVolume = Number((document.getElementById('musicVolume') as HTMLInputElement).value);
		if(!Number.isNaN(musicVolume)) {
			userSettings['musicVolume'] = (musicVolume / 100)**2 * 0.4;
		}

		userSettings['keyBindings'] = keyBindings;
		userSettings['appearance'] = selectedAppearance;

		// Update the values
		PlayerInfo.updateUser(getCurrentUID(), 'userSettings', userSettings);
		audioPlayer.playSfx('submit');

		// Modal is not auto-cleared since a game does not start as a result
		clearModal();
	};

	// User Panel - Log Out
	document.getElementById('logout').onclick = function() {
		socket.emit('forceDisconnect', getCurrentUID());
		socket.emit('unlinkUser');
		void signOut();
	};
}

/**
 * Turns a code.event string into a more human-readable display.
 */
function codeToDisplay(code: string): string {
	// Cut off prefixes
	if(code.includes('Key')) {
		code = code.substring(3);
	}
	else if(code.includes('Digit')) {
		code = code.substring(5);
	}

	switch(code) {
		case 'ArrowLeft':
			return '\u2190';
		case 'ArrowRight':
			return '\u2192';
		case 'ArrowDown':
			return '\u2193';
		case 'ArrowUp':
			return '\u2191';
		case 'ShiftLeft':
			return 'LSH';
		case 'ShiftRight':
			return 'RSH';
		default:
			return code.toUpperCase();
	}
}

export function setKeyBindings(newKeyBindings: KeyBindings): void {
	keyBindings = newKeyBindings;
}

export function setAppearance(appearance: string): void {
	selectedAppearance = appearance;
}
