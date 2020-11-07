'use strict';

import * as Vue from 'vue';
import mitt from 'mitt';

import { AudioPlayer } from '../utils/AudioPlayer';
import { PlayerInfo } from './firebase';
import { initCustomPanels } from './panels_custom';
import { initProfilePanels } from './panels_profile';
import { UserSettings } from '../utils/Settings';

let globalEmitter: ReturnType<typeof mitt>;
let globalAudioPlayer: AudioPlayer;

export const puyoImgs: string[] = ['puyo_red', 'puyo_blue', 'puyo_green', 'puyo_yellow', 'puyo_purple', 'puyo_teal'];
const ranks: Record<string, string> = {
	'0': 'Blob',
	'1000': 'Forest Learner',
	'1250': 'Ocean Diver',
	'1500': 'Waterfall Fighter',
	'1750': 'Lightning Ranger'
};

export function panelsInit(
	app: Vue.App<Element>,
	emitter: ReturnType<typeof mitt>,
	socket: SocketIOClient.Socket,
	getCurrentUID: () => string,
	stopCurrentSession: () => Promise<void>,
	audioPlayer: AudioPlayer
): void {
	globalEmitter = emitter;
	globalAudioPlayer = audioPlayer;

	initCustomPanels(puyoImgs, stopCurrentSession, socket, audioPlayer, getCurrentUID);
	initProfilePanels(app, emitter, clearModal, socket, audioPlayer, stopCurrentSession, getCurrentUID);

	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	// Set all close buttons to remove modals
	Array.from(document.getElementsByClassName('close')).forEach((close: HTMLElement) => {
		close.onclick = () => {
			clearModal();
			audioPlayer.playSfx('close_modal');
		};
	});

	// Manage window onclick
	window.onclick = function(event: Event) {
		if (event.target === modal) {
			clearModal();
		}
	};

	// Switch all toggleable buttons between on/off when clicked
	const toggleableButtons = Array.from(document.getElementsByClassName('on')).concat(Array.from(document.getElementsByClassName('off')));
	toggleableButtons.forEach((button: HTMLButtonElement) => {
		button.onclick = () => {
			if(button.value === "ON") {
				button.classList.add('off');
				button.value = "OFF";
				button.classList.remove('on');
			}
			else {
				button.classList.add('on');
				button.value = "ON";
				button.classList.remove('off');
			}
		};
	});

	// Queue Panel
	document.getElementById('freeForAll').onclick = async () => {
		await stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Free For All';
		socket.emit('freeForAll', { gameId: getCurrentUID() });
	};
	document.getElementById('ranked').onclick = async () => {
		await stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Ranked';
		socket.emit('ranked', { gameId: getCurrentUID() });
	};
}

/**
 * Removes all modal elements from view.
 */
export function clearModal(): void {
	// Prevent closing modal boxes if any dialog box has not been closed yet
	if(document.getElementById('modal-background-disable').style.display === 'block') {
		return;
	}

	const modal = document.getElementById('modal-background');
	modal.style.display = "none";

	// Clear all modal content
	Array.from(document.getElementsByClassName('modal-content')).forEach((element: HTMLElement) => {
		element.style.display = 'none';
	});

	// Clear all error messages
	Array.from(document.getElementsByClassName('errorMsg')).forEach((element: HTMLElement) => {
		element.style.display = 'none';
	});
}

/**
 * Updates the user settings panel with information from the database.
 * Only called once on login, since any changes within a session will be saved by the browser.
 */
export async function updateUserSettings(user: firebase.User, currentUID: string): Promise<void> {
	const promises: [Promise<UserSettings>, Promise<number>] = [
		(PlayerInfo.getUserProperty(currentUID, 'userSettings') as Promise<UserSettings>),
		(PlayerInfo.getUserProperty(currentUID, 'rating') as Promise<number>)
	];

	const [userSettings, rating]: [UserSettings, number] = await Promise.all(promises);

	console.log(`configuring volume with ${userSettings.sfxVolume} and ${userSettings.musicVolume} from updateUserSettings`);
	globalAudioPlayer.configureVolume(userSettings);

	globalEmitter.emit('setSettings', userSettings);

	// Update the status bar
	document.getElementById(`${userSettings.voice}Voice`).classList.add('selected');
	document.getElementById('statusName').innerHTML = user.displayName;

	document.getElementById('statusRating').innerHTML = `Rating: ${rating}`;

	const rankBoundaries = Object.keys(ranks);
	const title = ranks[rankBoundaries[rankBoundaries.findIndex(minimumRating => Number(minimumRating) > rating) - 1]];
	document.getElementById('statusTitle').innerHTML = title;
}
