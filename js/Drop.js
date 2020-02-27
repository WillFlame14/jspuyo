'use strict';

const FRAMES_PER_ROTATION = 15;

function getNewDrop(gamemode, settings) {
	let shape;
	if(gamemode === 'Tsu') {
		shape = 'I';
	}
	else {
		shape = settings.dropset[settings.dropset_position];
		settings.dropset_position++;
		if(settings.dropset_position == 17) {
			settings.dropset_position = 1;
		}
	}
	return new Drop(shape, getPuyosFromShape(shape));
}

function getPuyosFromShape(shape) {
	const first_col = getRandomColour();
	const second_col = getRandomColour();
	switch(shape) {
		case 'I':
			return [first_col, second_col];
		case 'h':
			return [first_col, first_col, second_col];
		case 'L':
			return [first_col, second_col, second_col];
		case 'H':
			return [first_col, first_col, second_col, second_col];
		case 'O':
			return [first_col, first_col, first_col, first_col];
	}
}

class Drop {
	constructor (shape, colours) {
		this.shape = shape;
		this.arle = { x: 2, y: 13 };
		this.colours = colours;
		this.standardAngle = 0;
		this.rotating = 'not';
	}

	// The below methods all assume that all validation has already been carried out.
	shiftLeft() {
		this.arle.x--;
	}

	shiftRight() {
		this.arle.x++;
	}

	rotateCW() {
		this.rotating = 'CW';
	}

	rotateCCW() {
		this.rotating = 'CCW';
	}

	affectGravity(gravity) {
		this.arle.y -= gravity;
	}

	affectRotation() {
		if(this.rotating == 'CW') {
			this.standardAngle -= Math.PI / 2 / FRAMES_PER_ROTATION;
		}
		else if(this.rotating == 'CCW') {
			this.standardAngle += Math.PI / 2 / FRAMES_PER_ROTATION;
		}
		else {
			return;
		}

		// Remain within domain
		if(this.standardAngle >= 2 * Math.PI) {
			this.standardAngle -= 2 * Math.PI;
		}
		else if(this.standardAngle < 0) {
			this.standardAngle += 2 * Math.PI;
		}

		// Check if reached a right angle
		if(this.standardAngle % (Math.PI / 2) < 0.00001) {
			this.rotating = 'not';
		}
	}

	finishRotation() {
		if(this.rotating == 'not') {
			return;
		}
		const cw = this.rotating == 'CW';
		if(this.standardAngle < Math.PI / 2) {
			this.standardAngle = cw ? 0 : Math.PI / 2;
		}
		else if(this.standardAngle < Math.PI) {
			this.standardAngle = cw ? Math.PI / 2 : Math.PI;
		}
		else if(this.standardAngle < 3/2 * Math.PI) {
			this.standardAngle = cw ? Math.PI / 2: 3 * Math.PI / 2;
		}
		else {
			this.standardAngle = cw ? 3/2 * Math.PI : 0;
		}
	}
}