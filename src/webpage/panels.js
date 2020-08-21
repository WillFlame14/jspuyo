'use strict';

const { Cpu } = require('../Cpu.js');
const { Utils, SettingsBuilder } = require('../Utils.js');
const { PlayerInfo, signOut } = require('./firebase.js');

const puyoImgs = ['puyo_red', 'puyo_blue', 'puyo_green', 'puyo_yellow', 'puyo_purple', 'puyo_teal'];
const winConditions = ['FT 3', 'FT 5', 'FT 7'];

const createRoomOptionsState = {
	selectedMode: 'Tsu',
	selectedPlayers: '4player',
	numColours: 4,
	winCondition: 'FT 3'
};

let selectedAppearance = 'TsuClassic';
let keyBindingRegistration = null;
let keyBindings = {
	moveLeft: 'ArrowLeft',
	moveRight: 'ArrowRight',
	rotateCCW: 'KeyZ',
	rotateCW: 'KeyX',
	softDrop: 'ArrowDown',
	hardDrop: 'ArrowUp'
};

let createRoomTrigger;

function panelsInit(socket, getCurrentUID, stopCurrentSession) {
	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	// Set all close buttons to remove modals
	Array.from(document.getElementsByClassName('close')).forEach(close => {
		close.onclick = () => clearModal();
	});

	// Manage window onclick
	window.onclick = function(event) {
		if (event.target === modal) {
			clearModal();
		}
	};

	// Turns a code.event string into a more human-readable display
	const codeToDisplay = function(code) {
		// Cut off prefixes
		if(code.includes('Key')) {
			code = code.substring(3);
		}
		else if(code.includes('Digit')) {
			code = code.substring(5);
		}

		switch(code) {
			case 'ArrowLeft':
				return '\u2190';
			case 'ArrowRight':
				return '\u2192';
			case 'ArrowDown':
				return '\u2193';
			case 'ArrowUp':
				return '\u2191';
			case 'ShiftLeft':
				return 'LSH';
			case 'ShiftRight':
				return 'RSH';
			default:
				return code.toUpperCase();
		}
	};

	window.onkeydown = function(event) {
		if(keyBindingRegistration !== null) {
			document.getElementById(keyBindingRegistration).value = codeToDisplay(event.code);

			// set the actual key binding
			keyBindings[keyBindingRegistration.replace('Binding', '')] = event.code;

			keyBindingRegistration = null;
		}
	};

	// Switch all toggleable buttons between on/off when clicked
	Array.from(document.getElementsByClassName('on')).concat(Array.from(document.getElementsByClassName('off'))).forEach(button => {
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
	document.getElementById('freeForAll').onclick = () => {
		stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Free For All';
		socket.emit('freeForAll', { gameId: getCurrentUID() });
	};
	document.getElementById('ranked').onclick = () => {
		stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Ranked';
		socket.emit('ranked', { gameId: getCurrentUID() });
	};

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

	document.getElementById('createRoomSubmit').onclick = function (event) {
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
				stopCurrentSession();
				socket.emit('createRoom', { gameId: getCurrentUID(), settingsString, roomSize });
				break;
			case 'set':
				socket.emit('changeSettings', getCurrentUID(), settingsString, roomSize);

				// Close the CPU options menu
				document.getElementById('createRoomModal').style.display = 'none';
				modal.style.display = 'none';
				break;
		}
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
		}
	};

	// Custom - Join Room
	document.getElementById('joinRoom').onclick = () => {
		modal.style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'block';
	};

	document.getElementById('joinIdForm').onsubmit = function (event) {
		// Prevent submit button from refreshing the page
		event.preventDefault();
		const joinId = document.getElementById('joinId').value;

		stopCurrentSession();

		socket.emit('joinRoom', { gameId: getCurrentUID(), joinId });
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
	};

	// Received when attempting to spectate an invalid room
	socket.on('spectateFailure', errMessage => {
		const spectateFormError = document.getElementById('spectateFormError');

		spectateFormError.innerHTML = errMessage;
		spectateFormError.style.display = 'block';
	});

	// Singleplayer Panel
	const aiDropdown = document.createElement('select');
	aiDropdown.classList.add('aiOption');

	Cpu.getAllCpuNames().forEach(cpuName => {
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

	document.getElementById('gallery').onclick = async function() {
		stopCurrentSession();
		// Leave the room
		socket.emit('forceDisconnect');

		const stats = await PlayerInfo.getUserProperty(getCurrentUID(), 'stats');
		// Need to stringify object before storing, otherwise the data will not be stored correctly
		window.localStorage.setItem('stats', JSON.stringify(stats));

		// Redirect to gallery subdirectory
		window.location.assign('/gallery');
	};

	// Profile Panel - Settings
	document.getElementById('settings').onclick = function() {
		stopCurrentSession();

		modal.style.display = 'block';

		// Use saved settings
		Array.from(document.getElementsByClassName('keyBinding')).forEach(button => {
			button.value = codeToDisplay(keyBindings[button.id.replace('Binding', '')]);
		});

		document.getElementById('settingsModal').style.display = 'block';
	};

	// Attach onclick events for each key binding
	Array.from(document.getElementsByClassName('keyBinding')).forEach(button => {
		button.onclick = function() {
			button.value = '...';
			keyBindingRegistration = button.id;
		};
	});

	// Attach onclick events for each icon
	Array.from(document.getElementsByClassName('appearanceIcon')).forEach(icon => {
		icon.onclick = function() {
			// Remove selection from previous icon
			document.getElementById(selectedAppearance).classList.remove('selected');

			// Add newly selected icon
			icon.classList.add('selected');
			selectedAppearance = icon.id;
		};
	});

	document.getElementById('settingsSubmit').onclick = async function() {
		const userSettings = await PlayerInfo.getUserProperty(getCurrentUID(), 'userSettings');

		const das = Number(document.getElementById('das').value);
		if(!Number.isNaN(das) && das >= 0) {
			userSettings['das'] = das;
		}

		const arr = Number(document.getElementById('arr').value);
		if(!Number.isNaN(arr) && arr >= 0) {
			userSettings['arr'] = arr;
		}

		// Ranges from 0 to 50, default 50 - map to 50 to 0
		const skipFrames = Number(document.getElementById('skipFrames').value);
		if(!Number.isNaN(skipFrames)) {
			userSettings['skipFrames'] = 50 - Math.floor(skipFrames);
		}

		// Ranges from 0 to 100, default 50
		const sfxVolume = Number(document.getElementById('sfxVolume').value);
		if(!Number.isNaN(sfxVolume)) {
			userSettings['sfxVolume'] = (sfxVolume / 100)**2 * 0.4;
		}

		// Ranges from 0 to 100, default 50
		const musicVolume = Number(document.getElementById('musicVolume').value);
		if(!Number.isNaN(musicVolume)) {
			userSettings['musicVolume'] = (musicVolume / 100)**2 * 0.4;
		}

		userSettings['keyBindings'] = keyBindings;
		userSettings['appearance'] = selectedAppearance;

		// Update the values
		PlayerInfo.updateUser(getCurrentUID(), 'userSettings', userSettings);

		// Modal is not auto-cleared since a game does not start as a result
		clearModal();
	};

	// User Panel - Log Out
	document.getElementById('logout').onclick = function() {
		socket.emit('forceDisconnect', getCurrentUID());
		socket.emit('unlinkUser');
		signOut();
	};
	return new Promise(resolve => resolve());
}

/**
 * Removes all modal elements from view.
 */
function clearModal() {
	// Prevent closing modal boxes if any dialog box has not been closed yet
	if(document.getElementById('modal-background-disable').style.display === 'block') {
		return;
	}

	const modal = document.getElementById('modal-background');
	modal.style.display = "none";

	// Clear all modal content
	Array.from(document.getElementsByClassName('modal-content')).forEach(element => {
		element.style.display = 'none';
	});

	// Clear all error messages
	Array.from(document.getElementsByClassName('errorMsg')).forEach(element => {
		element.style.display = 'none';
	});
}

/**
 * Updates the user settings panel with information from the database.
 * Only called once on login, since any changes within a session will be saved by the browser.
 */
function updateUserSettings(userSettings) {
	// These settings can be easily updated since they only contain a numeric value.
	const numericProperties = ['das', 'arr'];
	numericProperties.forEach(property => {
		document.getElementById(property).value = userSettings[property];
	});

	// Intermediate Frames Shown is inverted
	document.getElementById('skipFrames').value = 50 - userSettings.skipFrames;

	// Volume controls are non-linear
	document.getElementById('sfxVolume').value = 100 * Math.sqrt(userSettings.sfxVolume / 0.4);
	document.getElementById('musicVolume').value = 100 * Math.sqrt(userSettings.sfxVolume / 0.4);

	// Update the key bindings
	Object.keys(userSettings.keyBindings).forEach(key => {
		document.getElementById(`${key}Binding`).value = keyBindings[key];
	});
	keyBindings = userSettings.keyBindings;

	// Update the selected appearance
	document.getElementById(selectedAppearance).classList.remove('selected');
	document.getElementById(userSettings.appearance).classList.add('selected');
	selectedAppearance = userSettings.appearance;
}

function setCreateRoomTrigger(trigger) {
	createRoomTrigger = trigger;
}



module.exports = {
	puyoImgs,
	panelsInit,
	clearModal,
	updateUserSettings,
	setCreateRoomTrigger
};
