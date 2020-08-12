'use strict';

const { puyoImgs } = require('./panels.js');
const { setCreateRoomTrigger } = require('./panels.js');
const { pageInit } = require('./pages.js');
const { PlayerInfo } = require('./firebase.js');

const playerList = document.getElementById('playerList');
const messageList = document.getElementById('chatMessages');
let messageId = 0;
let lastSender = null;

let currentlyHost = false;

function mainpageInit(socket, getCurrentUID) {
	pageInit();

	const sendMessageField = document.getElementById('sendMessage');
	const messageField = document.getElementById('messageField');
	sendMessageField.addEventListener("submit", event => {
		event.preventDefault();		// Do not refresh the page

		// Send message and clear the input field
		socket.emit('sendMessage', getCurrentUID(), messageField.value);
		messageField.value = '';
	});
	socket.on('sendMessage', (sender, message) => {
		addMessage(sender, message);
	});

	const modal = document.getElementById('modal-background');				// The semi-transparent gray background
	const cpuOptionsError = document.getElementById('cpuOptionsError');		// The error message that appears when performing an invalid action (invisible otherwise)
	const cpuOptionsEmpty = document.getElementById('cpuOptionsEmpty');		// The division that indicates there are currently no CPUs (invisible otherwise)

	document.getElementById('manageCpus').onclick = function() {
		toggleHost(currentlyHost);

		modal.style.display = 'block';
		cpuOptionsError.style.display = 'none';
		document.getElementById('cpuOptionsModal').style.display = 'block';
		socket.emit('requestCpus', getCurrentUID());
	};

	socket.on('requestCpusReply', cpus => {
		// Hide ("delete") all existing CPUs
		document.querySelectorAll('.cpuOption').forEach(option => {
			option.style.display = 'none';
		});

		// Then add the current CPUs
		cpus.forEach((cpu, index) => {
			const { ai, speed } = cpu;
			const cpuElement = document.getElementById('cpu' + (index + 1));
			cpuElement.style.display = 'grid';
			cpuElement.querySelector('.aiOption').value = ai;
			cpuElement.querySelector('.cpuSpeedSlider').value = speed;
		});
		cpuOptionsEmpty.style.display = (cpus.length === 0) ? 'block' : 'none';
	});

	document.getElementById('cpuOptionsAdd').onclick = function() {
		// Send request to server to add CPU (can only add only up to roomsize)
		socket.emit('addCpu', getCurrentUID());
	};

	socket.on('addCpuReply', index => {
		if(index === -1) {
			// No space in room
			cpuOptionsError.style.display = 'block';
			cpuOptionsError.innerHTML = 'There is no more space in the room.';
			return;
		}
		else if(index === 0) {
			// Adding the first CPU, so remove the empty message
			cpuOptionsEmpty.style.display = 'none';
		}
		// Turn on the cpu at the provided index
		document.getElementById('cpu' + (index + 1)).style.display = 'grid';
		cpuOptionsError.style.display = 'none';
	});

	document.getElementById('cpuOptionsRemove').onclick = function() {
		// Send request to server to remove CPU (can only remove if there are any CPUs)
		socket.emit('removeCpu', getCurrentUID());
	};

	socket.on('removeCpuReply', index => {
		if(index === -1) {
			// No CPUs in room
			cpuOptionsError.style.display = 'block';
			cpuOptionsError.innerHTML = 'There no CPUs currently in the room.';
			return;
		}
		else if(index === 0) {
			// Removing the last CPU, so add the empty message
			cpuOptionsEmpty.style.display = 'block';
		}
		// Turn off the cpu at the provided index
		document.getElementById('cpu' + (index + 1)).style.display = 'none';
		cpuOptionsError.style.display = 'none';
	});

	document.getElementById('cpuOptionsSubmit').onclick = function() {
		const cpus = [];

		document.querySelectorAll('.aiOption').forEach(dropdown => {
			// Do not read from invisible options
			if(window.getComputedStyle(dropdown).getPropertyValue('display') === 'block') {
				cpus.push({ id: null, ai: dropdown.options[dropdown.selectedIndex].value });
			}
		});

		document.querySelectorAll('.cpuSpeedSlider').forEach((slider, index) => {
			// Do not read from invisible options
			if(window.getComputedStyle(slider).getPropertyValue('display') === 'block') {
				// Slider value is between 0 and 10, map to between 5000 and 0
				cpus[index].speed = (10 - slider.value) * 500;
			}
		});
		socket.emit('setCpus', { gameId: getCurrentUID(), cpus });

		// Close the CPU options menu
		document.getElementById('cpuOptionsModal').style.display = 'none';
		modal.style.display = 'none';
	};

	document.getElementById('manageSettings').onclick = function() {
		toggleHost(currentlyHost);

		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomSubmit').value = 'Save Settings';

		// Disable the roomsize options
		document.querySelectorAll('.numPlayerButton').forEach(element => {
			element.classList.add('disabled');
		});
		document.getElementById('5player').disabled = true;

		// Flag so the submit button causes settings to be changed (instead of creating a new room)
		setCreateRoomTrigger('set');
	};

	document.getElementById('manageRoomPassword').onclick = function() {
		modal.style.display = 'block';
		document.getElementById('roomPasswordModal').style.display = 'block';
	};

	document.getElementById('roomPasswordForm').onsubmit = function (event) {
		// Prevent submit button from refreshing the page
		event.preventDefault();

		const password = document.getElementById('roomPassword').value || null;

		socket.emit('setRoomPassword', getCurrentUID(), password);
		document.getElementById('roomPasswordModal').style.display = 'none';
		modal.style.display = 'none';
	};

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
async function addMessage(sender, message) {
	if(lastSender === sender) {
		const element = document.getElementById('message' + (messageId - 1)).querySelector('.message');
		element.innerHTML += '<br>' + message;
	}
	else {
		const element = document.createElement('li');
		element.classList.add('chatMsg');
		element.id = 'message' + messageId;
		messageId++;

		const senderElement = document.createElement('span');
		senderElement.innerHTML = await PlayerInfo.getUserProperty(sender, 'username');
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
function clearMessages() {
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
function addPlayer(name, rating) {
	const newPlayer = document.createElement('li');
	newPlayer.classList.add('playerIndividual');
	newPlayer.id = 'player' + name;

	const icon = document.createElement('img');
	icon.src = `images/modal_boxes/${puyoImgs[playerList.childElementCount % puyoImgs.length]}.png`;
	newPlayer.appendChild(icon);

	const playerName = document.createElement('span');
	playerName.innerHTML = name;
	newPlayer.appendChild(playerName);

	const playerRating = document.createElement('span');
	playerRating.innerHTML = rating;
	newPlayer.appendChild(playerRating);

	playerList.appendChild(newPlayer);
}

/**
 * Removes all players from the list of players.
 */
function clearPlayers() {
	while(playerList.firstChild) {
		playerList.firstChild.remove();
	}
}

/**
 * Updates the playerList to the current array.
 */
function updatePlayers(players) {
	document.getElementById('playersDisplay').style.display = 'block';

	const promises = [];
	// Fetch usernames from the database using the ids
	players.forEach(id => {
		if(id.includes('CPU-')) {
			promises.push(id);
			promises.push(1000);
		}
		else {
			promises.push(PlayerInfo.getUserProperty(id, 'username'));
			promises.push(PlayerInfo.getUserProperty(id, 'rating'));
		}
	});

	// Wait for all promises to resolve to usernames, then add them to the player list
	Promise.all(promises).then(playerInfos => {
		clearPlayers();
		for(let i = 0; i < playerInfos.length; i += 2) {
			addPlayer(playerInfos[i], Number(playerInfos[i + 1]));
		}
	});
}

function hidePlayers() {
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'none';
}

function toggleHost(host) {
	currentlyHost = host;
	// The Add/Remove/Save CPU buttons
	document.getElementById('cpuOptionsButtons').style.display = host ? 'grid' : 'none';

	// The CPU control options
	document.querySelectorAll('.aiOption').forEach(dropdown => {
		dropdown.disabled = !host;
	});
	document.querySelectorAll('.cpuSpeedSlider').forEach(slider => {
		slider.disabled = !host;
	});

	// The main Room Options (Disable the mode icon in future?)
	document.getElementById('numRows').disabled = !host;
	document.getElementById('numCols').disabled = !host;
	document.getElementById('numColours').disabled = !host;

	// The advanced Room Options
	document.querySelectorAll('.roomOptionInput').forEach(input => {
		input.disabled = !host;
	});

	// The submit button for Room Options
	document.getElementById('createRoomSubmit').style.display = host ? 'block' : 'none';

	// Turn on all the typical room manage options
	document.getElementById('roomManage').querySelectorAll('.player').forEach(element => {
		element.style.display = 'grid';
	});

	document.getElementById('manageStartRoom').style.display = host ? 'grid' : 'none';
	document.getElementById('manageRoomPassword').style.display = host ? 'grid' : 'none';
	document.getElementById('managePlay').style.display = 'none';
}

function toggleSpectate() {
	document.getElementById('roomManage').querySelectorAll('.player').forEach(element => {
		element.style.display = 'none';
	});
	document.getElementById('managePlay').style.display = 'grid';
}

module.exports = {
	mainpageInit,
	addMessage,
	clearMessages,
	updatePlayers,
	hidePlayers,
	toggleHost,
	toggleSpectate
};
