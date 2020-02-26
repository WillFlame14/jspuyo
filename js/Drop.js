'use strict';

const GRAVITY = 0.1;

function getNewDrop(gamemode = 'Tsu', dropset, orientation) {
	let shape, colours = [];
	if(gamemode === 'Tsu') {
		shape = 'I';
	}
	else {
		shape = dropset[orientation];
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

const orientations = [ 'Up', 'Right', 'Down', 'Left', 'Up' ];

class Drop {

	constructor (shape, colours) {
		this.shape = shape;
		this.orientation = 'Up';
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
		if(this.pos_x < COLS - 0.5) {
			this.pos_x++;
		}
	}

	rotateCW() {
		this.colours.push(this.colours.shift());
		this.orientation = orientations[orientations.indexOf(this.orientation) + 1];
		this.adjustOrientation(true);
	}

	rotateCCW() {
		this.colours.unshift(this.colours.pop());
		this.orientation = orientations[orientations.lastIndexOf(this.orientation) - 1];
		this.adjustOrientation(false);
	}

	// TODO: fix rotating against the wall, also half Y coordinate
	adjustOrientation(clockwise) {
		const multiplier = clockwise ? 1 : -1;
		switch(this.orientation) {
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

	affectGravity(gravity) {
		this.pos_y -= gravity;
	}

	convert() {
		let droppingX, droppingY;
		switch(this.orientation) {
			case 'Up':
				droppingX = [this.pos_x + 0.5, this.pos_x + 0.5];
				droppingY = [this.pos_y, this.pos_y + 1];
				break;
			case 'Down':
				droppingX = [this.pos_x + 0.5, this.pos_x + 0.5];
				droppingY = [this.pos_y - 1, this.pos_y];
				break;
			case 'Right':
				droppingX = [this.pos_x, this.pos_x + 1];
				droppingY = [this.pos_y + 0.5, this.pos_y + 0.5];
				break;
			case 'Left':
				droppingX = [this.pos_x - 1, this.pos_x];
				droppingY = [this.pos_y + 0.5, this.pos_y + 0.5];
				break;
		}
		return { droppingX, droppingY };
	}
}
