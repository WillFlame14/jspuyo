'use strict';

window.COLOUR_LIST = [ 'Red', 'Blue', 'Green','Purple', 'Yellow' ];
window.PUYO_COLOURS = { 'Red': 'rgba(200, 20, 20, 0.9)',
						'Green': 'rgba(20, 200, 20, 0.9)',
						'Blue': 'rgba(20, 20, 200, 0.9)',
						'Yellow': 'rgba(150, 150, 20, 0.9)',
						'Purple': 'rgba(150, 20, 150, 0.9)' };
window.PUYO_EYES_COLOUR = 'rgba(255, 255, 255, 0.7)';

window.Settings = class Settings {
	constructor(gravity = 0.02, lockDelay = 200, rows = 12, cols = 6, softDrop = 0.2, das = 200, arr = 20) {
		this.gravity = gravity;			// Vertical distance the drop falls every frame naturally (without soft dropping)
		this.lockDelay = lockDelay;		// Milliseconds of time before a drop locks into place
		this.rows = rows;				// Number of rows in the game board
		this.cols = cols;				// Number of columns in the game board
		this.softDrop = softDrop;		// Additional vertical distance the drop falls when soft dropping
		this.das = das;					// Milliseconds before holding a key repeatedly triggers the event
		this.arr = arr;					// Milliseconds between event triggers after the DAS timer is complete

		// Constants that cannot be modified
		this.frames_per_rotation = 8;	// Number of frames used to animate 90 degrees of rotation
		this.rotate180_time = 200;		// Max milliseconds after a rotate attempt that a second rotate attempt will trigger 180 rotation
		this.cascadeFramesPerRow = 10;	// Number of frames used for a puyo to fall one row
		this.dropFrames = 10;			// Number of frames used for all the puyo to drop
		this.popFrames = 40;			// Number of frames used to pop any amount of puyos
		this.isoCascadeFramesPerRow	= 4;// Number of frames used for an isolated puyo to fall one row
		this.pointsPerNuisance = 70;
	}
}

/**
 * Returns a random puyo colour, given the size of the colour pool.
 */
window.getRandomColour = function (numColours = 4) {
	const colours = window.COLOUR_LIST.slice(0, numColours);

	return window.PUYO_COLOURS[colours[Math.floor(Math.random() * 4)]];
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
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
window.calculateScore = function(puyoLocs) {
	const CHAIN_POWER = [-1, 0, 8, 16, 32, 64, 96, 128,160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [-1, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [-1, -1, -1, -1, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

	// Number of puyos cleared in the chain
	const puyos_cleared = puyoLocs.reduce((puyos, group) => puyos += group.length, 0);

	// Find the different colours
	const containedColours = [];

	puyoLocs.forEach(chain => {
		if(!containedColours.includes(chain[0].colour)) {
			containedColours.push(chain[0].colour);
		}
	});

	// Chain power based on length of chain
	const chain_power = CHAIN_POWER[puyoLocs.length];

	// Colour bonus based on number of colours used
	const colour_bonus = COLOUR_BONUS[containedColours.length];

	// Group bonus based on number of puyos in each group
	const group_bonus = puyoLocs.reduce((bonus, group) => bonus += GROUP_BONUS[group.length], 0);

	return (10 * puyos_cleared) * (chain_power + colour_bonus + group_bonus);
}

window.calculateNuisance = function(chain_score, pointsPerNuisance, leftoverNuisance) {
	const nuisancePoints = chain_score / pointsPerNuisance + leftoverNuisance;
	const nuisanceSent = Math.floor(nuisancePoints);

	return { nuisanceSent, leftoverNuisance: nuisancePoints - nuisanceSent };
}