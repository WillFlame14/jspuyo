'use strict';

const { Cpu } = require('../Cpu.js');
const { Utils, SettingsBuilder } = require('../Utils.js');

const puyoImgs = ['puyo_red', 'puyo_blue', 'puyo_green', 'puyo_yellow', 'puyo_purple', 'puyo_teal'];
const winConditions = ['FT 3', 'FT 5', 'FT 7'];

const createRoomOptionsState = {
	selectedMode: 'Tsu',
	selectedPlayers: '4player',
	numColours: 4,
	winCondition: 'FT 3'
};
let createRoomTrigger = null;
let cpuRoomSettings = null;

let selectedAppearance = 'TsuClassic';
let keyBindingRegistration = null;
const keyBindings = {
	moveLeft: 'ArrowLeft',
	moveRight: 'ArrowRight',
	rotateCCW: 'KeyZ',
	rotateCW: 'KeyX',
	softDrop: 'ArrowDown',
	hardDrop: 'ArrowUp'
};

function panelsInit(playerInfo, stopCurrentSession) {
	const { socket, gameId, userSettings } = playerInfo;

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
		socket.emit('freeForAll', { gameId });
	};
	document.getElementById('ranked').onclick = () => {
		stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Ranked';
		socket.emit('ranked', { gameId });
	};

	// Custom - Create Room
	document.getElementById('createRoom').onclick = () => {
		stopCurrentSession();

		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomSubmit').value = 'Create Room';

		createRoomTrigger = 'custom';
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
			if(element.id !== oldId) {
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
			case 'custom':
				socket.emit('createRoom', { gameId, settingsString, roomSize });
				break;
			case 'cpu':
				// Save the selected settings
				cpuRoomSettings = { settingsString, roomSize };

				// Close the Room Options menu
				document.getElementById('createRoomModal').style.display = 'none';

				// Open the CPU Options menu
				document.getElementById('cpuOptionsModal').style.display = 'block';

				// Clear all the cpu options
				for(let i = 0; i < 6; i++) {
					document.getElementById('cpu' + (i + 1)).style.display = 'none';
				}

				// Add only the ones that are needed (minus one since the player doesn't count)
				for(let i = 0; i < roomSize - 1; i++) {
					document.getElementById('cpu' + (i + 1)).style.display = 'grid';
				}
				break;
		}
		createRoomTrigger = null;
	};

	// Back button between Room Options and CPU Options
	document.getElementById('cpu-back').onclick = () => {
		// Close the Cpu Options menu
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomOptions').style.display = 'grid';

		// Open the Room Options menu
		document.getElementById('cpuOptionsModal').style.display = 'none';
		document.getElementById('cpuOptions').style.display = 'none';

		// Tell the submit button to go to CPU Options next
		createRoomTrigger = 'cpu';
	};

	// Receiving the id of the newly created room
	socket.on('giveRoomId', id => {
		// Hide the "Copied" message
		document.getElementById('joinIdCopied').style.display = 'none';

		modal.style.display = 'block';
		document.getElementById('giveJoinId').style.display = 'block';
		document.getElementById('joinIdLink').value = `${window.location}?joinRoom=${id}`;
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

		socket.emit('joinRoom', { gameId, joinId });
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

	// Custom - Spectate
	document.getElementById('spectate').onclick = () => {
		stopCurrentSession();
		socket.emit('getAllRooms');

		modal.style.display = 'block';
		document.getElementById('spectateRoomModal').style.display = 'block';
	};

	socket.on('allRooms', roomIds => {
		const roomList = document.getElementById('roomList');
		const noRoomsMsg = document.getElementById('spectateFormError');
		const spectateSubmit = document.getElementById('spectateSubmit');

		while(roomList.firstChild) {
			roomList.firstChild.remove();
		}

		// Add all the room ids to the dropdown menu
		roomIds.forEach(id => {
			const option = document.createElement('option');
			option.value = id;
			option.innerHTML = id;
			roomList.appendChild(option);
		});

		if(roomIds.length === 0) {
			roomList.style.display = 'none';
			noRoomsMsg.style.display = 'block';
			if(!spectateSubmit.classList.contains('disable')) {
				spectateSubmit.classList.add('disable');
			}
			spectateSubmit.disabled = true;
		}
		else {
			roomList.style.display = 'inline-block';
			noRoomsMsg.style.display = 'none';
			if(spectateSubmit.classList.contains('disable')) {
				spectateSubmit.classList.remove('disable');
			}
			spectateSubmit.disabled = false;
		}
	});

	document.getElementById('spectateForm').onsubmit = event => {
		event.preventDefault();
		const roomList = document.getElementById('roomList');
		const roomId = roomList.options[roomList.selectedIndex].value;

		// Input field for room id instead?

		socket.emit('spectate', { gameId, roomId });
	};

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

	document.getElementById('cpu').onclick = function() {
		stopCurrentSession();

		// Open the Room Options menu
		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomOptions').style.display = 'grid';
		document.getElementById('createRoomSubmit').value = 'Select CPUs';

		// Flag to indicate that these room options are for a CPU game
		createRoomTrigger = 'cpu';
	};

	document.getElementById('cpuOptionsSubmit').onclick = function() {
		const { roomSize, settingsString } = cpuRoomSettings;

		const cpus = [];

		document.querySelectorAll('.aiOption').forEach(dropdown => {
			cpus.push({ id: null, ai: dropdown.options[dropdown.selectedIndex].value });
		});

		document.querySelectorAll('.cpuSpeedSlider').forEach((slider, index) => {
			// slider value is between 0 and 10, map to between 5000 and 0
			cpus[index].speed = (10 - slider.value) * 500;
		});

		socket.emit('cpuMatch', { gameId, roomSize, settingsString, cpus });

		cpuRoomSettings = null;
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

	document.getElementById('settingsSubmit').onclick = function() {
		const das = Number(document.getElementById('das').value);
		if(!Number.isNaN(das) && das >= 0) {
			userSettings.set('das', das);
		}

		const arr = Number(document.getElementById('arr').value);
		if(!Number.isNaN(arr) && arr >= 0) {
			userSettings.set('arr', arr);
		}

		// Ranges from 0 to 50, default 50 - map to 50 to 0
		const skipFrames = Number(document.getElementById('skipFrames').value);
		if(!Number.isNaN(skipFrames)) {
			userSettings.set('skipFrames', 50 - Math.floor(skipFrames));
		}

		// Ranges from 0 to 100, default 50
		const sfxVolume = Number(document.getElementById('sfxVolume').value);
		if(!Number.isNaN(sfxVolume)) {
			userSettings.set('sfxVolume', (sfxVolume / 100)**2 * 0.4);
		}

		// Ranges from 0 to 100, default 50
		const musicVolume = Number(document.getElementById('musicVolume').value);
		if(!Number.isNaN(musicVolume)) {
			userSettings.set('musicVolume', (musicVolume / 100)**2 * 0.4);
		}

		userSettings.set('keyBindings', keyBindings);
		userSettings.set('appearance', selectedAppearance);

		// Modal is not auto-cleared since a game does not start as a result
		clearModal();
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

module.exports = {
	puyoImgs,
	panelsInit,
	clearModal
};
