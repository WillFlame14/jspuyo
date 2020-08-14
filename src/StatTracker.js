'use strict';

const firstDropsTracked = 40;

class StatTracker {
	constructor(statsString = '{}') {
		const stats = JSON.parse(statsString);

		this.gamesTracked = stats.gamesTracked || 0;
		this.buildOrder = stats.buildOrder || [];
		this.chainScores = stats.chainScores || [];
		this.splitPuyos = stats.splitPuyos || { nonsplit: [], split: [] };
		this.gameResults = stats.winLose || { win: 0, loss: 0, undecided: 0 };

		this.runningScore = 0;
	}

	incrementGame() {
		this.gamesTracked++;
	}

	addDrop(dropNum, column1, column2, trueSplit) {
		// Do not track future drops
		if(dropNum > firstDropsTracked) {
			return;
		}

		if(this.buildOrder[dropNum] === undefined) {
			this.buildOrder[dropNum] = [];
		}

		this.buildOrder[dropNum][column1] = this.buildOrder[dropNum][column1] + 1 || 1;
		this.buildOrder[dropNum][column2] = this.buildOrder[dropNum][column2] + 1 || 1;

		if(column1 === column2 || !trueSplit) {
			this.splitPuyos.nonsplit[dropNum] = this.splitPuyos.nonsplit[dropNum] + 2 || 2;
		}
		else {
			this.splitPuyos.split[dropNum] = this.splitPuyos.split[dropNum] + 2 || 2;
		}
	}

	addScore(score) {
		this.runningScore += score;
	}

	finishChain(finalChainLength) {
		if(this.chainScores[finalChainLength] === undefined) {
			this.chainScores[finalChainLength] = [];
		}

		this.chainScores[finalChainLength].push(this.runningScore);
		this.runningScore = 0;
	}

	addResult(result) {
		this.gameResults[result]++;
	}

	toString() {
		return JSON.stringify(this);
	}
}

module.exports = { StatTracker };
