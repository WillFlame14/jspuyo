'use strict';

window.COLOUR_LIST = [ 'Red', 'Blue', 'Green','Purple', 'Yellow' ];
window.PUYO_COLOURS = { 'Red': 'rgba(200, 20, 20, 0.9)',
						'Green': 'rgba(20, 200, 20, 0.9)',
						'Blue': 'rgba(20, 20, 200, 0.9)',
						'Yellow': 'rgba(150, 150, 20, 0.9)',
						'Purple': 'rgba(150, 20, 150, 0.9)' };
window.PUYO_EYES_COLOUR = 'rgba(255, 255, 255, 0.7)';

window.Settings = class Settings {
	constructor(gravity = 0.02, lockDelay = 100, rows = 12, cols = 6, softDrop = 0.2, das = 200, arr = 20) {
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
		this.cascadeFramesPerRow = 5;	// Number of frames used for a puyo to fall one row
		this.popFrames = 50;			// Number of frames used to pop any amount of puyos
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
