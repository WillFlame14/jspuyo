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
		this.gameResults = stats.gameResults || { win: 0, loss: 0, undecided: 0 };

		this.runningScore = 0;
		this.framesOfLastDrop = null;
	}

	addDrop(dropNum, currentFrame, column1, column2, trueSplit) {
		// Do not track future drops
		if(dropNum >= FIRST_DROPS_TRACKED) {
			return;
		}

		if(dropNum === 1) {
			this.framesOfLastDrop = currentFrame;
		}
		else {
			this.buildSpeed[dropNum].push(currentFrame - this.framesOfLastDrop);
			this.framesOfLastDrop = currentFrame;
		}

		this.buildOrder[dropNum][column1]++;
		this.buildOrder[dropNum][column2]++;

		if(column1 === column2 || !trueSplit) {
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
	}

	toString() {
		return JSON.stringify(this);
	}
}

module.exports = { StatTracker };
