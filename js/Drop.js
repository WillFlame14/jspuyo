'use strict';

const { getRandomColour } = require('./Utils');

function getNewDrop(gamemode = 'Tsu', dropset, position) {
	let shape, colours = [];
	if(gamemode === 'Tsu') {
		shape = 'I';
	}
	else {
		shape = dropset[position];
	}
	for(let i = 0; i < getSizeFromShape(shape); i++) {
		colours.push(getRandomColour());
	}
	return new Drop(shape, colours);
}

function getSizeFromShape(shape) {
	switch(shape) {
		case 'I':
			return 2;
		case 'L':
			return 3;
		case 'H':
		case 'O':
			return 4;
	}
}

const positions = [ 'Up', 'Right', 'Down', 'Left', 'Up' ];

class Drop {

	constructor (shape, colours) {
		this.shape = shape;
		this.position = 'Up';
		this.colours = colours;
		this.pos_x = 2;
		this.pos_y = 11;
	}

	shiftLeft() {
		if(this.pos_x > 0.5) {
			this.pos_x = this.pos_x - 1;
		}
	}

	shiftRight() {
		if(this.pos_x < this.width - 0.5) {
			this.pos_x++;
		}
	}

	rotateCW() {
		this.colours.push(this.colours.shift());
		this.position = positions[positions.indexOf(this.position) + 1];
		this.adjustPosition(true);
	}

	rotateCCW() {
		this.colours.unshift(this.colours.pop());
		this.position = positions[positions.lastIndexOf(this.position) - 1];
		this.adjustPosition(false);
	}

	// TODO: fix rotating against the wall, also half Y coordinate
	adjustPosition(clockwise) {
		const multiplier = clockwise ? 1 : -1;
		switch(this.position) {
			case 'Up':
			case 'Right':
				this.pos_x += multiplier * 0.5;
				break;
			case 'Down':
			case 'Left':
				this.pos_x -= multiplier * 0.5;
				break;
		}
	}
}

module.exports = { getNewDrop };