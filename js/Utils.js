'use strict';

window.COLOUR_LIST = [ 'Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Gray'];
window.PUYO_COLOURS = { 'Red': 'rgba(200, 20, 20, 0.9)',
						'Green': 'rgba(20, 200, 20, 0.9)',
						'Blue': 'rgba(20, 20, 200, 0.9)',
						'Purple': 'rgba(150, 20, 150, 0.9)',
						'Yellow': 'rgba(150, 150, 20, 0.9)',
						'Gray': 'rgba(100, 100, 100, 0.9)' };
window.PUYO_EYES_COLOUR = 'rgba(255, 255, 255, 0.7)';

window.Settings = class Settings {
	constructor(gamemode = 'Tsu', gravity = 0.017, rows = 12, cols = 6, softDrop = 0.215, numColours = 4, targetPoints = 70, seed = Math.random()) {
		this.gamemode = gamemode;			// Type of game that is being played
		this.gravity = gravity;				// Vertical distance the drop falls every frame naturally (without soft dropping)
		this.rows = rows;					// Number of rows in the game board
		this.cols = cols;					// Number of columns in the game board
		this.softDrop = softDrop;			// Additional vertical distance the drop falls when soft dropping
		this.numColours = numColours;		// Number of unique puyo colours being used
		this.targetPoints = targetPoints;	// Points required to send one nuisance puyo
		this.seed = seed;

		// Constants that cannot be modified
		this.lockDelay = 200;				// Milliseconds of time before a drop locks into place
		this.frames_per_rotation = 8;		// Number of frames used to animate 90 degrees of rotation
		this.rotate180_time = 200;			// Max milliseconds after a rotate attempt that a second rotate attempt will trigger 180 rotation
		this.squishFrames = 8;				// Number of frames used for squishing a drop into the stack
		this.dropFrames = 10;				// Number of frames used for all the puyo to drop
		this.popFrames = 65;				// Number of frames used to pop any amount of puyos
		this.isoCascadeFramesPerRow	= 3.25;	// Number of frames used for an isolated puyo to fall one row
		this.meanNuisanceCascadeFPR = 3;	// Average frames used for nuisance to drop one row
		this.varNuisanceCascadeFPR = 0.3; 	// Max positive or negative difference in frames used for nuisance to drop one row
		this.nuisanceLandFrames = 4;		// Number of frames taken for the nuisance landing animation
		this.hashSnapFactor = 100;			// Fraction of a row rounded to when hashing
		this.hashRotFactor = 50;			// Fraction of a rev rounded to when hashing
		this.nuisanceSpawnRow = rows + 2;	// Row of nuisance spawn
	}

	toString() {
		return this.gamemode + ' '
			+ this.gravity + ' '
			+ this.rows + ' '
			+ this.cols + ' '
			+ this.softDrop + ' '
			+ this.numColours + ' '
			+ this.targetPoints + ' '
			+ this.seed;
	}

	static fromString(str) {
		const parts = str.split(' ');
		const gamemode = parts.splice(0, 1)[0];
		const parsedParts = parts.map(part => Number(part));
		return new Settings(gamemode, ...parsedParts);
	}
}

window.UserSettings = class UserSettings {
	constructor(das = 200, arr = 20, volume = 0.1) {
		this.das = das;						// Milliseconds before holding a key repeatedly triggers the event
		this.arr = arr;						// Milliseconds between event triggers after the DAS timer is complete
		this.volume = volume;				// Volume (varies between 0 and 1)
	}
}

window.AudioPlayer = class AudioPlayer {
	constructor(gameId, socket, volume) {
		this.gameId = gameId;
		this.socket = socket;
		this.volume = volume;
		this.cancel = false;

		this.sfx = {
			'move': new Audio('../sounds/SE_T07_move.wav'),
			'rotate': new Audio('../sounds/SE_T08_rotate.wav'),
			'win': new Audio('../sounds/SE_T19_win.wav'),
			'loss': new Audio('../sounds/se_puy20_lose.wav'),
			'chain': [
				null,
				new Audio('../sounds/SE_T00_ren1.wav'),
				new Audio('../sounds/SE_T01_ren2.wav'),
				new Audio('../sounds/SE_T02_ren3.wav'),
				new Audio('../sounds/SE_T03_ren4.wav'),
				new Audio('../sounds/SE_T04_ren5.wav'),
				new Audio('../sounds/SE_T05_ren6.wav'),
				new Audio('../sounds/SE_T06_ren7.wav')
			],
			'chain_voiced': [
				null
			],
			'chain_voiced_jpn': [
				null,
				new Audio('../sounds/voices/chain_1_jpn.wav'),
				new Audio('../sounds/voices/chain_2_jpn.wav'),
				new Audio('../sounds/voices/chain_3_jpn.wav'),
				new Audio('../sounds/voices/chain_4_jpn.wav'),
				new Audio('../sounds/voices/chain_5_jpn.wav'),
				new Audio('../sounds/voices/chain_6_jpn.wav'),
				new Audio('../sounds/voices/chain_7_jpn.wav'),
				new Audio('../sounds/voices/chain_8_jpn.wav'),
				new Audio('../sounds/voices/chain_9_jpn.wav'),
				new Audio('../sounds/voices/chain_10_jpn.wav'),
				new Audio('../sounds/voices/chain_11_jpn.wav'),
				new Audio('../sounds/voices/chain_12_jpn.wav'),
			],
			'nuisanceSend': [
				null,
				null,
				new Audio('../sounds/SE_T14_oj_okuri1.wav'),
				new Audio('../sounds/SE_T15_oj_okuri2.wav'),
				new Audio('../sounds/SE_T16_oj_okuri3.wav'),
				new Audio('../sounds/SE_T17_oj_okuri4.wav')
			],
			'nuisanceFall1': new Audio('../sounds/SE_T12_ojama1.wav'),
			'nuisanceFall2': new Audio('../sounds/SE_T13_ojama2.wav'),
			'allClear': new Audio('../sounds/SE_T22_zenkesi.wav')
		};

		// Set volume for each sound
		Object.keys(this.sfx).forEach(key => {
			const sounds = this.sfx[key];
			if(key.includes('voiced')) {
				sounds.filter(sound => sound !== null).forEach(sound => sound.volume = 0.4);
				return;
			}
			if(Array.isArray(sounds)) {
				sounds.filter(sound => sound !== null).forEach(sound => sound.volume = this.volume);
			}
			else if(sounds !== null) {
				// Win/Lose SFX are especially loud
				if(key === 'win' || key === 'lose') {
					sounds.volume = this.volume * 0.6;
				}
				else {
					sounds.volume = this.volume;
				}
			}
		});
	}

	/**
	 * Plays a sound effect. An 1-based index parameter is provided for more detailed selection.
	 */
	playSfx(sfx_name, index = null) {
		if(this.cancel) {
			return;
		}
		if(index !== null) {
			this.sfx[sfx_name][index].play();
		}
		else {
			this.sfx[sfx_name].play();
		}
	}

	/**
	 * Plays a sound effect, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitSfx(sfx_name, index = null) {
		this.playSfx(sfx_name, index);
		this.socket.emit('sendSound', this.gameId, sfx_name, index);
	}

	disable() {
		this.cancel = true;
	}
}

window.DropGenerator = class DropGenerator {
	constructor(settings) {
		this.settings = settings;
		this.seed = this.settings.seed;
		this.drops = [];
		this.colourList = Object.keys(window.PUYO_COLOURS).slice(0, this.settings.numColours).map(colour_name => window.PUYO_COLOURS[colour_name]);
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
			let colour = this.colourList[Math.floor(this.randomNumber() * this.colourList.length)];
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
			this.drops[0].push(window.Drop.getNewDrop(this.settings, colours));
		}

		for(let i = 3; i < 128; i++) {
			// Filter out colours that have been completely used up
			const tempColourList = Object.keys(this.colourBuckets).filter(colour => this.colourBuckets[colour] > 0);
			const colours = [
				tempColourList[Math.floor(this.randomNumber() * tempColourList.length)],
				tempColourList[Math.floor(this.randomNumber() * tempColourList.length)]
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;

			this.drops[0].push(window.Drop.getNewDrop(this.settings, colours));
		}
	}

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
					colourList[Math.floor(this.randomNumber() * colourList.length)],
					colourList[Math.floor(this.randomNumber() * colourList.length)]
				];
				this.colourBuckets[colours[0]]--;
				this.colourBuckets[colours[1]]--;

				this.drops[index + 1].push(window.Drop.getNewDrop(this.settings, colours));
			}
		}
		return this.drops[index];
	}

	randomNumber() {
		const x = Math.sin(this.seed++) * 10000;
		return x - Math.floor(x);
	}
}

/**
 * Returns a random puyo colour, given the size of the colour pool.
 */
window.getRandomColour = function (numColours) {
	const colours = window.COLOUR_LIST.slice(0, numColours);

	return window.PUYO_COLOURS[colours[Math.floor(Math.random() * numColours)]];
}

/**
 * Returns the location(s) of the schezo puyo(s).
 *
 * Currently only works for I-shaped Drops (Tsu).
 */
window.getOtherPuyo = function(drop) {
	let x = drop.arle.x + Math.cos(drop.standardAngle + Math.PI / 2);
	let y = drop.arle.y + Math.sin(drop.standardAngle + Math.PI / 2);

	// Perform integer rounding
	if(Math.abs(x - Math.round(x)) < 0.001) {
		x = Math.round(x);
	}
	if(Math.abs(y - Math.round(y)) < 0.001) {
		y = Math.round(y);
	}
	return { x, y };
}

/**
 * Gets the frames needed for the animation (accounts for falling time).
 */
window.getDropFrames = function (poppingLocs, boardState, settings) {
	return poppingLocs.some(loc => {
		return boardState[loc.col][loc.row + 1] !== undefined && !poppingLocs.includes({ col: loc.col, row: loc.row + 1});
	}) ? settings.dropFrames : 0;
}

/**
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
window.calculateScore = function(puyoLocs, chain_length) {
	// These arrays are 1-indexed.
	const CHAIN_POWER = [null, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [null, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [null, null, null, null, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

	// Number of puyos cleared in the chain
	const puyos_cleared = puyoLocs.length;

	// Find the different colours
	const containedColours = {};

	puyoLocs.forEach(puyo => {
		if(containedColours[puyo.colour] === undefined) {
			containedColours[puyo.colour] = 1;
		}
		else {
			containedColours[puyo.colour]++;
		}
	});

	// Chain power based on length of chain
	const chain_power = CHAIN_POWER[chain_length];

	// Colour bonus based on number of colours used
	const colour_bonus = COLOUR_BONUS[Object.keys(containedColours).length];

	// Group bonus based on number of puyos in each group
	const group_bonus = Object.keys(containedColours).reduce((bonus, colour) => bonus += GROUP_BONUS[containedColours[colour]], 0);

	return (10 * puyos_cleared) * (chain_power + colour_bonus + group_bonus);
}

window.calculateNuisance = function(chain_score, targetPoints, leftoverNuisance) {
	const nuisancePoints = chain_score / targetPoints + leftoverNuisance;
	const nuisanceSent = Math.floor(nuisancePoints);

	return { nuisanceSent, leftoverNuisance: nuisancePoints - nuisanceSent };
}

/**
 * Deep copies an object where all values are primitype types.
 * Call this function recursively to deep copy more nested objects.
 */
window.objectCopy = function(obj) {
	return JSON.parse(JSON.stringify(obj));
}
