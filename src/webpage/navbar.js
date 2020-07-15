'use strict';

const panelDropdowns = {
	'queuePanel': ['freeForAll', 'ranked'],
	'customPanel': ['createRoom', 'joinRoom', 'spectate'],
	'singleplayerPanel': ['sprint', 'timeChallenge'],
	'profilePanel': ['settings', 'gallery', 'about']
};

let currentlyExpandedPanel = null;

async function navbarInit() {
	// Add onclick listener to each panel
	Object.keys(panelDropdowns).forEach(panelId => {
		document.getElementById(panelId).onclick = () => expand_dropdown(panelId);
	});

	return new Promise(resolve => resolve());
}

/**
 * Expands a dropdown menu and closes any other open dropdown menu.
 * If the current dropdown menu is already open, it is closed.
 */
function expand_dropdown(id) {
	const panels = Object.keys(panelDropdowns);
	const newPanel = document.getElementById(id);

	if(currentlyExpandedPanel === id) {
		newPanel.classList.remove('expanded');
		newPanel.querySelector('.dropdown').style.height = '0';
		currentlyExpandedPanel = null;
	}
	else {
		newPanel.querySelector('.dropdown').style.height = `${panelDropdowns[id].length * 40}`;
		newPanel.classList.add('expanded');
		newPanel.style.zIndex = '10';
		if(currentlyExpandedPanel !== null) {
			const oldPanel = document.getElementById(currentlyExpandedPanel);
			oldPanel.classList.remove('expanded');
			oldPanel.querySelector('.dropdown').style.height = '0';
		}
		currentlyExpandedPanel = id;
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

module.exports = navbarInit;
