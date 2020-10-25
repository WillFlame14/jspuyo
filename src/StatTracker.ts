'use strict';

const FIRST_DROPS_TRACKED = 50;

export interface SplitData {
	split: number,
	nonsplit: number
}

/**
 * Saves statistics for each game. Currently only works for the standard board under Tsu rule.
 */
export class StatTracker {
	/** Array of column placement occurrences, indexed in a larger array based on the drop ordinance. */
	buildOrder: number[][];

	/** Array of frames to place current drop, indexed in a larger array based on the drop ordinance. */
	buildSpeed: number[][];

	/** Scores earned for a chain, indexed in a larger array based on the chain length. */
	chainScores: number[][];

	/** Number of drops that were split and not split, indexed in a larger array based on the drop ordinance.*/
	splitPuyos: SplitData[];

	/** Object with keys being finesse faults and values being the number of times they were performed in this game. */
	finesse: Record<string, number> = {};

	/** Final result of the game. Null if the game has not yet ended. */
	gameResult: string = null;

	private runningScore = 0;
	framesOfLastDrop: number = null;

	constructor() {
		this.buildOrder = [...new Array<number>(FIRST_DROPS_TRACKED)].map(() => new Array<number>(6).fill(0));
		this.buildSpeed = [...new Array<number>(FIRST_DROPS_TRACKED)].map(() => [] as number[]);
		this.chainScores = [...new Array<number>(19)].map(() => [] as number[]);
		this.splitPuyos = [...new Array<number>(FIRST_DROPS_TRACKED)].map(() => {return { split: 0, nonsplit: 0 };});
	}

	/**
	 * Adds a new drop to the stat tracker for this game. Called after a drop locks into place.
	 * @param {number}   dropNum      The ordinance of this drop
	 * @param {number}   currentFrame The number of frames since the start of the game
	 * @param {string[]} movements    The movements performed on the drop
	 * @param {number}   arleCol      The column that the arle puyo is in
	 * @param {number}   schezoCol    The column that the schezo puyo is in
	 * @param {[type]}   trueSplit    Whether the puyos split and one of them fell separately (false by default)
	 */
	addDrop(dropNum: number, currentFrame: number, movements: string[], arleCol: number, schezoCol: number, trueSplit = false): void {
		// Do not track future drops
		if(dropNum >= FIRST_DROPS_TRACKED) {
			return;
		}

		// Calculate frames between each drop
		if(dropNum === 1) {
			this.framesOfLastDrop = currentFrame;
		}
		else {
			this.buildSpeed[dropNum].push(currentFrame - this.framesOfLastDrop);
			this.framesOfLastDrop = currentFrame;
		}

		// Check if finesse fault
		const finesseFault = checkFinesse(movements, arleCol);

		if(finesseFault) {
			if(this.finesse[finesseFault] === undefined) {
				this.finesse[finesseFault] = 0;
			}
			this.finesse[finesseFault]++;
		}

		// Add to build order
		this.buildOrder[dropNum][arleCol]++;
		this.buildOrder[dropNum][schezoCol]++;

		// Add to split data
		if(arleCol === schezoCol || !trueSplit) {
			this.splitPuyos[dropNum].nonsplit++;
		}
		else {
			this.splitPuyos[dropNum].split++;
		}
	}

	addScore(score: number): void {
		this.runningScore += score;
	}

	finishChain(finalChainLength: number): void {
		this.chainScores[finalChainLength].push(this.runningScore);
		this.runningScore = 0;
	}

	addResult(result: string): void {
		this.gameResult = result;
	}

	toString(): string {
		return JSON.stringify(this);
	}
}

/**
 * Determines if a finesse fault was performed during the placement of the drop. Only works with the normal board.
 * @param  	{string[]}	movements 	The list of moves and rotations performed in chronological order.
 * @param  	{number}	arleCol   	The column (0-indexed) or the arle puyo
 * @return 	{string}           		The name of the finesse fault, or null if none were performed.
 */
function checkFinesse(movements: string[], arleCol: number): string {
	const rotations: string[] = [];
	const moves: string[] = [];
	let das = false;

	movements.forEach(mov => {
		if(mov.includes('DAS')) {
			das = true;
		}

		if(mov === 'CW' || mov === 'CCW') {
			rotations.push(mov);
		}
		else {
			moves.push(mov);
		}
	});

	if(rotations.length > 2) {
		return 'Excess Rotation';
	}

	if(moves.length > 3 || (moves.length === 3 && arleCol !== 5)) {
		return 'Excess Movement';
	}
	else if(moves.length > Math.abs(2 - arleCol)) {
		return 'Excess Movement';
	}

	if(rotations.length === 2 && rotations.includes('CW') && rotations.includes('CCW')) {		// must be vertical
		if(arleCol !== 1 && arleCol !== 4) {
			return 'Excess Rotation';
		}

		if(arleCol === 1 && movements.indexOf('CCW') > 1) {
			return 'Missed Wall Kick';
		}
		if(arleCol === 4) {
			if(movements.indexOf('CW') > 1) {
				return 'Missed Wall Kick';
			}
			if(!das) {
				return 'Missed DAS Wall Kick';
			}
		}
	}

	if((arleCol === 0 || arleCol === 5) && !das) {
		return 'Missed DAS';
	}

	return null;
}
