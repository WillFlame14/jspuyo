'use strict';

const { puyoImgs } = require('./panels.js');
const { setCreateRoomTrigger } = require('./panels.js');

const playerList = document.getElementById('playerList');
const messageList = document.getElementById('chatMessages');
let messageId = 0;
let lastSender = null;

let currentlyHost = false;

function mainpageInit(playerInfo) {
	const { socket, gameId } = playerInfo;

	const sendMessageField = document.getElementById('sendMessage');
	const messageField = document.getElementById('messageField');
	sendMessageField.addEventListener("submit", event => {
		event.preventDefault();		// Do not refresh the page

		// Send message and clear the input field
		socket.emit('sendMessage', gameId, messageField.value);
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
		socket.emit('requestCpus', gameId);
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
		socket.emit('addCpu', gameId);
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
		socket.emit('removeCpu', gameId);
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
		socket.emit('setCpus', { gameId, cpus });

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

	document.getElementById('manageStartRoom').onclick = function() {
		socket.emit('startRoom', gameId);
	};

	document.getElementById('manageJoinLink').onclick = function() {
		socket.emit('requestJoinLink', gameId);
	};

	document.getElementById('manageSpectate').onclick = function() {
		socket.emit('spectate', gameId);
	};
}

/**
 * Adds a message to the chat box.
 */
function addMessage(sender, message) {
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
		senderElement.innerHTML = sender;
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
}

/**
 * Adds a player to the list of players.
 */
function addPlayer(name, rating = 1000) {
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
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'block';
	players.forEach(id => {
		addPlayer(id);
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

	document.getElementById('manageStartRoom').style.display = host ? 'grid' : 'none';
}

module.exports = {
	mainpageInit,
	addMessage,
	clearMessages,
	updatePlayers,
	hidePlayers,
	toggleHost
};
