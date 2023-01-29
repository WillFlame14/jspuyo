'use strict';

import mitt from 'mitt';
import { User } from 'firebase/auth';
import { ServerToClientEvents, ClientToServerEvents } from '../@types/events';
import { Socket } from 'socket.io-client';

import { AudioPlayer } from '../utils/AudioPlayer';
import { PlayerInfo } from './firebase';
import { UserSettings } from '../utils/Settings';

import store from './store';

let globalEmitter: ReturnType<typeof mitt>;
let globalAudioPlayer: AudioPlayer;

export const puyoImgs: string[] = ['red', 'blue', 'green', 'yellow', 'purple', 'teal'];

export function panelsInit(
	emitter: ReturnType<typeof mitt>,
	socket: Socket<ServerToClientEvents, ClientToServerEvents>,
	audioPlayer: AudioPlayer
): void {
	globalEmitter = emitter;
	globalAudioPlayer = audioPlayer;

	// Dialog panels
	document.getElementById('dialogAccept').onclick = () => {
		document.getElementById('dialogBox').style.display = 'none';
		document.getElementById('modal-background-disable').style.display = 'none';
	};

	// Received when room cannot be joined
	socket.on('joinFailure', (errorMsg) => {
		// Display modal elements if they are not already being displayed (e.g. arrived from direct join link)
		store.setActiveModal('JoinRoomModal', { errorMsg });
	});

	// Event received when attempting to join a password-protected room
	socket.on('requireRoomPassword', (roomId) => {
		store.setActiveModal('JoinRoomPasswordModal', { roomId });
	});

	// Event received when entering the wrong password to a password-protected room
	socket.on('joinRoomPasswordFailure', (errorMsg) => {
		store.setActiveModal('JoinRoomPasswordModal', { errorMsg });
	});

	// Received when attempting to spectate an invalid room
	socket.on('spectateFailure', (errorMsg) => {
		store.setActiveModal('SpectateRoomModal', { errorMsg });
	});
}

/**
 * Removes all modal elements from view.
 */
export function clearModal(): void {
	// Prevent closing modal boxes if any dialog box has not been closed yet
	if(document.getElementById('modal-background-disable').style.display === 'block') {
		return;
	}

	store.clearModal();
}

export function showDialog(message: string): void {
	document.getElementById('modal-background-disable').style.display = 'block';
	document.getElementById('dialogText').innerHTML = message;
	document.getElementById('dialogBox').style.display = 'block';
}

/**
 * Updates the user settings panel with information from the database.
 * Only called once on login, since any changes within a session will be saved by the browser.
 */
export async function updateUserSettings(user: User, currentUID: string): Promise<void> {
	const promises: [Promise<UserSettings>, Promise<number>] = [
		(PlayerInfo.getUserProperty(currentUID, 'userSettings') as Promise<UserSettings>),
		(PlayerInfo.getUserProperty(currentUID, 'rating') as Promise<number>)
	];

	const [userSettings, rating]: [UserSettings, number] = await Promise.all(promises);
	globalAudioPlayer.configureVolume(userSettings);
	store.updateUserSettings(userSettings);

	globalEmitter.emit('updateStatus', {
		name: user.displayName,
		rating,
		voice: userSettings.voice
	});
}
