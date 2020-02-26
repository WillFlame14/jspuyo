'use strict';

class Board {
	constructor(height = 12, width = 6) {
		this.height = height;
		this.width = width;

		this.boardstate = [];
		for(let i = 0; i < width; i++) {
			this.boardstate.push([]);
		}
	}

	checkGameOver() {
		return this.boardstate[3].length === this.height;
	}
}
