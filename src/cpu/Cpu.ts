'use strict';

import { Board } from '../Board';
import { Drop } from '../Drop';
import { Settings } from '../utils/Settings';
import * as Utils from '../utils/Utils';

export interface CpuMove {
	col: number,
	rotations: number
}

export class Cpu {
	settings: Settings;

	/**
	 * Abstract constructor for Cpu class. Should be inherited by a Cpu variant class.
	 * @param {Settings} settings The game settings for the Cpu
	 */
	constructor(settings: Settings) {
		if(this.constructor === Cpu) {
			throw new Error('Abstract class cannot be instantiated.');
		}
		this.settings = settings;
	}

	/**
	 * Returns the optimal move according to the AI.
	 * @param 	{number[][]} boardState  The current board state
	 * @param 	{Drop}       currentDrop The current drop
	 * @return 	{CpuMove}	             The optimal move as determined by the AI
	 */
	getMove(_boardState?: number[][], _currentDrop?: Drop): CpuMove {
		throw new Error('getMove(boardState, currentDrop) must be implemented by the subclass.');
	}

	/**
	 * Returns the average height of all the columns.
	 */
	getAverageHeight(boardState: number[][]): number {
		return boardState.reduce((sum, col) => sum += col.length, 0) / this.settings.cols;
	}

	/**
	 * Returns the "skyscraper value" of a column (i.e. how tall it is compared to its neighbours).
	 * Ranges from 0 (same height) to twice the column's height (perfect skyscraper).
	 * @param  {number[][]} boardState The current board state
	 * @param  {number}     col        The column to be measured
	 * @return {number}                The calculated skyscraper value
	 */
	getSkyScraperValue(boardState: number[][], col: number): number {
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
	 * @param  {Board}  board The current board
	 * @return {number}       The calculated value of the board
	 */
	evaluateBoard(board: Board): number {
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

	/**
	 * Finds the best column placement using only 0 or 2 rotations (drop will always be placed vertically).
	 * @param  {number[][]} boardState  The current board state
	 * @param  {Drop}       currentDrop The current drop
	 * @param  {number}     minChain    The minimum chain length
	 * @return {CpuMove}                The optimal move, otherwise{ col: -1, rotations: -1 } if none can be found
	 */
	checkForSimpleChains(boardState: number[][], currentDrop: Drop, minChain: number): CpuMove {
		let runningMaxChain = minChain;
		let runningMaxScore = 0;
		let col = -1;
		let rotations = -1;

		for(let i = 0; i < this.settings.cols * 2; i++) {
			const currCol = Math.floor(i / 2);
			const board = new Board(this.settings, boardState);
			let tempRotations: number;

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
	 * Finds the best column placement using all 4 rotation possibilities.
	 * If none exist, returns { col: -1, rotations: -1 }.
	 * @param  {number[][]} boardState  The current board state
	 * @param  {Drop}       currentDrop The current drop
	 * @param  {number}     minChain    The minimum chain length
	 * @return {CpuMove}                The optimal move, otherwise { col: -1, rotations: -1 } if none can be found
	 */
	checkForAllChains(boardState: number[][], currentDrop: Drop, minChain: number): CpuMove {
		let runningMaxChain = minChain;
		let runningMaxScore = 0;
		let col = -1;
		let rotations = -1;

		for(let i = 0; i < this.settings.cols * 4; i++) {
			const currCol = i % this.settings.cols;
			const board = new Board(this.settings, boardState);
			let tempRotations: number;

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
