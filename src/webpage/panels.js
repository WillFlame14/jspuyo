'use strict';


const { PlayerInfo } = require('./firebase.js');
const { initCustomPanels } = require('./panels_custom.js');
const { setKeyBindings, setAppearance, initProfilePanels } = require('./panels_profile.js');

const puyoImgs = ['puyo_red', 'puyo_blue', 'puyo_green', 'puyo_yellow', 'puyo_purple', 'puyo_teal'];
const ranks = {
	'0': 'Blob',
	'1000': 'Forest Learner',
	'1250': 'Ocean Diver',
	'1500': 'Waterfall Fighter',
	'1750': 'Lightning Ranger'
};

async function panelsInit(socket, getCurrentUID, stopCurrentSession, audioPlayer) {
	// The black overlay that appears when a modal box is shown
	const modal = document.getElementById('modal-background');

	// Set all close buttons to remove modals
	Array.from(document.getElementsByClassName('close')).forEach(close => {
		close.onclick = () => {
			clearModal();
			audioPlayer.playSfx('close_modal');
		};
	});

	// Manage window onclick
	window.onclick = function(event) {
		if (event.target === modal) {
			clearModal();
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
	document.getElementById('freeForAll').onclick = async () => {
		await stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Free For All';
		socket.emit('freeForAll', { gameId: getCurrentUID() });
	};
	document.getElementById('ranked').onclick = async () => {
		await stopCurrentSession();
		document.getElementById('statusGamemode').innerHTML = 'Ranked';
		socket.emit('ranked', { gameId: getCurrentUID() });
	};

	const promises = [
		initCustomPanels(puyoImgs, stopCurrentSession, socket, audioPlayer, getCurrentUID),
		initProfilePanels(clearModal, socket, audioPlayer, stopCurrentSession, getCurrentUID)
	];

	await Promise.all(promises);

	return Promise.resolve();
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
async function updateUserSettings(user, currentUID, globalAudioPlayer) {
	const promises = [];
	promises.push(PlayerInfo.getUserProperty(currentUID, 'userSettings'));
	promises.push(PlayerInfo.getUserProperty(currentUID, 'rating'));

	const [userSettings, rating] = await Promise.all(promises);

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
	globalAudioPlayer.configureVolume(userSettings.sfxVolume, userSettings.musicVolume);

	// Update the key bindings
	const keyBindings = userSettings.keyBindings;
	Object.keys(keyBindings).forEach(key => {
		document.getElementById(`${key}Binding`).value = keyBindings[key];
	});
	setKeyBindings(keyBindings);

	// Update the selected appearance
	document.getElementById(userSettings.appearance).classList.add('selected');
	setAppearance(userSettings.appearance);

	// Update the status bar
	document.getElementById(`${userSettings.voice}Voice`).classList.add('selected');
	document.getElementById('statusName').innerHTML = user.displayName;

	document.getElementById('statusRating').innerHTML = `Rating: ${rating}`;

	const rankBoundaries = Object.keys(ranks);
	const title = ranks[rankBoundaries[rankBoundaries.findIndex(minimumRating => Number(minimumRating) > rating) - 1]];
	document.getElementById('statusTitle').innerHTML = title;
}

module.exports = {
	puyoImgs,
	panelsInit,
	clearModal,
	updateUserSettings
};
