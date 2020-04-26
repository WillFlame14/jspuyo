'use strict';

let currentlyExpanded = null;	// The currently expanded panel's id
const dropdownItems = {			// Number of items in each dropdown menu
	"queuePanel": 2,
	"customPanel": 3,
	"singleplayerPanel": 3,
	"profilePanel": 2
}

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
		document.getElementById(id).querySelector('.dropdown').style.height = `${dropdownItems[id] * 40}`;
		document.getElementById(id).classList.add('expanded');
		if(currentlyExpanded !== null) {
			document.getElementById(currentlyExpanded).classList.remove('expanded');
			document.getElementById(currentlyExpanded).querySelector('.dropdown').style.height = "0";
		}
		currentlyExpanded = id;
	}
}