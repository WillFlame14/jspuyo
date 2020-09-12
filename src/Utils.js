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

const checkBetweenEq = function(value, min, max) {
	const number = Number(value);
	if(number && number >= min && number <= max) {
		return number;
	}
	return undefined;
};

const checkPositiveInteger = function(value) {
	const number = Number(value);
	if(number && number >= 1) {
		return Math.floor(number);
	}
	return undefined;
};

const checkNonnegativeDecimal = function(value) {
	const number = Number(value);
	if(number === 0 || (number && number > 0)) {
		return number;
	}
	return undefined;
};

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
		this.rows = checkBetweenEq(checkPositiveInteger(rows), 6, 100);
		return this;
	}

	setCols(cols) {
		this.cols = checkBetweenEq(checkPositiveInteger(cols), 3, 50);
		return this;
	}

	setSoftDrop (softDrop) {
		this.softDrop = checkNonnegativeDecimal(softDrop);
		return this;
	}

	setNumColours (numColours) {
		this.numColours = checkBetweenEq(checkPositiveInteger(numColours), 1, 6);
		return this;
	}

	setTargetPoints (targetPoints) {
		this.targetPoints = checkBetweenEq(checkPositiveInteger(targetPoints), 1, Infinity);
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

const audioFilenames = {
	move: { numClips: 1, defaultVolume: 1, extension: 'wav' },
	rotate: { numClips: 1, defaultVolume: 1, extension: 'wav' },
	win: { numClips: 1, defaultVolume: 0.8, extension: 'wav' },
	loss: { numClips: 1, defaultVolume: 0.8, extension: 'wav' },
	chain: { numClips: 7, defaultVolume: 1, start: 1, extension: 'wav' },
	nuisance_send: { numClips: 4, defaultVolume: 1, start: 2, extension: 'wav' },
	nuisance_fall: { numClips: 2, defaultVolume: 1, extension: 'wav' },
	all_clear: { numClips: 1, defaultVolume: 1, extension: 'wav' },
	open_panel: { numClips: 1, defaultVolume: 10, extension: 'ogg' },
	close_panel: { numClips: 1, defaultVolume: 10, extension: 'ogg' },
	hover_option: { numClips: 2, defaultVolume: 2, extension: 'ogg' },
	click_option: { numClips: 1, defaultVolume: 6, extension: 'ogg' },
	close_modal: { numClips: 1, defaultVolume: 6, extension: 'ogg' },
	submit: { numClips: 1, defaultVolume: 2, extension: 'ogg' }
};

const VOICES = {
	'akari': { defaultVolume: 3, extension: 'ogg', colour: [130, 212, 187] },
	'maria': { defaultVolume: 6, extension: 'ogg', colour: [224, 175, 160] },
};

const SOUNDS_DIRECTORY = './sounds';

class AudioPlayer {
	constructor(socket, disable) {
		this.socket = socket;
		this.cancel = false;
		this.disabled = disable === 'disable';

		const { sfxVolume, musicVolume } = new UserSettings();

		this.sfxVolume = sfxVolume;
		this.musicVolume = musicVolume;

		this.sfx = {};

		// Load sound clips
		if(!this.disabled) {
			Object.keys(audioFilenames).forEach(name => {
				const audioInfo = audioFilenames[name];

				if(audioInfo.numClips === 1) {
					const audio = new Audio(`${SOUNDS_DIRECTORY}/${name}.${audioInfo.extension}`);
					this.sfx[name] = [audio];
				}
				else {
					const start = audioInfo.start || 0;
					const audioFiles = Array(start).fill(null);		// Fill array with null until start

					for(let i = 0; i < audioInfo.numClips; i++) {
						const audio = new Audio(`${SOUNDS_DIRECTORY}/${name}_${i + 1}.${audioInfo.extension}`);
						audioFiles.push([audio]);
					}
					this.sfx[name] = audioFiles;
				}
			});

			this.voices = {};

			Object.keys(VOICES).forEach(name => {
				const { extension } = VOICES[name];
				const chainAudio = [null];

				for(let i = 0; i < 13; i++) {
					const audio = new Audio(`${SOUNDS_DIRECTORY}/voices/${name}/chain_${i + 1}.${extension}`);
					chainAudio.push([audio]);
				}

				const spellAudio = [null];
				for(let i = 0; i < 5; i++) {
					const audio = new Audio(`${SOUNDS_DIRECTORY}/voices/${name}/spell_${i + 1}.${extension}`);
					spellAudio.push([audio]);
				}

				const selectAudio = [new Audio(`${SOUNDS_DIRECTORY}/voices/${name}/select.${extension}`)];
				this.voices[name] = { chain: chainAudio, spell: spellAudio, select: selectAudio };
			});
		}
	}

	assignGameId(gameId) {
		this.gameId = gameId;
	}

	configureVolume(sfxVolume, musicVolume) {
		this.sfxVolume = sfxVolume;
		this.musicVolume = musicVolume;
	}

	/**
	 * Plays an audio clip. An 1-based index parameter is provided for more detailed selection.
	 */
	playAudio(audio, volume) {
		let channel = 0;
		while(channel < audio.length && !audio[channel].paused) {
			channel++;
		}

		// Generate a new audio object
		if(channel === audio.length) {
			const newsfx = audio[channel - 1].cloneNode();
			audio.push(newsfx);
		}
		audio[channel].volume = volume;
		audio[channel].play();
	}

	playSfx(sfx_name, index = null) {
		if(this.disabled) {
			return;
		}
		const audio = (index === null) ? this.sfx[sfx_name] : this.sfx[sfx_name][index];
		const volume = this.sfxVolume * audioFilenames[sfx_name].defaultVolume;
		this.playAudio(audio, volume);
	}

	playVoice(character, audio_name, index = null) {
		if(this.disabled) {
			return;
		}
		const audio = (index === null) ? this.voices[character][audio_name] : this.voices[character][audio_name][index];
		const volume = this.sfxVolume * VOICES[character].defaultVolume;
		this.playAudio(audio, volume);
	}

	/**
	 * Plays a sound effect, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitSfx(sfx_name, index = null) {
		this.playSfx(sfx_name, index);
		this.socket.emit('sendSound', this.gameId, sfx_name, index);
	}

	/**
	 * Plays a voiced audio clip, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitVoice(character, audio_name, index = null) {
		this.playVoice(character, audio_name, index);
		this.socket.emit('sendVoice', this.gameId, character, audio_name, index);
	}
}

/**
 * Returns a random puyo colour, given the size of the colour pool.
 */
function getRandomColour (numColours) {
	return Math.floor(Math.random() * numColours) + 1;
}

/**
 * Returns the location(s) of the schezo puyo(s).
 *
 * Currently only works for I-shaped Drops (Tsu).
 */
function getOtherPuyo (drop) {
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
function getDropFrames(poppingLocs, boardState, settings) {
	return poppingLocs.some(loc => {
		return boardState[loc.col][loc.row + 1] !== undefined && !poppingLocs.some(loc2 => loc2.col === loc.col && loc2.row === loc.row + 1);
	}) ? settings.dropFrames : 0;
}

/**
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
function calculateScore (puyos, chain_length) {
	// These arrays are 1-indexed.
	const CHAIN_POWER = [null, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [null, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [null, null, null, null, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

	// Number of puyos cleared in the chain
	const puyos_cleared = puyos.length;

	// Find the different colours
	const containedColours = {};

	puyos.forEach(puyo => {
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

/**
 * Finds the amount of nuisance generated from a particular increase in score.
 */
function calculateNuisance(chain_score, targetPoints, leftoverNuisance) {
	const nuisancePoints = chain_score / targetPoints + leftoverNuisance;
	const nuisanceSent = Math.floor(nuisancePoints);

	return { nuisanceSent, leftoverNuisance: nuisancePoints - nuisanceSent };
}

/**
 * Deep copies an object where all values are primitype types.
 * Call this function recursively to deep copy more nested objects.
 */
function objectCopy(obj) {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Clamps a number between a minimum and maximum number.
 */
function clampBetween(value, min, max) {
	if(value < min) {
		return min;
	}
	else if(value > max) {
		return max;
	}
	return value;
}

const Utils = {
	getRandomColour,
	getOtherPuyo,
	getDropFrames,
	calculateScore,
	calculateNuisance,
	objectCopy,
	clampBetween
};

module.exports = {
	VOICES,
	Settings,
	SettingsBuilder,
	UserSettings,
	AudioPlayer,
	Utils
};
