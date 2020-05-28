'use strict';

const { Board } = require('./Board.js');

class Cpu {
	constructor(settings) {
		if(this.constructor === Cpu) {
			throw new Error('Abstract class cannot be instatiated.');
		}
		this.settings = settings;
	}

	/**
	 * Returns the optimal move according to the AI.
	 */
	/* eslint-disable-next-line no-unused-vars*/
	getMove(boardState, currentDrop) {
		throw new Error('getMove(boardState, currentDrop) must be implemented by the subclass.');
	}

	/**
	 * Returns the average height of all the columns.
	 */
	getAverageHeight(boardState) {
		return boardState.reduce((sum, col) => sum += col.length, 0) / this.settings.cols;
	}

	/**
	 * Returns the best column placement with either 0 or 2 rotations that makes a chain longer than minChain.
	 * If none exist, returns -1.
	 */
	checkForSimpleChains(boardState, currentDrop, minChain) {
		let runningMaxChain = minChain;
		let col = -1;
		for(let i = 0; i < this.settings.cols * 2; i++) {
			const currCol = Math.floor(i / 2);
			const board = new Board(this.settings, boardState);
			if(i % 2 === 0) {
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
			}
			else {
				board.boardState[currCol].push(currentDrop.colours[1]);
				board.boardState[currCol].push(currentDrop.colours[0]);
			}

			const chains = board.resolveChains();
			if(chains.length > runningMaxChain) {
				runningMaxChain = chains.length;
				col = currCol;
			}
		}
		return col;
	}

	/**
	 * Returns the move that results in the best chain longer than minChain.
	 * If none exist, returns { col: -1, rotations: -1 };
	 */
	checkForAllChains(boardState, currentDrop, minChain) {
		let runningMaxChain = minChain;
		let col = -1;
		let rotations = -1;
		for(let i = 0; i < this.settings.cols * 4; i++) {
			const currCol = i % this.settings.cols;
			const board = new Board(this.settings, boardState);
			let tempRotations;
			if(i < this.settings.cols) {
				board.boardState[currCol].push(currentDrop.colours[1]);
				board.boardState[currCol].push(currentDrop.colours[0]);
				tempRotations = 2;
			}
			else if(i < this.settings.cols * 2) {
				if(currCol === 0) {
					continue;
				}
				board.boardState[currCol - 1].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
				tempRotations = -1;
			}
			else if(i < this.settings.cols * 3) {
				if(currCol === this.settings.cols - 1) {
					continue;
				}
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol + 1].push(currentDrop.colours[1]);
				tempRotations = 1;
			}
			else {
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
				tempRotations = 0;
			}

			const chains = board.resolveChains();
			if(chains.length > runningMaxChain) {
				runningMaxChain = chains.length;
				col = currCol;
				rotations = tempRotations;
			}
		}
		return { col, rotations };
	}

	static getAllCpuNames() {
		return [
			'Random',
			'Flat',
			'Tall',
			'Chain',
			'Test'
		];
	}

	static fromString(ai, settings) {
		switch(ai) {
			case 'Random':
				return new RandomCpu(settings);
			case 'Flat':
				return new FlatCpu(settings);
			case 'Tall':
				return new TallCpu(settings);
			case 'Chain':
				return new ChainCpu(settings);
			default:
				return new TestCpu(settings);
		}
	}
}


/**
 * RandomCpu: Completely random moves.
 */
class RandomCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	// eslint-disable-next-line no-unused-vars
	getMove(boardState, currentDrop) {
		const col = Math.floor(Math.random() * this.settings.cols);
		const rotations = Math.floor(Math.random() * 4) - 2;
		return { col, rotations };
	}
}

/**
 * FlatCpu: stacks horizontally
 */
class FlatCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	getMove(boardState, currentDrop) {
		let col = 0;
		const rotations = 0;
		let minHeight = -1;
		for(let i = 0; i < this.settings.cols - 1; i++) {
			if(boardState[i].length < minHeight) {
				minHeight = boardState[i].length;
				col = i;
			}
		}

		const result = super.checkForSimpleChains(boardState, currentDrop, 1);

		if(result !== -1) {
			col = result;
		}

		return { col, rotations };
	}
}

/**
 * TallCpu: stacks the right side, then the left side
 */
class TallCpu extends Cpu {
	constructor(settings) {
		super(settings);
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
			const noRotationBoard = new Board(this.settings, boardState);
			noRotationBoard.boardState[2].push(currentDrop.colours[0]);
			noRotationBoard.boardState[2].push(currentDrop.colours[1]);
			const noRotationChains = noRotationBoard.resolveChains();

			const yesRotationBoard = new Board(this.settings, boardState);
			yesRotationBoard.boardState[2].push(currentDrop.colours[1]);
			yesRotationBoard.boardState[2].push(currentDrop.colours[0]);
			const yesRotationChains = yesRotationBoard.resolveChains();

			if(yesRotationChains.length > noRotationChains.length) {
				rotations = 2;
			}
		}

		return { col, rotations };
	}
}

/**
 * ChainCpu: Goes for the longest possible chain result given the current drop.
 * Otherwise, places randomly.
 */
class ChainCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	getMove(boardState, currentDrop) {
		let col = Math.floor(Math.random() * this.settings.cols);
		const rotations = 0;

		// Deter against random placements in column 2 (when 0-indexed)
		while(col === 2) {
			col = Math.floor(Math.random() * this.settings.cols);
		}

		const result = super.checkForSimpleChains(boardState, currentDrop, 1);

		if(result !== -1) {
			col = result;
		}

		return { col, rotations };
	}
}

/**
 * TestCpu: ChainCPU, but instead of placing randomly it attempts to connect a colour.
 */
class TestCpu extends Cpu {
	constructor(settings, speed) {
		super(settings, speed);
	}

	getMove(boardState, currentDrop) {
		const averageHeight = super.getAverageHeight(boardState);
		const minChain = (averageHeight > this.settings.rows * 3 / 4) ? 0 :
			(averageHeight > this.settings.rows / 2) ? 2 :
				(averageHeight > this.settings.rows / 2) ? 3 : 4;

		let { col, rotations} = super.checkForAllChains(boardState, currentDrop, minChain);

		// Unable to find an appropriate chain
		if(col === -1) {
			let maxValue = -1;

			// Iterate through all possible columns and rotations
			for(let i = 0; i < this.settings.cols * 4; i++) {
				const currCol = i % this.settings.cols;
				const board = new Board(this.settings, boardState);
				let tempRotations;
				if(i < this.settings.cols) {
					board.boardState[currCol].push(currentDrop.colours[1]);
					board.boardState[currCol].push(currentDrop.colours[0]);
					tempRotations = 2;
				}
				else if(i < this.settings.cols * 2) {
					if(currCol === 0) {
						continue;
					}
					board.boardState[currCol - 1].push(currentDrop.colours[1]);
					board.boardState[currCol].push(currentDrop.colours[0]);
					tempRotations = -1;
				}
				else if(i < this.settings.cols * 3) {
					if(currCol === this.settings.cols - 1) {
						continue;
					}
					board.boardState[currCol].push(currentDrop.colours[0]);
					board.boardState[currCol + 1].push(currentDrop.colours[1]);
					tempRotations = 1;
				}
				else {
					board.boardState[currCol].push(currentDrop.colours[0]);
					board.boardState[currCol].push(currentDrop.colours[1]);
					tempRotations = 0;
				}

				// Deter from placing in column 2, as well as building skyscrapers
				const deterrent = (currCol === 2) ? boardState[2].length : this.getSkyScraperValue(board, currCol);
				const value = this.evaluateBoard(board) + (Math.random() * 2) - deterrent;

				if(value > maxValue) {
					col = currCol;
					maxValue = value;
					rotations = tempRotations;
				}
			}
		}

		// Still cannot find an appropriate placement, so place semi-randomly
		if(col === -1) {
			const allowedCols = [0, 5];
			for(let i = 0; i < this.settings.cols; i++) {
				if(i !== 0 && i !== this.settings.cols - 1) {
					if((boardState[i].length - boardState[i-1].length) + (boardState[i].length - boardState[i+1].length) < 3) {
						allowedCols.push(i);
					}
				}
			}

			col = allowedCols[Math.floor(Math.random() * allowedCols.length)];

			// Deter against random placements in column 2 (when 0-indexed)
			if(col === 2) {
				col = Math.floor(Math.random() * this.settings.cols);
			}
		}

		return { col, rotations };
	}

	/**
	 * Returns the skyscraper value (empirically determined) of a column.
	 */
	getSkyScraperValue(board, col) {
		const boardState = board.boardState;
		let value = 2 * boardState[col].length;
		if(col !== 0) {
			value -= boardState[col - 1].length;
		}
		if(col !== this.settings.cols - 1) {
			value -= boardState[col + 1].length;
		}
		return value / 2;
	}

	/**
	 * Returns the total "value" of the board (i.e. how connected the puyos are).
	 */
	evaluateBoard(board) {
		const connections = board.getConnections();
		let value = 0;

		connections.forEach(connection => {
			if(connection.length < 4) {
				value += connection.length * connection.length;
			}
			else if(connection.length > 4) {
				value += connection.length;
			}
		});

		return value;
	}
}

module.exports = {
	Cpu,
	RandomCpu,
	FlatCpu,
	TallCpu,
	ChainCpu,
	TestCpu
};
