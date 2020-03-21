'use strict';

window.Cpu = class Cpu {
	constructor(settings, speed) {
		if(this.constructor === Cpu) {
			throw new Error('Abstract class cannot be instatiated.');
		}
		this.settings = settings;
		this.speed = speed;
	}

	assignSettings(settings) {
		this.settings = settings;
	}

	/* eslint-disable-next-line no-unused-vars*/
	getMove(boardState, currentDrop) {
		throw new Error('getMove(boardState, currentDrop) must be implemented by the subclass.');
	}
}

window.HarpyCpu = class HarpyCpu extends window.Cpu {
	constructor(settings, speed) {
		super(settings, speed);
	}

	getMove(boardState) {
		let col = this.settings.cols - 1;
		// Attempt to place on the right side of the board
		while(boardState[col].length >= this.settings.rows - 1 && col > 2) {
			col--;
		}
		// Attempt to place on the left side of the board
		if(col === 2) {
			col = 0;
			while(boardState[col].length >= this.settings.rows - 1 && col < 2) {
				col++;
			}
		}
		return { col: col, rotations: 0 };
	}
}