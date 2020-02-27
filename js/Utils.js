'use strict';

const COLOUR_LIST = [ 'Red', 'Blue', 'Green','Purple', 'Yellow' ];
const PUYO_COLOURS = { 'Red': 'rgba(200, 20, 20, 0.9)',
					  'Green': 'rgba(20, 200, 20, 0.9)',
					  'Blue': 'rgba(20, 20, 200, 0.9)',
					  'Yellow': 'rgba(150, 150, 20, 0.9)',
					  'Purple': 'rgba(150, 20, 150, 0.9)' };
const PUYO_EYES_COLOUR = 'rgba(255, 255, 255, 0.7)';
const COLS = 6;
const ROWS = 12;

class Settings {
	constructor(gravity = 0.02, lockDelay = 0.5) {
		this.gravity = gravity;
		this.lockDelay = lockDelay;
	}
}

function getRandomColour(numColours = 4) {
	const colours = COLOUR_LIST.slice(0, numColours);
	
	return PUYO_COLOURS[colours[Math.floor(Math.random() * 4)]];
}

function getOtherPuyo(drop) {
	return { x: drop.arle.x + Math.cos(drop.standardAngle), y: drop.arle.x + Math.sin(drop.standardAngle)}
}
