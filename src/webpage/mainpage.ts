'use strict';

import { AudioPlayer } from '../utils/AudioPlayer';
import { CpuInfo } from '../Room';

import mitt from 'mitt';
import { Socket } from 'socket.io-client';

let currentlyHost = false;
let globalEmitter: ReturnType<typeof mitt>;

export function mainpageInit(emitter: ReturnType<typeof mitt>, socket: Socket, getCurrentUID: () => string, audioPlayer: AudioPlayer): void {
	globalEmitter = emitter;

	document.querySelectorAll('.roomManageOption').forEach(element => {
		element.addEventListener('click', () => {
			audioPlayer.playSfx('click_option');
		});
	});

	document.getElementById('manageCpus').onclick = function() {
		toggleHost(currentlyHost);

		globalEmitter.emit('setActiveModal', { name: 'CpuOptionsModal' });
		socket.emit('requestCpus', getCurrentUID());
	};

	socket.on('requestCpusReply', (cpus: { ai: string, speed: number }[]) => {
		emitter.emit('presetCpus', cpus);
	});

	emitter.on('setCpus', (cpuInfos: { ai: string, speed: number }[]) => {
		const cpus: CpuInfo[] = [];

		cpuInfos.forEach(cpuInfo => {
			const cpu = Object.assign({ client_socket: null, socket: null }, cpuInfo);
			cpu.speed = (10 - cpu.speed) * 500;

			cpus.push(cpu);
		});

		socket.emit('setCpus', { gameId: getCurrentUID(), cpus });
		audioPlayer.playSfx('submit');

		// Close the CPU options menu
		globalEmitter.emit('clearModal');
	});

	document.getElementById('manageSettings').onclick = function() {
		toggleHost(currentlyHost);

		// Flag so the submit button causes settings to be changed (instead of creating a new room)
		globalEmitter.emit('setActiveModal', { name: 'RoomOptionsModal', props: { createRoomMode: 'set' } });
	};

	document.getElementById('manageRoomPassword').onclick = function() {
		globalEmitter.emit('setActiveModal', { name: 'SetRoomPasswordModal' });
	};

	emitter.on('submitRoomPassword', () => {
		globalEmitter.emit('clearModal');
	});

	document.getElementById('manageStartRoom').onclick = function() {
		socket.emit('startRoom', getCurrentUID());
	};

	document.getElementById('manageJoinLink').onclick = function() {
		socket.emit('requestJoinLink', getCurrentUID());
	};

	document.getElementById('manageSpectate').onclick = function() {
		socket.emit('spectate', getCurrentUID());
	};

	document.getElementById('managePlay').onclick = function() {
		socket.emit('joinRoom', { gameId: getCurrentUID() });
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
