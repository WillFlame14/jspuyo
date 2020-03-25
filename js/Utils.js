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
	constructor(gravity = 0.02, lockDelay = 200, rows = 12, cols = 6, softDrop = 0.2, das = 200, arr = 20, numColours = 4, volume = 0.1) {
		this.gravity = gravity;			// Vertical distance the drop falls every frame naturally (without soft dropping)
		this.lockDelay = lockDelay;		// Milliseconds of time before a drop locks into place
		this.rows = rows;				// Number of rows in the game board
		this.cols = cols;				// Number of columns in the game board
		this.softDrop = softDrop;		// Additional vertical distance the drop falls when soft dropping
		this.das = das;					// Milliseconds before holding a key repeatedly triggers the event
		this.arr = arr;					// Milliseconds between event triggers after the DAS timer is complete
		this.numColours = numColours;
		this.volume = volume;

		// Constants that cannot be modified
		this.frames_per_rotation = 8;	// Number of frames used to animate 90 degrees of rotation
		this.rotate180_time = 200;		// Max milliseconds after a rotate attempt that a second rotate attempt will trigger 180 rotation
		this.cascadeFramesPerRow = 10;	// Number of frames used for a puyo to fall one row
		this.dropFrames = 10;			// Number of frames used for all the puyo to drop
		this.popFrames = 50;			// Number of frames used to pop any amount of puyos
		this.isoCascadeFramesPerRow	= 4;// Number of frames used for an isolated puyo to fall one row
		this.pointsPerNuisance = 70;
	}
}

window.AudioPlayer = class AudioPlayer {
	constructor(gameId, socket, volume) {
		this.gameId = gameId;
		this.socket = socket;
		this.volume = volume;
		this.cancel = false;

		this.sfx = {
			"move": new Audio('../sounds/SE_T07_move.wav'),
			"rotate": new Audio('../sounds/SE_T08_rotate.wav'),
			"win": new Audio('../sounds/SE_T19_win.wav'),
			"loss": new Audio('../sounds/se_puy20_lose.wav'),
			"chain": [
				null,
				new Audio('../sounds/SE_T00_ren1.wav'),
				new Audio('../sounds/SE_T01_ren2.wav'),
				new Audio('../sounds/SE_T02_ren3.wav'),
				new Audio('../sounds/SE_T03_ren4.wav'),
				new Audio('../sounds/SE_T04_ren5.wav'),
				new Audio('../sounds/SE_T05_ren6.wav'),
				new Audio('../sounds/SE_T06_ren7.wav')
			],
			"nuisanceSend": [
				null,
				null,
				new Audio('../sounds/SE_T14_oj_okuri1.wav'),
				new Audio('../sounds/SE_T15_oj_okuri2.wav'),
				new Audio('../sounds/SE_T16_oj_okuri3.wav'),
				new Audio('../sounds/SE_T17_oj_okuri4.wav')
			],
			"nuisanceFall1": new Audio('../sounds/SE_T12_ojama1.wav'),
			"nuisanceFall2": new Audio('../sounds/SE_T13_ojama2.wav')
		};

		// Set volume for each sound
		Object.keys(this.sfx).forEach(key => {
			const sounds = this.sfx[key];
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
	constructor(gamemode, settings) {
		this.gamemode = gamemode;
		this.settings = settings;
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
			let colour = window.getRandomColour(this.settings.numColours);
			if(!firstColours.includes(colour)) {
				firstColours.push(colour);
			}
		}

		// Only use the previously determined 3 colours for the first 3 drops
		for(let i = 0; i < 3; i++) {
			const colours = [
				firstColours[Math.floor(Math.random() * 3)],
				firstColours[Math.floor(Math.random() * 3)]
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;
			this.drops[0].push(window.Drop.getNewDrop(this.gamemode, this.settings, colours));
		}

		for(let i = 3; i < 128; i++) {
			// Filter out colours that have been completely used up
			const tempColourList = Object.keys(this.colourBuckets).filter(colour => this.colourBuckets[colour] > 0);
			const colours = [
				tempColourList[Math.floor(Math.random() * tempColourList.length)],
				tempColourList[Math.floor(Math.random() * tempColourList.length)]
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;

			this.drops[0].push(window.Drop.getNewDrop(this.gamemode, this.settings, colours));
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
					colourList[Math.floor(Math.random() * colourList.length)],
					colourList[Math.floor(Math.random() * colourList.length)]
				];
				this.colourBuckets[colours[0]]--;
				this.colourBuckets[colours[1]]--;

				this.drops[index + 1].push(window.Drop.getNewDrop(this.gamemode, this.settings));
			}
		}
		return this.drops[index];
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
window.getDropFrames = function (puyoLocs, boardState, settings) {
	let puyoFalling = false;
	let colPuyoLocs = [];
	for (let i = 0; i < settings.cols; i++) {
		colPuyoLocs = puyoLocs.filter(loc => loc.col === i).map(loc => loc.row).sort();
		if (boardState[i][colPuyoLocs[colPuyoLocs.length - 1] + 1] != null) {
			puyoFalling = true;
		} else {
			for (let j = 0; j < colPuyoLocs.length - 1; j++) {
				if (colPuyoLocs[j + 1] - colPuyoLocs[j] !== 1) {
					puyoFalling = true;
				}
			}
		}
	}

	if (puyoFalling) {
		return settings.dropFrames;
	} else {
		return 0;
	}
}

/**
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
window.calculateScore = function(puyoLocs, chain_length) {
	// These arrays are 1-indexed.
	const CHAIN_POWER = [-1, 0, 8, 16, 32, 64, 96, 128,160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [-1, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [-1, -1, -1, -1, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

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

window.calculateNuisance = function(chain_score, pointsPerNuisance, leftoverNuisance) {
	const nuisancePoints = chain_score / pointsPerNuisance + leftoverNuisance;
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
