'use strict';

window.Drop = class Drop {
	constructor (shape, colours, settings, arle = { x: 2, y: 13 }, standardAngle = 0, rotating = 'not') {
		this.shape = shape;
		this.colours = colours;
		this.settings = settings;
		this.arle = arle;
		this.standardAngle = standardAngle;
		this.rotating = rotating;

		this.rotating180 = 0;
	}

	static getNewDrop(gamemode, settings) {
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

		const getPuyosFromShape = function (shape) {
			const first_col = window.getRandomColour();
			const second_col = window.getRandomColour();
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
		return new window.Drop(shape, getPuyosFromShape(shape), settings);
	}

	copy() {
		return new Drop(this.shape, this.colours, this.settings, this.arle, this.standardAngle, this.rotating);
	}

	// The below methods all assume that all validation has already been carried out.
	shift(direction) {
		switch(direction) {
			case 'Left':
				this.arle.x--;
				break;
			case 'Right':
				this.arle.x++;
				break;
			case 'Down':
				this.arle.y -= this.settings.softDrop;
				break;
		}
	}

	rotate(direction, angle) {
		if(angle === 180) {
			this.rotating180 = 2;
		}
		this.rotating = direction;
	}

	affectGravity(gravity) {
		this.arle.y -= gravity;
	}

	affectRotation() {
		let step;
		if(this.rotating == 'CW') {
			step = -Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else if(this.rotating == 'CCW') {
			step = Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else {
			return;
		}

		if(this.rotating180 > 0) {
			step *= 2;
		}

		this.standardAngle += step;

		// Remain within domain
		if(this.standardAngle >= 2 * Math.PI) {
			this.standardAngle -= 2 * Math.PI;
		}
		else if(this.standardAngle < 0) {
			this.standardAngle += 2 * Math.PI;
		}

		// Check if reached a right angle
		if(Math.round(this.standardAngle * 10000) % Math.round(Math.PI  * 5000) < 0.01) {
			if(this.rotating180 === 2) {
				this.rotating180 = 1;		// Finishing rotation
				return;
			}
			this.rotating = 'not';
			this.rotating180 = 0;			// Finished rotation
		}
	}

	finishRotation() {
		if(this.rotating === 'not') {
			return;
		}
		const cw = (this.rotating === 'CW');
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
