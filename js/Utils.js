'use strict';

const COLOUR_LIST = [ 'Red', 'Blue', 'Green','Purple', 'Yellow' ];
const PUYO_COLOURS = ['rgba(200, 20, 20, 0.9)',
					  'rgba(20, 200, 20, 0.9)',
					  'rgba(20, 20, 200, 0.9)',
					  'rgba(150, 150, 20, 0.9)',
					  'rgba(150, 20, 150, 0.9)'];
const PUYO_EYES_COLOUR = 'rgba(255, 255, 255, 0.7)';
const COLS = 6;
const ROWS = 12;

class Settings {
	constructor(gravity, lockDelay) {
		this.gravity = gravity;
		this.lockDelay = lockDelay;
	}
}

function getRandomColour(numColours) {
	const colours = COLOUR_LIST.slice(0, numColours);
	
	return colours[Math.floor(Math.random() * 4)];
}
