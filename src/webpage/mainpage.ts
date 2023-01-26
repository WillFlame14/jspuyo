'use strict';

import { AudioPlayer } from '../utils/AudioPlayer';

import mitt from 'mitt';
import { ServerToClientEvents, ClientToServerEvents } from '../@types/events';
import { Socket } from 'socket.io-client';

type CSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let currentlyHost = false;
let globalEmitter: ReturnType<typeof mitt>;

export function mainpageInit(emitter: ReturnType<typeof mitt>, socket: CSocket, getCurrentUID: () => string, audioPlayer: AudioPlayer): void {
	globalEmitter = emitter;

	document.querySelectorAll('.roomManageOption').forEach(element => {
		element.addEventListener('click', () => {
			audioPlayer.playSfx('click_option');
		});
	});

	document.getElementById('manageCpus').onclick = function() {
		toggleHost(currentlyHost);

		globalEmitter.emit('setActiveModal', { name: 'CpuOptionsModal' });
		socket.emit('requestCpus', getCurrentUID(), (cpus) => {
			emitter.emit('presetCpus', cpus);
		});
	};

	document.getElementById('manageSettings').onclick = function() {
		toggleHost(currentlyHost);

		// Flag so the submit button causes settings to be changed (instead of creating a new room)
		globalEmitter.emit('setActiveModal', { name: 'RoomOptionsModal', props: { createRoomMode: 'set' } });
	};

	document.getElementById('manageRoomPassword').onclick = function() {
		globalEmitter.emit('setActiveModal', { name: 'SetRoomPasswordModal' });
	};

	document.getElementById('manageStartRoom').onclick = function() {
		socket.emit('startRoom', getCurrentUID());
	};

	document.getElementById('manageJoinLink').onclick = function() {
		socket.emit('requestJoinLink', getCurrentUID(), (roomId) => {
			globalEmitter.emit('setActiveModal', { name: 'JoinIdModal', props: { roomId } });
		});
	};

	document.getElementById('manageSpectate').onclick = function() {
		socket.emit('spectateRoom', getCurrentUID());
	};

	document.getElementById('managePlay').onclick = function() {
		// FIX: Missing joinId?
		// socket.emit('joinRoom', { gameId: getCurrentUID() });
	};
}

export function toggleHost(host: boolean): void {
	currentlyHost = host;
	globalEmitter.emit('toggleHost', host);

	globalEmitter.emit('disableRoomSettings', !host);

	// Turn on all the typical room manage options
	document.getElementById('roomManage').querySelectorAll('.player').forEach((element: HTMLElement) => {
		element.style.display = 'grid';
	});

	document.getElementById('manageStartRoom').style.display = host ? 'grid' : 'none';
	document.getElementById('manageRoomPassword').style.display = host ? 'grid' : 'none';
	document.getElementById('managePlay').style.display = 'none';
}

export function toggleSpectate(): void {
	document.getElementById('roomManage').querySelectorAll('.player').forEach((element: HTMLElement) => {
		element.style.display = 'none';
	});
	document.getElementById('managePlay').style.display = 'grid';
}
