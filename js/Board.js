'use strict';

class Board {
	constructor(height = 12, width = 6) {
		this.height = height;
		this.width = width;

		this.columns = [];
		for(let i = 0; i < width; i++) {
			this.columns.push([]);
		}
	}

	checkGameOver() {
		return this.columns[3].length === this.height;
	}
}

module.exports = { Board };