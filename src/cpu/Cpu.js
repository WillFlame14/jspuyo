'use strict';

const { Board } = require('../Board.js');
const { Utils } = require('../../src/utils/Utils.js');

class Cpu {
	constructor(settings) {
		if(this.constructor === Cpu) {
			throw new Error('Abstract class cannot be instantiated.');
		}
		this.settings = settings;
	}

	/**
	 * Returns the optimal move according to the AI.
	 */
	/* eslint-disable-next-line no-unused-vars */
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
	 * Returns the best column placement with either 0 or 2 rotations that makes a chain longer than or equal to minChain.
	 * If none exist, returns { col: -1, rotations: -1 }.
	 */
	checkForSimpleChains(boardState, currentDrop, minChain) {
		let runningMaxChain = minChain;
		let runningMaxScore = 0;
		let col = -1;
		let rotations = -1;

		for(let i = 0; i < this.settings.cols * 2; i++) {
			const currCol = Math.floor(i / 2);
			const board = new Board(this.settings, boardState);
			let tempRotations;

			if(i % 2 === 0) {
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
				tempRotations = 0;
			}
			else {
				board.boardState[currCol].push(currentDrop.colours[1]);
				board.boardState[currCol].push(currentDrop.colours[0]);
				tempRotations = 2;
			}

			const chains = board.resolveChains();
			let score = 0;
			chains.forEach((chained_puyos, index) => {
				score += Utils.calculateScore(chained_puyos, index + 1);
			});

			if(chains.length >= runningMaxChain && score > runningMaxScore) {
				runningMaxChain = chains.length;
				runningMaxScore = score;
				col = currCol;
				rotations = tempRotations;
			}
		}
		return { col, rotations };
	}

	/**
	 * Returns the move that results in the best chain longer than or equal to minChain.
	 * If none exist, returns { col: -1, rotations: -1 }.
	 */
	checkForAllChains(boardState, currentDrop, minChain) {
		let runningMaxChain = minChain;
		let runningMaxScore = 0;
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

			const chains = board.resolveChains();
			let score = 0;
			chains.forEach((chained_puyos, index) => {
				score += Utils.calculateScore(chained_puyos, index + 1);
			});

			if(chains.length >= runningMaxChain && score > runningMaxScore) {
				runningMaxChain = chains.length;
				runningMaxScore = score;
				col = currCol;
				rotations = tempRotations;
			}
		}
		return { col, rotations };
	}
}

module.exports = { Cpu };
