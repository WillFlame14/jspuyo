'use strict';

window.Drop = class Drop {
	constructor (shape, colours, settings, arle = { x: 2, y: 11.5 }, schezo = { x: null, y: null }, standardAngle = 0, rotating = 'not') {
		this.shape = shape;
		this.colours = colours;
		this.settings = settings;
		this.arle = arle;
		this.schezo = schezo;
		this.standardAngle = standardAngle;
		this.rotating = rotating;

		// Special counter to determine the stage of 180 rotation. 2 is 'first half', 1 is 'second half', 0 is 'not'.
		this.rotating180 = 0;
	}

	/**
	 * Returns a new, random drop determined by the gamemode and the player's dropset.
	 */
	static getNewDrop(gamemode, settings) {
		let shape;
		if(gamemode === 'Tsu') {
			shape = 'I';
		}
		else {
			// Get the shape from the dropset
			shape = settings.dropset[settings.dropset_position];
			settings.dropset_position++;

			// Check if the end of the dropset has been reached
			if(settings.dropset_position == 17) {
				settings.dropset_position = 1;
			}
		}

		// Returns an array of colours based on the shape of the drop
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

	/**
	 * Returns a new, identical Drop.
	 */
	copy() {
		return new Drop(this.shape, this.colours, this.settings, this.arle, this.schezo, this.standardAngle, this.rotating);
	}

	/**
	 * Moves a Drop. Validation is done before calling this method.
	 */
	shift(direction, amount) {
		switch(direction) {
			case 'Left':
				this.arle.x--;
				break;
			case 'Right':
				this.arle.x++;
				break;
			case 'Down':
				this.arle.y -= this.settings.softDrop;
				if(this.arle.y < 0) {
					this.arle.y = 0;
				}
				break;
			case 'Up':
				this.arle.y += amount;
		}
	}

	/**
	 * Rotates a Drop. Validation is done before calling this method.
	 */
	rotate(direction, angle) {
		if(angle === 180) {
			this.rotating180 = 2;
		}
		this.rotating = direction;
	}

	/**
	 * Applies the effect of gravity to the Drop. Validation is done before calling this method.
	 */
	affectGravity() {
		this.arle.y -= this.settings.gravity;
	}

	/**
	 * Applies rotation, which is done on a frame-by-frame basis. Validation is done before calling this method.
	 * The arle's standard angle must be between 0 and 2*PI.
	 * The drop will stop rotating once its standard angle reaches an integer multiple of PI/2 radians (unless it is 180 rotating).
	 */
	affectRotation() {
		let angleToRotate;
		if(this.rotating == 'CW') {
			angleToRotate = -Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else if(this.rotating == 'CCW') {
			angleToRotate = Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else {
			// not rotating
			return;
		}

		if(this.rotating180 > 0) {
			angleToRotate *= 2;
		}

		this.standardAngle += angleToRotate;

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
				// Begin rotating the second set of PI/2 radians
				this.rotating180 = 1;
				return;
			}
			// Rotation has finished
			this.rotating = 'not';
			this.rotating180 = 0;
		}
	}

	/**
	 * Immediately finishes the rotation of a drop (if needed), instead of waiting the required number of frames.
	 * Called when the Drop is locked into place, as due to rotation it may be misaligned.
	 * This function snaps the Drop to the grid (if needed), making it easy to lock and add to the stack.
	 */
	finishRotation() {
		if(this.rotating === 'not') {
			return;
		}
		const cw = (this.rotating === 'CW');
		if(this.standardAngle < Math.PI / 2) {			// quadrant 1
			this.standardAngle = cw ? 0 : Math.PI/2;
		}
		else if(this.standardAngle < Math.PI) {			// quadrant 2
			this.standardAngle = cw ? Math.PI/2 : Math.PI;
		}
		else if(this.standardAngle < 3/2 * Math.PI) {	// quadrant 3
			this.standardAngle = cw ? Math.PI : 3/2 * Math.PI;
		}
		else {											// quadrant 4
			this.standardAngle = cw ? 3/2 * Math.PI : 0;
		}
	}
}
