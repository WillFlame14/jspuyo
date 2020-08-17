'use strict';

const FIRST_DROPS_TRACKED = 50;

class StatTracker {
	constructor(statsString = '{}') {
		const stats = JSON.parse(statsString);

		this.gamesTracked = stats.gamesTracked || 0;
		this.buildOrder = stats.buildOrder || [...new Array(FIRST_DROPS_TRACKED)].map(() => new Array(6).fill(0));
		this.buildSpeed = stats.buildSpeed || [...new Array(FIRST_DROPS_TRACKED)].map(() => []);
		this.chainScores = stats.chainScores || [...new Array(19)].map(() => []);
		this.splitPuyos = stats.splitPuyos || [...new Array(FIRST_DROPS_TRACKED)].map(() => {return { split: 0, nonsplit: 0 };});
		this.finesse = stats.finesse || {};
		this.gameResults = stats.gameResults || { win: 0, loss: 0, undecided: 0 };

		this.runningScore = 0;
		this.framesOfLastDrop = null;
		this.runningFinesse = {};
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
			if(this.runningFinesse[finesseFault] === undefined) {
				this.runningFinesse[finesseFault] = 0;
			}
			else {
				this.runningFinesse[finesseFault]++;
			}
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
		this.gameResults[result]++;
		this.gamesTracked++;
		this.finesse[Date.now()] = this.runningFinesse;
		this.runningFinesse = {};
	}

	toString() {
		return JSON.stringify(this);
	}
}

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
