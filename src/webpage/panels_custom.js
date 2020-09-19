'use strict';

const { CpuVariants } = require('../cpu/CpuVariants.js');
const { PlayerInfo } = require('./firebase.js');
const { SettingsBuilder } = require('../utils/Settings.js');
const { Utils } = require('../utils/Utils.js');

const winConditions = ['FT 3', 'FT 5', 'FT 7'];

const createRoomOptionsState = {
	selectedMode: 'Tsu',
	selectedPlayers: '4player',
	numColours: 4,
	winCondition: 'FT 3'
};

let createRoomTrigger;

function initCustomPanels(puyoImgs, stopCurrentSession, socket, audioPlayer, getCurrentUID) {
	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	// Custom - Create Room
	document.getElementById('createRoom').onclick = () => {
		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomSubmit').value = 'Create Room';

		// Re-enable the roomsize options
		document.querySelectorAll('.numPlayerButton').forEach(element => {
			element.classList.remove('disabled');
		});
		document.getElementById('5player').disabled = false;

		// Re-enable the main Room Options (Disable the mode icon in future?)
		document.getElementById('numRows').disabled = false;
		document.getElementById('numCols').disabled = false;
		document.getElementById('numColours').disabled = false;

		// Re-enable the advanced Room Options
		document.querySelectorAll('.roomOptionInput').forEach(input => {
			input.disabled = false;
		});

		// Re-enable the submit button
		document.getElementById('createRoomSubmit').style.display = 'block';

		// Set the new trigger
		setCreateRoomTrigger('create');
	};

	// Switch between Tsu and Fever mods on click
	const modeIcon = document.getElementById('modeIcon');
	modeIcon.onclick = () => {
		switch(createRoomOptionsState.selectedMode) {
			case "Tsu":
				modeIcon.src = "images/modal_boxes/Fever_icon.png";
				createRoomOptionsState.selectedMode = "Fever";
				break;
			case "Fever":
				modeIcon.src = "images/modal_boxes/Tsu_icon.png";
				createRoomOptionsState.selectedMode = "Tsu";
				break;
		}
	};

	// Maintain the currently selected button and highlight it
	Array.from(document.getElementsByClassName('numPlayerButton')).forEach(element => {
		element.onclick = () => {
			const oldId = createRoomOptionsState.selectedPlayers;
			if(element.id !== oldId && !element.classList.contains('disabled')) {
				document.getElementById(oldId).classList.remove('selected');
				element.classList.add('selected');
				createRoomOptionsState.selectedPlayers = element.id;
			}
		};
	});

	// Read the input field and update the number of colours displayed accordingly
	document.getElementById('numColours').oninput = () => {
		let currentNumber = Math.floor(Number(document.getElementById('numColours').value)) || 0;
		let lastNumber = createRoomOptionsState.numColours;
		const coloursSelected = document.getElementById('coloursSelected');

		currentNumber = Utils.clampBetween(currentNumber, 0, 5);

		while(lastNumber < currentNumber) {
			const newImg = document.createElement('img');
			newImg.src = `images/modal_boxes/${puyoImgs[lastNumber]}.png`;
			coloursSelected.appendChild(newImg);
			lastNumber++;
		}

		while(lastNumber > currentNumber) {
			// Remove last child
			coloursSelected.removeChild(coloursSelected.children[coloursSelected.children.length - 1]);
			lastNumber--;
		}
		createRoomOptionsState.numColours = currentNumber;
	};

	// Switch between win conditions on click
	const winConditionButton = document.getElementById('winCondition');
	winConditionButton.onclick = () => {
		let currentIndex = winConditions.indexOf(winConditionButton.value);
		if(currentIndex === winConditions.length - 1) {
			currentIndex = 0;
		}
		else {
			currentIndex++;
		}
		winConditionButton.value = winConditions[currentIndex];
	};

	document.getElementById('createRoomSubmit').onclick = async function (event) {
		event.preventDefault();		// Prevent submit button from refreshing the page

		let roomSize;
		if(createRoomOptionsState.selectedPlayers === '5player') {
			const value = Number(document.getElementById('5player').value) || 4;
			roomSize = Utils.clampBetween(value, 1, 16);
		}
		else {
			roomSize = Number(createRoomOptionsState.selectedPlayers.charAt(0));
		}

		// Generate the validated settings string
		const settingsString = new SettingsBuilder()
			.setGamemode(createRoomOptionsState.selectedMode)
			.setGravity(document.getElementById('gravity').value)
			.setRows(document.getElementById('numRows').value)
			.setCols(document.getElementById('numCols').value)
			.setSoftDrop(document.getElementById('softDrop').value)
			.setNumColours(document.getElementById('numColours').value)
			.setTargetPoints(document.getElementById('targetPoints').value)
			.setMarginTimeInSeconds(document.getElementById('marginTime').value)
			.setMinChain(document.getElementById('minChainLength').value).build().toString();

		switch(createRoomTrigger) {
			case 'create':
				await stopCurrentSession();
				socket.emit('createRoom', { gameId: getCurrentUID(), settingsString, roomSize });
				break;
			case 'set':
				socket.emit('changeSettings', getCurrentUID(), settingsString, roomSize);
				break;
		}
		audioPlayer.playSfx('submit');

		// Close the CPU options menu
		document.getElementById('createRoomModal').style.display = 'none';
		modal.style.display = 'none';
	};

	// Receiving the id of the newly created room
	socket.on('giveRoomId', id => {
		// Hide the "Copied" message
		document.getElementById('joinIdCopied').style.display = 'none';

		modal.style.display = 'block';
		document.getElementById('giveJoinId').style.display = 'block';
		document.getElementById('joinIdLink').value = `${window.location.href.split('?')[0]}?joinRoom=${id}`;
	});

	// Setting the click event for copying link to clipboard
	document.getElementById('copyJoinId').onclick = function() {
		// Select the input field with the link
		document.getElementById('joinIdLink').select();
		try {
			// Copy the selected text and show "Copied!" message
			document.execCommand('copy');
			document.getElementById('joinIdCopied').style.display = 'block';
		}
		catch(err) {
			console.warn(err);
		}
		finally {
			// Deselect the input field
			document.getSelection().removeAllRanges();
			audioPlayer.playSfx('submit');
		}
	};

	// Custom - Join Room
	document.getElementById('joinRoom').onclick = () => {
		modal.style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'block';
	};

	document.getElementById('joinIdForm').onsubmit = async function (event) {
		// Prevent submit button from refreshing the page
		event.preventDefault();
		const joinId = document.getElementById('joinId').value;

		await stopCurrentSession();
		socket.emit('joinRoom', { gameId: getCurrentUID(), joinId });
		audioPlayer.playSfx('submit');
	};

	// Received when room cannot be joined
	socket.on('joinFailure', (errMessage) => {
		// Display modal elements if they are not already being displayed (e.g. arrived from direct join link)
		modal.style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'block';

		document.getElementById('joinIdFormError').innerHTML = errMessage;

		// Make the element containing the error message visible
		document.getElementById('joinIdFormError').style.display = 'block';
	});

	// Event received when attempting to join a password-protected room
	socket.on('requireRoomPassword', roomId => {
		modal.style.display = 'block';
		document.getElementById('joinRoomPasswordModal').style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'none';
		document.getElementById('joinRoomId').innerHTML = roomId;
	});

	// The form to submit the room password
	document.getElementById('joinRoomPasswordForm').onsubmit = function (event) {
		// Prevent submit button from refreshing the page
		event.preventDefault();
		const roomPassword = document.getElementById('joinRoomPassword').value;
		const joinId = document.getElementById('joinRoomId').innerHTML || null;

		socket.emit('joinRoom', { gameId: getCurrentUID(), joinId, roomPassword });
		audioPlayer.playSfx('submit');
	};

	// Event received when entering the wrong password to a password-protected room
	socket.on('joinRoomPasswordFailure', message => {
		modal.style.display = 'block';
		document.getElementById('joinRoomPasswordModal').style.display = 'block';
		document.getElementById('joinRoomPasswordFormError').innerHTML = message;
		document.getElementById('joinRoomPasswordFormError').style.display = 'block';
	});

	// Custom - Spectate
	document.getElementById('spectate').onclick = () => {
		stopCurrentSession();
		socket.emit('getAllRooms', getCurrentUID());

		modal.style.display = 'block';
		document.getElementById('spectateRoomModal').style.display = 'block';
	};

	const roomList = document.getElementById('roomList');
	const roomPlayers = document.getElementById('roomPlayers');

	socket.on('allRooms', roomIds => {
		const roomIdsElement = document.getElementById('roomIds');
		const spectateFormError = document.getElementById('spectateFormError');
		const spectateSubmit = document.getElementById('spectateSubmit');

		while(roomIdsElement.firstChild) {
			roomIdsElement.firstChild.remove();
		}

		// Add all the room ids to the dropdown menu
		roomIds.forEach(id => {
			const option = document.createElement('option');
			option.value = id;
			option.innerHTML = id;
			roomIdsElement.appendChild(option);
		});

		if(roomIds.length === 0) {
			roomList.style.display = 'none';
			roomPlayers.style.display = 'none';
			spectateFormError.innerHTML = 'There are no rooms currently available to spectate.';
			spectateFormError.style.display = 'block';
			if(!spectateSubmit.classList.contains('disable')) {
				spectateSubmit.classList.add('disable');
			}
			spectateSubmit.disabled = true;
		}
		else {
			roomList.style.display = 'inline-block';
			spectateFormError.style.display = 'none';
			if(spectateSubmit.classList.contains('disable')) {
				spectateSubmit.classList.remove('disable');
			}
			spectateSubmit.disabled = false;
		}
	});

	// Attempt to display the players in the room by sending a request to the server
	roomList.addEventListener('input', () => {
		// All valid room ids are of length 6
		if(roomList.value.length === 6) {
			socket.emit('getPlayers', roomList.value);
		}
		else {
			roomPlayers.style.display = 'none';
		}
	});

	// Receiving the results of the request
	socket.on('givePlayers', players => {
		// Server returns an empty array if room does not exist
		if(players.length === 0) {
			roomPlayers.style.display = 'none';
		}
		else {
			const promises = players.map(playerId => PlayerInfo.getUserProperty(playerId, 'username'));

			Promise.all(promises).then(playerNames => {
				roomPlayers.style.display = 'block';
				roomPlayers.innerHTML = `Players: ${JSON.stringify(playerNames)}`;
			});
		}
	});

	document.getElementById('spectateForm').onsubmit = event => {
		// Do not refresh the page on submit
		event.preventDefault();

		socket.emit('spectate', getCurrentUID(), roomList.value);
		audioPlayer.playSfx('submit');
	};

	// Received when attempting to spectate an invalid room
	socket.on('spectateFailure', errMessage => {
		const spectateFormError = document.getElementById('spectateFormError');

		spectateFormError.innerHTML = errMessage;
		spectateFormError.style.display = 'block';
	});

	createCPUOptions(puyoImgs);

	return Promise.resolve();
}

function createCPUOptions(puyoImgs) {
	const aiDropdown = document.createElement('select');
	aiDropdown.classList.add('aiOption');

	CpuVariants.getAllCpuNames().forEach(cpuName => {
		const option = document.createElement('option');
		option.value = cpuName;
		option.innerHTML = cpuName;
		aiDropdown.appendChild(option);
	});

	const cpuSpeedSlider = document.createElement('input');
	cpuSpeedSlider.classList.add('cpuSpeedSlider');
	cpuSpeedSlider.type = 'range';
	cpuSpeedSlider.max = '10';
	cpuSpeedSlider.min = '0';
	cpuSpeedSlider.defaultValue = '8';

	const speedDisplay = document.createElement('span');
	speedDisplay.classList.add('option-title', 'speedDisplay');
	speedDisplay.innerHTML = cpuSpeedSlider.defaultValue;

	const aiLabel = document.createElement('span');
	aiLabel.classList.add('option-title', 'aiLabel');
	aiLabel.innerHTML = 'AI';

	const speedLabel = document.createElement('span');
	speedLabel.classList.add('option-title', 'speedLabel');
	speedLabel.innerHTML = 'Speed';

	// Add CPU options selectors
	for(let i = 0; i < 6; i++) {
		const cpuOptionElement = document.createElement('div');
		cpuOptionElement.id = 'cpu' + (i + 1);
		cpuOptionElement.classList.add('cpuOption');

		const cpuIcon = document.createElement('img');
		cpuIcon.src = `images/modal_boxes/${puyoImgs[i]}.png`;
		cpuOptionElement.appendChild(cpuIcon);

		cpuOptionElement.appendChild(aiLabel.cloneNode(true));
		cpuOptionElement.appendChild(speedLabel.cloneNode(true));
		cpuOptionElement.appendChild(aiDropdown.cloneNode(true));

		const speedDisplayClone = speedDisplay.cloneNode(true);
		const cpuSpeedSliderClone = cpuSpeedSlider.cloneNode(true);
		cpuSpeedSliderClone.oninput = function() {
			speedDisplayClone.innerHTML = this.value;
		};
		cpuOptionElement.appendChild(speedDisplayClone);
		cpuOptionElement.appendChild(cpuSpeedSliderClone);

		document.getElementById('cpuOptions').appendChild(cpuOptionElement);
	}
}

function setCreateRoomTrigger(trigger) {
	createRoomTrigger = trigger;
}

module.exports = { initCustomPanels };
