'use strict';

import { Board } from '../Board';
import { Cpu, CpuMove } from './Cpu';
import { Drop } from '../Drop';
import { Settings } from '../utils/Settings';

export class CpuVariants {
	constructor() {
		throw new Error('CpuVariants cannot be instantiated.');
	}

	/**
	 * Creates a Cpu from its name.
	 * @param  {string} 	ai       The name of the Cpu variant
	 * @param  {Settings} 	settings The game settings
	 * @return {Cpu}             	The returned Cpu, TestCpu by default
	 */
	static fromString(ai: string, settings: Settings): Cpu {
		switch(ai.toLowerCase()) {
			case 'random':
				return new RandomCpu(settings);
			case 'flat':
				return new FlatCpu(settings);
			case 'tall':
				return new TallCpu(settings);
			case 'chain':
				return new ChainCpu(settings);
			default:
				return new TestCpu(settings);
		}
	}

	/**
	 * Returns all the names of currently available Cpus.
	 */
	static getAllCpuNames(): string[] {
		return [
			'Random',
			'Flat',
			'Tall',
			'Chain',
			'Test'
		];
	}
}

/**
 * RandomCpu: Completely random moves.
 */
class RandomCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	/**
	 * Returns the optimal move according to the AI.
	 * @param 	{number[][]} boardState  The current board state
	 * @param 	{Drop}       currentDrop The current drop
	 * @return 	{CpuMove}	             The optimal move as determined by the AI
	 */
	getMove(_boardState?: number[][], _currentDrop?: Drop): CpuMove {
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

	/**
	 * Returns the optimal move according to the AI.
	 * @param 	{number[][]} boardState  The current board state
	 * @param 	{Drop}       currentDrop The current drop
	 * @return 	{CpuMove}	             The optimal move as determined by the AI
	 */
	getMove(boardState: number[][], currentDrop: Drop): CpuMove {
		let col = 0;
		let rotations = 0;
		let minHeight = -1;

		for(let i = 0; i < this.settings.cols - 1; i++) {
			if(boardState[i].length < minHeight) {
				minHeight = boardState[i].length;
				col = i;
			}
		}

		const result = super.checkForSimpleChains(boardState, currentDrop, 1);

		if(result.col !== -1) {
			col = result.col;
			rotations = result.rotations;
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

	/**
	 * Returns the optimal move according to the AI.
	 * @param 	{number[][]} boardState  The current board state
	 * @param 	{Drop}       currentDrop The current drop
	 * @return 	{CpuMove}	             The optimal move as determined by the AI
	 */
	getMove(boardState: number[][], currentDrop: Drop): CpuMove {
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

	/**
	 * Returns the optimal move according to the AI.
	 * @param 	{number[][]} boardState  The current board state
	 * @param 	{Drop}       currentDrop The current drop
	 * @return 	{CpuMove}	             The optimal move as determined by the AI
	 */
	getMove(boardState: number[][], currentDrop: Drop): CpuMove {
		let col = Math.floor(Math.random() * this.settings.cols);
		let rotations = 0;

		// Deter against random placements in column 2 (when 0-indexed)
		while(col === 2) {
			col = Math.floor(Math.random() * this.settings.cols);
		}

		const result = super.checkForSimpleChains(boardState, currentDrop, 1);

		if(result.col !== -1) {
			col = result.col;
			rotations = result.rotations;
		}

		return { col, rotations };
	}
}

/**
 * TestCpu: ChainCPU, but instead of placing randomly it attempts to connect a colour.
 */
class TestCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	/**
	 * Returns the optimal move according to the AI.
	 * @param 	{number[][]} boardState  The current board state
	 * @param 	{Drop}       currentDrop The current drop
	 * @return 	{CpuMove}	             The optimal move as determined by the AI
	 */
	getMove(boardState: number[][], currentDrop: Drop): CpuMove {
		const averageHeight = super.getAverageHeight(boardState);
		const minChain = (averageHeight > this.settings.rows * 3 / 4) ? 0 :
						(averageHeight > this.settings.rows / 2) ? 2 :		// eslint-disable-line indent
						(averageHeight > this.settings.rows / 2) ? 3 : 4;	// eslint-disable-line indent

		let { col, rotations } = super.checkForAllChains(boardState, currentDrop, minChain);

		// Unable to find an appropriate chain
		if(col === -1) {
			let maxValue = -1;

			// Iterate through all possible columns and rotations
			for(let i = 0; i < this.settings.cols * 4; i++) {
				const currCol = i % this.settings.cols;
				const board = new Board(this.settings, boardState);
				const { boardState: currentBoardState } = board;
				let tempRotations: number;

				if(i < this.settings.cols) {
					currentBoardState[currCol].push(currentDrop.colours[1]);
					currentBoardState[currCol].push(currentDrop.colours[0]);
					tempRotations = 2;
				}
				else if(i < this.settings.cols * 2) {
					if(currCol === 0) {
						continue;
					}
					currentBoardState[currCol - 1].push(currentDrop.colours[1]);
					currentBoardState[currCol].push(currentDrop.colours[0]);
					tempRotations = -1;
				}
				else if(i < this.settings.cols * 3) {
					if(currCol === this.settings.cols - 1) {
						continue;
					}
					currentBoardState[currCol].push(currentDrop.colours[0]);
					currentBoardState[currCol + 1].push(currentDrop.colours[1]);
					tempRotations = 1;
				}
				else {
					currentBoardState[currCol].push(currentDrop.colours[0]);
					currentBoardState[currCol].push(currentDrop.colours[1]);
					tempRotations = 0;
				}

				// Deter from placing in column 2, as well as building skyscrapers
				const deterrent = (currCol === 2) ? boardState[2].length : this.getSkyScraperValue(currentBoardState, currCol);
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
}
