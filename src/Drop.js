'use strict';

const { Utils } = require('./Utils.js');

class Drop {
	constructor (shape, colours, settings, arle, schezo = { x: null, y: null }, standardAngle = 0, rotating = 'not') {
		this.shape = shape;
		this.colours = colours;
		this.settings = settings;
		this.arle = arle || { x: 2, y: this.settings.rows + 0.5 };
		this.schezo = schezo;
		this.standardAngle = standardAngle;
		this.rotating = rotating;

		// Special counter to determine the stage of 180 rotation. 2 is 'first half', 1 is 'second half', 0 is 'not'.
		this.rotating180 = 0;
	}

	/**
	 * Returns a new, random drop determined by the gamemode and the player's dropset.
	 */
	static getNewDrop(settings, colours) {
		let shape;
		if(settings.gamemode === 'Tsu') {
			shape = 'I';
		}
		else {
			// Get the shape from the dropset
			shape = settings.dropset[settings.dropset_position];
			settings.dropset_position++;

			// Check if the end of the dropset has been reached
			if(settings.dropset_position === settings.dropset.length - 1) {
				settings.dropset_position = 1;
			}
		}

		// Generate array of colours based on the shape of the drop
		let puyos;
		const first_col = (colours && colours[0]) || Utils.getRandomColour(settings.numColours);
		const second_col = (colours && colours[1]) || Utils.getRandomColour(settings.numColours);

		switch(shape) {
			case 'I':
				puyos = [first_col, second_col];
				break;
			case 'h':
				puyos = [first_col, first_col, second_col];
				break;
			case 'L':
				puyos = [first_col, second_col, second_col];
				break;
			case 'H':
				puyos = [first_col, first_col, second_col, second_col];
				break;
			case 'O':
				puyos = [first_col, first_col, first_col, first_col];
				break;
		}

		return new Drop(shape, puyos, settings);
	}

	/**
	 * Returns a new, identical Drop.
	 *
	 * NOTE: The settings object only uses a shallow copy.
	 * However, it should not be able to be modified during a game.
	 */
	copy() {
		return new Drop(
			this.shape,
			this.colours.slice(),
			this.settings,
			Utils.objectCopy(this.arle),
			Utils.objectCopy(this.schezo),
			this.standardAngle,
			this.rotating);
	}

	/**
	 * Moves a Drop. Validation is done before calling this method.
	 */
	shift(direction, amount = 1) {
		switch(direction) {
			case 'Left':
				this.arle.x -= amount;
				break;
			case 'Right':
				this.arle.x += amount;
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
		if(this.rotating === 'CW') {
			angleToRotate = -Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else if(this.rotating === 'CCW') {
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
		if(Math.round(this.standardAngle * 10000) % Math.round(Math.PI * 5000) < 0.01) {
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

class DropGenerator {
	constructor(settings) {
		this.settings = settings;
		this.seed = this.settings.seed;
		this.drops = [];
		this.colourList = [...Array(this.settings.numColours + 1).keys()].slice(1);
		this.colourBuckets = {};
		this.drops[0] = [];

		// Set up colourBuckets for the first batch of 128
		this.colourList.forEach(colour => {
			// Ceiling instead of flooring so that there will be leftover amounts instead of not enough
			this.colourBuckets[colour] = Math.ceil(128 / this.settings.numColours);
		});

		// Generate the 3 colours that will be used for the first 3 drops
		const firstColours = [];
		while(firstColours.length < 3) {
			const colour = this.colourList[Math.floor(this.randomNumber() * this.colourList.length)];
			if(!firstColours.includes(colour)) {
				firstColours.push(colour);
			}
		}

		// Only use the previously determined 3 colours for the first 3 drops
		for(let i = 0; i < 3; i++) {
			const colours = [
				firstColours[Math.floor(this.randomNumber() * 3)],
				firstColours[Math.floor(this.randomNumber() * 3)]
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;
			this.drops[0].push(Drop.getNewDrop(this.settings, colours));
		}

		for(let i = 3; i < 128; i++) {
			// Filter out colours that have been completely used up
			const tempColourList = Object.keys(this.colourBuckets).filter(colour => this.colourBuckets[colour] > 0);
			const colours = [
				Number(tempColourList[Math.floor(this.randomNumber() * tempColourList.length)]),
				Number(tempColourList[Math.floor(this.randomNumber() * tempColourList.length)])
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;

			this.drops[0].push(Drop.getNewDrop(this.settings, colours));
		}
	}

	/**
	 * Called when a queue is running low on drops so that a new batch is generated.
	 */
	requestDrops(index) {
		if(this.drops[index + 1] === undefined) {
			this.drops[index + 1] = [];

			// Reset colourBuckets for the next batch of 128
			this.colourList.forEach(colour => {
				// Ceiling instead of flooring so that there will be leftover amounts instead of not enough
				this.colourBuckets[colour] = Math.ceil(128 / this.settings.numColours);
			});

			for(let i = 0; i < 128; i++) {
				// Filter out colours that have been completely used up
				const colourList = Object.keys(this.colourBuckets).filter(colour => this.colourBuckets[colour] > 0);
				const colours = [
					Number(colourList[Math.floor(this.randomNumber() * colourList.length)]),
					Number(colourList[Math.floor(this.randomNumber() * colourList.length)])
				];
				this.colourBuckets[colours[0]]--;
				this.colourBuckets[colours[1]]--;

				this.drops[index + 1].push(Drop.getNewDrop(this.settings, colours));
			}
		}
		return this.drops[index];
	}

	/**
	 * Seeded RNG so that each game's drop generator always creates the same drops
	 */
	randomNumber() {
		const x = Math.sin(this.seed++) * 10000;
		return x - Math.floor(x);
	}
}

module.exports = { Drop, DropGenerator };
