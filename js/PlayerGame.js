'use strict';

const { BoardDrawer } = require('./BoardDrawer');
const { Game } = require('./Game.js');
const { InputManager } = require('./InputManager.js');

class PlayerGame extends Game {
	constructor(gameId, opponentIds, socket, settings, userSettings) {
		super(gameId, opponentIds, socket, 1, settings, userSettings);

		let frame = 0;

		// Accepts inputs from player
		this.inputManager = new InputManager(this.userSettings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('Move', this.move.bind(this));
		this.inputManager.on('Rotate', this.rotate.bind(this));
		this.opponentBoardDrawers = {};

		// Add a BoardDrawer for each opponent. CPU boards will draw themselves
		let opponentCounter = 1;
		this.opponentIds.forEach(id => {
			if(id > 0) {
				this.opponentBoardDrawers[id] = new BoardDrawer(this.settings, opponentCounter + 1);
			}
			opponentCounter++;
		});

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (gameId, boardHash, score, nuisance) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			if(gameId > 0 && frame === 0) {
				this.opponentBoardDrawers[gameId].drawFromHash(boardHash);
				frame = userSettings.skipFrames;
			}
			else if (gameId > 0) {
				frame--;
			}
			this.updateOpponentScore(gameId, score);
		});

		this.socket.on('sendSound', (gameId, sfx_name, index) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.audioPlayer.playSfx(sfx_name, index);
		});
	}

	/**
	 * @Override
	 * Executes the InputManager for the game.
	 */
	getInputs() {
		this.inputManager.executeKeys();
	}

	/**
	 * Updates the score for opponents.
	 */
	updateOpponentScore(gameId, score) {
		const pointsDisplayName = 'pointsDisplay' + '2';
		document.getElementById(pointsDisplayName).innerHTML = "Score: " + score;
	}
}

module.exports = { PlayerGame };
