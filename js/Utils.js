'use strict';

const colourList = [ 'Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Black' ];

function getRandomColour(numColours) {
	const colours = colourList.slice(0, numColours);
	
	return colours[Math.floor(Math.random() * 4)];
}

module.exports = { getRandomColour };