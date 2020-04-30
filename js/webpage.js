'use strict';

let currentlyExpanded = null;	// The currently expanded panel's id

// Panels and the number of items in their dropdown menu
const panelDropdowns = {
	'queuePanel': ['freeForAll', 'ranked'],
	'customPanel': ['createRoom', 'joinRoom', 'spectate'],
	'singleplayerPanel': ['sprint', 'timeChallenge', 'cpu'],
	'profilePanel': ['settings', 'gallery']
};

/**
 * Expands a dropdown menu and closes any other open dropdown menu.
 * If the current dropdown menu is already open, it is closed.
 */
function expand_dropdown(id) {
	const panels = Object.keys(panelDropdowns);

	if(currentlyExpanded === id) {
		document.getElementById(id).classList.remove('expanded');
		document.getElementById(id).querySelector('.dropdown').style.height = '0';
		currentlyExpanded = null;
	}
	else {
		document.getElementById(id).querySelector('.dropdown').style.height = `${panelDropdowns[id].length * 40}`;
		document.getElementById(id).classList.add('expanded');
		document.getElementById(id).style.zIndex = '10';
		if(currentlyExpanded !== null) {
			document.getElementById(currentlyExpanded).classList.remove('expanded');
			document.getElementById(currentlyExpanded).querySelector('.dropdown').style.height = '0';
		}
		currentlyExpanded = id;
	}

	// Then set the z-index for each panel on selection for nice shadow cascading.
	let indexes;
	switch(id) {
		case panels[0]:
			indexes = [6, 5, 4, 3];
			break;
		case panels[1]:
			indexes = [5, 6, 4, 3];
			break;
		case panels[2]:
			indexes = [3, 4, 6, 5];
			break;
		case panels[3]:
			indexes = [3, 4, 5, 6];
			break;
	}
	panels.forEach((panel, i) => {
		document.getElementById(panel).style.zIndex = indexes[i];
	});
}

/**
 * Initialize all the functions for webpage elements that require Javascript.
 */
function init() {
	// Add onclick listener to each panel
	Object.keys(panelDropdowns).forEach(panelId => {
		document.getElementById(panelId).onclick = () => expand_dropdown(panelId);
	});

	const homeAddress = window.location.toString().replace(location.search, '');

	// Queue Panel
	document.getElementById('freeForAll').href = homeAddress;
	document.getElementById('ranked').href = homeAddress + '?ranked=true';

	// Custom Panel
	document.getElementById('createRoom').href = homeAddress + '?createRoom=true'
	const modal = Array.from(document.getElementsByClassName('modal'))[0];
	document.getElementById('joinRoom').onclick = () => modal.style.display = 'block';

	Array.from(document.getElementsByClassName('close')).forEach(close => {
		close.onclick = () => modal.style.display = 'none';
	})

	window.onclick = function(event) {
		if (event.target == modal) {
			modal.style.display = "none";

			// Clear all error messages
			Array.from(document.getElementsByClassName('errorMsg')).forEach(element => {
				element.style.display = 'none';
			});
		}
	}

	document.getElementById('joinIdForm').onsubmit = function (event) {
		event.preventDefault();
		const value = document.getElementById('joinId').value;
		if(value.length !== 6) {
			document.getElementById('joinIdFormError').innerHTML = 'Invalid id. Please try again.';
			document.getElementById('joinIdFormError').style.display = 'block';
			return false;
		}
		window.location.replace(homeAddress + '?joinRoom=' + value);
		document.getElementById('joinIdFormError').style.display = 'none';
	}

	// Singleplayer Panel
	document.getElementById('cpu').href = homeAddress + '?cpu=true';
}

module.exports = init;
