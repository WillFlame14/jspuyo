'use strict';

class Settings {
	constructor(gamemode = 'Tsu', gravity = 0.036, rows = 12, cols = 6, softDrop = 0.375, numColours = 4,
				targetPoints = 70, marginTime = 96000, minChain = 0, seed = Math.random()) {		// eslint-disable-line indent
		this.gamemode = gamemode;			// Type of game that is being played
		this.gravity = gravity;				// Vertical distance the drop falls every frame naturally (without soft dropping)
		this.rows = rows;					// Number of rows in the game board
		this.cols = cols;					// Number of columns in the game board
		this.softDrop = softDrop;			// Additional vertical distance the drop falls when soft dropping
		this.numColours = numColours;		// Number of unique puyo colours being used
		this.targetPoints = targetPoints;	// Points required to send one nuisance puyo
		this.marginTime = marginTime;		// Milliseconds before target points start being reduced
		this.minChain = minChain;			// Minimum chain before nuisance is sent
		this.seed = seed;					// Seed for generating drops

		// Constants that cannot be modified
		this.lockDelayFrames = 32;			// Frames before a drop locks into place
		this.frames_per_rotation = 8;		// Number of frames used to animate 90 degrees of rotation
		this.rotate180_time = 200;			// Max milliseconds after a rotate attempt that a second rotate attempt will trigger 180 rotation
		this.squishFrames = 16;				// Number of frames used for squishing a drop into the stack
		this.dropFrames = 10;				// Number of frames used for all the puyo to drop
		this.popFrames = 65;				// Number of frames used to pop any amount of puyos

		this.terminalVelocity = 0.5;		// Maximum speed that a puyo can fall at
		this.splitPuyoInitialSpeed = 0.125;
		this.splitPuyoAcceleration = 0.024;
		this.nuisanceInitialSpeed = 0;
		this.nuisanceAcceleration = [0.01758, 0.01855, 0.01563, 0.02051, 0.01660, 0.01953];

		this.nuisanceLandFrames = 4;		// Number of frames taken for the nuisance landing animation
		this.hashSnapFactor = 100;			// Fraction of a row rounded to when hashing
		this.hashRotFactor = 50;			// Fraction of a rev rounded to when hashing
		this.nuisanceSpawnRow = rows + 2;	// Row of nuisance spawn

		this.timer = Date.now();			// Timer for margin time
		this.marginTimeStarted = false;		// Flag for whether margin time has started
		this.reductions = 0;				// Number of target point reductions
	}

	toString() {
		return this.gamemode + ' '
			+ this.gravity + ' '
			+ this.rows + ' '
			+ this.cols + ' '
			+ this.softDrop + ' '
			+ this.numColours + ' '
			+ this.targetPoints + ' '
			+ this.marginTime + ' '
			+ this.minChain + ' '
			+ this.seed;
	}

	static fromString(str) {
		const parts = str.split(' ');
		const gamemode = parts.splice(0, 1)[0];
		const parsedParts = parts.map(part => Number(part));
		return new Settings(gamemode, ...parsedParts);
	}

	static seedString(str) {
		const settings = this.fromString(str);
		settings.seed = Math.random();
		return settings.toString();
	}

	/**
	 * Updates the target points due to margin time.
	 */
	checkMarginTime(currentTime = Date.now()) {
		let timeElapsed = currentTime - this.timer;
		if(!this.marginTimeStarted) {
			if(timeElapsed > this.marginTime) {
				this.targetPoints = Math.floor(this.targetPoints * 0.75);
				this.reductions++;
				this.marginTimeStarted = true;
				timeElapsed -= this.marginTime;
				this.timer += this.marginTime;
			}
			else {
				// Not yet reached margin time
				return;
			}
		}
		while(timeElapsed > 16000 && this.targetPoints > 1 && this.reductions < 15) {
			this.targetPoints = Math.floor(this.targetPoints / 2);
			this.reductions++;
			timeElapsed -= 16000;
			this.timer += 16000;
		}
	}
}

// Helper functions for data validation

function checkBetweenInclusive(value, min, max) {
	const number = Number(value);
	if(number && number >= min && number <= max) {
		return number;
	}
	return undefined;
}

function checkPositiveInteger(value) {
	const number = Number(value);
	if(number && number >= 1) {
		return Math.floor(number);
	}
	return undefined;
}

function checkNonnegativeDecimal(value) {
	const number = Number(value);
	if(number === 0 || (number && number > 0)) {
		return number;
	}
	return undefined;
}

class SettingsBuilder {
	constructor() {
		// no default constructor
	}

	setGamemode (gamemode) {		// specific values fixed by options
		this.gamemode = gamemode;

		return this;
	}

	setGravity (gravity) {
		this.gravity = checkNonnegativeDecimal(gravity);
		return this;
	}

	setRows (rows) {
		this.rows = checkBetweenInclusive(checkPositiveInteger(rows), 6, 100);
		return this;
	}

	setCols(cols) {
		this.cols = checkBetweenInclusive(checkPositiveInteger(cols), 3, 50);
		return this;
	}

	setSoftDrop (softDrop) {
		this.softDrop = checkNonnegativeDecimal(softDrop);
		return this;
	}

	setNumColours (numColours) {
		this.numColours = checkBetweenInclusive(checkPositiveInteger(numColours), 1, 6);
		return this;
	}

	setTargetPoints (targetPoints) {
		this.targetPoints = checkBetweenInclusive(checkPositiveInteger(targetPoints), 1, Infinity);
		return this;
	}

	setMarginTimeInSeconds (marginTime) {
		const value = Math.floor(checkNonnegativeDecimal(marginTime));
		if(value) {
			this.marginTime = value * 1000;
		}
		return this;
	}

	setMinChain (minChain) {
		this.minChain = Math.floor(checkNonnegativeDecimal(minChain));
		return this;
	}

	build () {
		return new Settings(this.gamemode, this.gravity, this.rows, this.cols, this.softDrop, this.numColours, this.targetPoints, this.marginTime, this.minChain);
	}
}

class UserSettings {
	constructor(das = 133, arr = 33, skipFrames = 0, sfxVolume = 0.1, musicVolume = 0.1, appearance = 'TsuClassic', voice = 'akari') {
		this.das = das;						// Milliseconds before holding a key repeatedly triggers the event
		this.arr = arr;						// Milliseconds between event triggers after the DAS timer is complete
		this.skipFrames = skipFrames;		// Frames to skip when drawing opponent boards (improves performance)
		this.sfxVolume = sfxVolume;			// SFX Volume (varies between 0 and 1)
		this.musicVolume = musicVolume;		// Music Volume (varies between 0 and 1)
		this.appearance = appearance;
		this.voice = voice;

		this.keyBindings = {				// Default key bindings
			moveLeft: 'ArrowLeft',
			moveRight: 'ArrowRight',
			rotateCCW: 'KeyZ',
			rotateCW: 'KeyX',
			softDrop: 'ArrowDown',
			hardDrop: 'ArrowUp'
		};
	}

	set(key, value) {
		this[key] = value;
	}
}

module.exports = {
	Settings,
	SettingsBuilder,
	UserSettings
};