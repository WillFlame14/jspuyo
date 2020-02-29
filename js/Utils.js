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
	constructor(gravity = 0.02, lockDelay = 0.5, softDrop = 0.2) {
		this.gravity = gravity;
		this.lockDelay = lockDelay;
		this.softDrop = softDrop;
	}
}

function getRandomColour(numColours = 4) {
	const colours = COLOUR_LIST.slice(0, numColours);
	
	return PUYO_COLOURS[colours[Math.floor(Math.random() * 4)]];
}

function getOtherPuyo(drop) {
	let x = drop.arle.x + Math.cos(drop.standardAngle - Math.PI / 2);
	let y = drop.arle.y + Math.sin(drop.standardAngle - Math.PI / 2);

	if(Math.abs(x - Math.round(x)) < 0.001) {
		x = Math.round(x);
	}

	if(Math.abs(y - Math.round(y)) < 0.001) {
		y = Math.round(y);
	}
	return { x, y };
}
