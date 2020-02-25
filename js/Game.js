'use strict';

const { Board } = require('./Board');
const { getNewDrop } = require('./Drop');

class Game {
	constructor(gamemode) {
		this.board = new Board(12, 6);
		this.gamemode = gamemode;
	}

	play() {
		while(!this.board.checkGameOver()) {
			let drop = getNewDrop();
		}
	}
}

let drop = getNewDrop();
console.log(drop);

drop.shiftLeft();

console.log(drop);

drop.rotateCW();

console.log(drop);

drop.rotateCW();

console.log(drop);
