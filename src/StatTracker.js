'use strict';

const FIRST_DROPS_TRACKED = 50;

class StatTracker {
	constructor() {
		this.buildOrder = [...new Array(FIRST_DROPS_TRACKED)].map(() => new Array(6).fill(0));
		this.buildSpeed = [...new Array(FIRST_DROPS_TRACKED)].map(() => []);
		this.chainScores = [...new Array(19)].map(() => []);
		this.splitPuyos = [...new Array(FIRST_DROPS_TRACKED)].map(() => {return { split: 0, nonsplit: 0 };});
		this.finesse = {};
		this.gameResult = null;

		this.runningScore = 0;
		this.framesOfLastDrop = null;
	}

	addDrop(dropNum, currentFrame, movements, arleCol, schezoCol, trueSplit) {
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

	addScore(score) {
		this.runningScore += score;
	}

	finishChain(finalChainLength) {
		this.chainScores[finalChainLength].push(this.runningScore);
		this.runningScore = 0;
	}

	addResult(result) {
		this.gameResult = result;
	}

	toString() {
		return JSON.stringify(this);
	}
}

/**
 * Determines if a finesse fault was performed during the placement of the drop. Only works with the normal board.
 * @param  	{array}		movements 	The list of moves and rotations performed in chronological order.
 * @param  	{number}	arleCol   	The column (0-indexed) or the arle puyo
 * @return 	{string}           		The name of the finesse fault, or null if none were performed.
 */
function checkFinesse(movements, arleCol) {
	const rotations = [];
	const moves = [];
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

module.exports = { StatTracker };
