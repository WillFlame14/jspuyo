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

	const modal = document.getElementById('modal-background');				// The semi-transparent gray background
	const cpuOptionsError = document.getElementById('cpuOptionsError');		// The error message that appears when performing an invalid action (invisible otherwise)

	document.getElementById('manageCpus').onclick = function() {
		toggleHost(currentlyHost);

		modal.style.display = 'block';
		cpuOptionsError.style.display = 'none';
		document.getElementById('cpuOptionsModal').style.display = 'block';
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
		document.getElementById('cpuOptionsModal').style.display = 'none';
		modal.style.display = 'none';
	});

	document.getElementById('manageSettings').onclick = function() {
		toggleHost(currentlyHost);

		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';

		// Flag so the submit button causes settings to be changed (instead of creating a new room)
		emitter.emit('setMode', 'set');
	};

	document.getElementById('manageRoomPassword').onclick = function() {
		modal.style.display = 'block';
		document.getElementById('roomPasswordModal').style.display = 'block';
	};

	emitter.on('submitRoomPassword', () => {
		document.getElementById('roomPasswordModal').style.display = 'none';
		modal.style.display = 'none';
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
	// The Add/Remove/Save CPU buttons
	document.getElementById('cpuOptionsButtons').style.display = host ? 'grid' : 'none';

	// The CPU control options
	document.querySelectorAll('.aiOption').forEach((dropdown: HTMLOptionElement) => {
		dropdown.disabled = !host;
	});
	document.querySelectorAll('.cpuSpeedSlider').forEach((slider: HTMLInputElement) => {
		slider.disabled = !host;
	});

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
