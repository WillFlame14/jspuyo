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
		this.opponentIdToBoardDrawer = {};

		// Add a BoardDrawer for each opponent. CPU boards will draw themselves
		let opponentCounter = 2;
		this.opponentIds.forEach(id => {
			if(id > 0) {
				this.opponentBoardDrawers[id] = new BoardDrawer(this.settings, this.userSettings.appearance, opponentCounter);
				this.opponentIdToBoardDrawer[id] = opponentCounter;
			}
			opponentCounter++;
		});

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (gameId, boardHash, score, nuisance) => {
			// Do not need to use states from CPUs (since no player/cpu mix yet). Everything is handled on their own.
			if(!this.opponentIds.includes(gameId) || gameId < 0) {
				return;
			}
			if(frame === 0) {
				this.opponentBoardDrawers[gameId].drawFromHash(boardHash);
				frame = userSettings.skipFrames;
			}
			else{
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
		const pointsDisplayName = 'pointsDisplay' + this.opponentIdToBoardDrawer[gameId];
		const pointsDisplay = document.getElementById(pointsDisplayName);

		// Make sure element exists
		if(pointsDisplay) {
			pointsDisplay.innerHTML = `${score}`.padStart(8, '0');
		}
	}
}

module.exports = { PlayerGame };
