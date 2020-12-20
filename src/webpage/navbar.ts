'use strict';

import { AudioPlayer } from '../utils/AudioPlayer';

const panelDropdowns: Record<string, string[]> = {
	'queuePanel': ['freeForAll', 'ranked'],
	'customPanel': ['createRoom', 'joinRoom', 'spectate'],
	'singleplayerPanel': ['sprint', 'timeChallenge', 'guide'],
	'profilePanel': ['settings', 'gallery', 'logout']
};

let currentlyExpandedPanel = null;
let audioPlayer: AudioPlayer;

export function navbarInit(globalAudioPlayer: AudioPlayer): void {
	audioPlayer = globalAudioPlayer;

	// Add onclick listener to each panel
	Object.keys(panelDropdowns).forEach(panelId => {
		document.getElementById(panelId).onclick = () => expand_dropdown(panelId);
	});

	// Add 'hover' sfx to all the dropdown options
	document.querySelectorAll('.dropdown').forEach(dropdown => {
		dropdown.querySelectorAll('a').forEach(option => {
			option.onmouseover = () => {
				audioPlayer.playSfx('hover_option', 0);
			};
		});
	});
}

/**
 * Expands a dropdown menu and closes any other open dropdown menu.
 * If the current dropdown menu is already open, it is closed.
 */
function expand_dropdown(id: string) {
	const panels = Object.keys(panelDropdowns);
	const newPanel = document.getElementById(id);

	if(currentlyExpandedPanel === id) {
		newPanel.classList.remove('expanded');
		const element: HTMLDivElement | null = newPanel.querySelector('.dropdown');
		element.style.height = '0';

		currentlyExpandedPanel = null;
		audioPlayer.playSfx('close_panel');
	}
	else {
		const element: HTMLDivElement | null = newPanel.querySelector('.dropdown');
		element.style.height = `${panelDropdowns[id].length * 40}`;
		newPanel.classList.add('expanded');
		newPanel.style.zIndex = '10';
		if(currentlyExpandedPanel !== null) {
			const oldPanel = document.getElementById(currentlyExpandedPanel);
			oldPanel.classList.remove('expanded');

			const dropdown: HTMLDivElement | null = oldPanel.querySelector('.dropdown');
			dropdown.style.height = '0';
		}
		currentlyExpandedPanel = id;
		audioPlayer.playSfx('open_panel');
	}

	// Then set the z-index for each panel on selection for nice shadow cascading.
	let indexes: number[];
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
		document.getElementById(panel).style.zIndex = `${indexes[i]}`;
	});
}
