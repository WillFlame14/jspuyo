'use strict';

window.Board = class Board {
	constructor(height = 12, width = 6) {
		this.height = height;
		this.width = width;

		this.boardState = [];
		for(let i = 0; i < width; i++) {
			this.boardState.push([]);
		}
	}

	checkGameOver() {
		return this.boardState[2].length >= this.height;
	}
}
