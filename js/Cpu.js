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

	getMove(boardState, currentDrop) {
		let col = this.settings.cols - 1;
		let rotations = 0;
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

		// Only column 2 left
		if(col === 2) {
			const noRotationBoard = new window.Board(this.settings, boardState);
			noRotationBoard.boardState[2].push(currentDrop.colours[0]);
			noRotationBoard.boardState[2].push(currentDrop.colours[1]);
			const noRotationChains = noRotationBoard.resolveChains();

			const yesRotationBoard = new window.Board(this.settings, boardState);
			yesRotationBoard.boardState[2].push(currentDrop.colours[1]);
			yesRotationBoard.boardState[2].push(currentDrop.colours[0]);
			const yesRotationChains = yesRotationBoard.resolveChains();

			if(yesRotationChains.length > noRotationChains.length) {
				console.log('YES ROTATE')
				rotations = 2;
			}
		}

		return { col, rotations };
	}
}

window.TestCpu = class TestCpu extends window.Cpu {
	constructor(settings, speed) {
		super(settings, speed);
	}

	getMove(boardState, currentDrop) {
		let maxChain = 0;
		let col = Math.floor(Math.random() * this.settings.cols);
		let rotations = 0;
		for(let currCol = 0; currCol < this.settings.cols - 1; currCol++) {
			const board = new window.Board(this.settings, boardState);
			board.boardState[currCol].push(currentDrop.colours[0]);
			board.boardState[currCol].push(currentDrop.colours[1]);

			const chains = board.resolveChains();
			if(chains.length > maxChain) {
				maxChain = chains.length;
				col = currCol;
			}

			const board2 = new window.Board(this.settings, boardState);
			board2.boardState[currCol].push(currentDrop.colours[1]);
			board2.boardState[currCol].push(currentDrop.colours[0]);

			const chains2 = board.resolveChains();
			if(chains2.length > maxChain) {
				maxChain = chains2.length;
				col = currCol;
				rotations = 2;
			}
		}

		return { col, rotations };
	}
}
