'use strict';

const { puyoImgs } = require('./panels.js');

const playerList = document.getElementById('playerList');
const messageList = document.getElementById('chatMessages');
let messageId = 0;
let lastSender = null;

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

	const modal = document.getElementById('modal-background');

	document.getElementById('manageCpus').onclick = function() {
		modal.style.display = 'block';
		document.getElementById('cpuOptionsModal').style.display = 'block';
	};

	document.getElementById('manageSettings').onclick = function() {
		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
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

module.exports = {
	mainpageInit,
	addMessage,
	clearMessages,
	updatePlayers,
	hidePlayers
};
