'use strict';

let currentlyExpanded = null;	// The currently expanded panel's id

// Panels and the number of items in their dropdown menu
const panels = ["queuePanel", "customPanel", "singleplayerPanel", "profilePanel"];
const dropdownItems = [2, 3, 3, 2];

/**
 * Expands a dropdown menu and closes any other open dropdown menu.
 * If the current dropdown menu is already open, it is closed.
 */
function expand_dropdown(id) {
	if(currentlyExpanded === id) {
		document.getElementById(id).classList.remove('expanded');
		document.getElementById(id).querySelector('.dropdown').style.height = "0";
		currentlyExpanded = null;
	}
	else {
		document.getElementById(id).querySelector('.dropdown').style.height = `${dropdownItems[panels.indexOf(id)] * 40}`;
		document.getElementById(id).classList.add('expanded');
		document.getElementById(id).style.zIndex = "10";
		if(currentlyExpanded !== null) {
			document.getElementById(currentlyExpanded).classList.remove('expanded');
			document.getElementById(currentlyExpanded).querySelector('.dropdown').style.height = "0";
		}
		currentlyExpanded = id;
	}
	setZIndexes(id);
}

/**
 * Sets the z-index for each panel on selection for nice shadow cascading.
 */
function setZIndexes(id) {
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