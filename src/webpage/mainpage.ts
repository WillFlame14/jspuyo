'use strict';

import { puyoImgs } from './panels_custom';
import { pageInit } from './pages';
import { PlayerInfo } from './firebase';
import { UserSettings } from '../utils/Settings';
import { AudioPlayer, VOICES } from '../utils/AudioPlayer';

import mitt from 'mitt';

const playerList = document.getElementById('playerList');
const messageList = document.getElementById('chatMessages');
let messageId = 0;
let lastSender = null;

let currentlyHost = false;
let globalEmitter: ReturnType<typeof mitt>;

export function mainpageInit(emitter: ReturnType<typeof mitt>, socket: SocketIOClient.Socket, getCurrentUID: () => string, audioPlayer: AudioPlayer): void {
	pageInit();

	globalEmitter = emitter;

	const statusClick = document.getElementById('statusClick');
	const statusHover = document.getElementById('statusHover');

	statusClick.onclick = function() {
		statusClick.classList.toggle('open');
		statusHover.classList.toggle('open');
	};

	const voiceSelect = document.getElementById('voiceSelect') as HTMLTableElement;
	let currentRow: HTMLTableRowElement;

	for(const [index, name] of Object.keys(VOICES).entries()) {
		const { colour } = VOICES[name];

		if(index % 4 === 0) {
			currentRow = voiceSelect.insertRow(-1);
		}
		const optionBox = currentRow.insertCell(-1);
		const option = document.createElement('div');
		option.id = `${name}Voice`;

		// Add select functionality for all voice options
		option.onclick = function() {
			audioPlayer.playVoice(name, 'select');
			PlayerInfo.getUserProperty(getCurrentUID(), 'userSettings').then((userSettings: UserSettings) => {
				// De-select old voice
				document.getElementById(`${userSettings.voice}Voice`).classList.remove('selected');

				// Select new voice
				option.classList.add('selected');

				// Update user settings
				userSettings.voice = name;
				PlayerInfo.updateUser(getCurrentUID(), 'userSettings', userSettings);
			}).catch((err) => {
				console.log(err);
			});
		};
		option.classList.add('voiceOption');
		option.style.backgroundColor = rgbaString(...colour, 0.8);

		optionBox.appendChild(option);
	}

	document.querySelectorAll('.roomManageOption').forEach(element => {
		element.addEventListener('click', () => {
			audioPlayer.playSfx('click_option');
		});
	});

	const sendMessageField = document.getElementById('sendMessage') as HTMLInputElement;
	const messageField = document.getElementById('messageField') as HTMLInputElement;
	sendMessageField.addEventListener('submit', event => {
		event.preventDefault();		// Do not refresh the page

		// Send message and clear the input field
		socket.emit('sendMessage', getCurrentUID(), messageField.value);
		messageField.value = '';
	});
	socket.on('sendMessage', (sender: string, message: string) => {
		void addMessage(sender, message);
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

/**
 * Adds a message to the chat box.
 */
export async function addMessage(sender: string, message: string): Promise<void> {
	if(lastSender === sender) {
		const element = document.getElementById(`message${messageId - 1}`).querySelector('.message');
		element.innerHTML += '<br>' + message;
	}
	else {
		const element = document.createElement('li');
		element.classList.add('chatMsg');
		element.id = `message${messageId}`;
		messageId++;

		const senderElement = document.createElement('span');
		senderElement.innerHTML = await PlayerInfo.getUserProperty(sender, 'username') as string;
		lastSender = sender;
		senderElement.classList.add('senderName');
		element.appendChild(senderElement);

		const messageElement = document.createElement('span');
		messageElement.innerHTML = message;
		messageElement.classList.add('message');
		element.appendChild(messageElement);

		messageList.appendChild(element);
	}
	messageList.scrollTop = messageList.scrollHeight;		// automatically scroll to latest message
}

/**
 * Clears all messages from the chat.
 */
export function clearMessages(): void {
	while(messageList.firstChild) {
		messageList.firstChild.remove();
	}

	// Reset the message states.
	messageId = 0;
	lastSender = null;
}

/**
 * Adds a player to the list of players.
 */
export function addPlayer(name: string, rating: number): void {
	const newPlayer = document.createElement('li');
	newPlayer.classList.add('playerIndividual');
	newPlayer.id = 'player' + name;

	const icon = document.createElement('img');
	icon.src = `images/modal_boxes/puyo_${puyoImgs[playerList.childElementCount % puyoImgs.length]}.png`;
	newPlayer.appendChild(icon);

	const playerName = document.createElement('span');
	playerName.innerHTML = name;
	newPlayer.appendChild(playerName);

	const playerRating = document.createElement('span');
	playerRating.innerHTML = `${rating}`;
	newPlayer.appendChild(playerRating);

	playerList.appendChild(newPlayer);
}

/**
 * Removes all players from the list of players.
 */
export function clearPlayers(): void {
	while(playerList.firstChild) {
		playerList.firstChild.remove();
	}
}

/**
 * Updates the playerList to the current array.
 */
export function updatePlayers(players: string[]): void {
	document.getElementById('playersDisplay').style.display = 'block';

	const promises: (Promise<string> | string | number)[] = [];
	// Fetch usernames from the database using the ids
	players.forEach(id => {
		if(id.includes('CPU-')) {
			promises.push(id);
			promises.push(1000);
		}
		else {
			promises.push(PlayerInfo.getUserProperty(id, 'username') as Promise<string>);
			promises.push(PlayerInfo.getUserProperty(id, 'rating') as Promise<string>);
		}
	});

	// Wait for all promises to resolve to usernames, then add them to the player list
	Promise.all(promises).then(playerInfos => {
		clearPlayers();
		for(let i = 0; i < playerInfos.length; i += 2) {
			addPlayer(`${playerInfos[i]}`, Number(playerInfos[i + 1]));
		}
	}).catch((err) => {
		console.log(err);
	});
}

export function hidePlayers(): void {
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'none';
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

/**
 * Returns an rgba CSS string, given the RGB + opacity values.
 */
function rgbaString(red?: number, green?: number, blue?: number, opacity = 1) {
	return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
