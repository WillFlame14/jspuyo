'use strict';

let currentlyExpanded = null;
const heights = {
	"queuePanel": 2,
	"customPanel": 3,
	"singleplayerPanel": 3,
	"profilePanel": 2
}

function expand_dropdown(id) {
	if(currentlyExpanded === id) {
		document.getElementById(id).classList.remove('expanded');
		document.getElementById(id).style.height = "81";
		currentlyExpanded = null;
	}
	else {
		document.getElementById(id).style.height = `${80 + heights[id] * 40}`;
		document.getElementById(id).classList.add('expanded');
		if(currentlyExpanded !== null) {
			document.getElementById(currentlyExpanded).classList.remove('expanded');
			document.getElementById(currentlyExpanded).style.height = "81";
		}
		currentlyExpanded = id;
	}
}