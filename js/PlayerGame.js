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

		// Reset the event listeners
		this.socket.off('sendState');
		this.socket.off('sendSound');
		this.socket.off('sendVoice');

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (oppId, boardHash, score, nuisance) => {
			// Do not need to use states from CPUs (since no player/cpu mix yet). Everything is handled on their own.
			if(oppId < 0) {
				return;
			}
			if(frame === 0) {
				this.opponentBoardDrawers[oppId].drawFromHash(boardHash);
				frame = userSettings.skipFrames;
			}
			else{
				frame--;
			}
			this.updateOpponentScore(oppId, score);
		});

		this.socket.on('sendSound', (oppId, sfx_name, index) => {
			this.audioPlayer.playSfx(sfx_name, index);
		});

		this.socket.on('sendVoice', (oppId, character, audio_name, index) => {
			this.audioPlayer.playVoice(character, audio_name, index);
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
	updateOpponentScore(oppId, score) {
		const pointsDisplayName = 'pointsDisplay' + this.opponentIdToBoardDrawer[oppId];
		const pointsDisplay = document.getElementById(pointsDisplayName);

		// Make sure element exists
		if(pointsDisplay) {
			pointsDisplay.innerHTML = `${score}`.padStart(8, '0');
		}
	}
}

class SpectateGame extends Game {
	constructor(gameId, opponentIds, socket, settings, userSettings) {
		super(gameId, opponentIds, socket, 1, settings, userSettings);

		let frame = 0;
		this.opponentBoardDrawers = {};
		this.opponentIdToBoardDrawer = {};

		// Add a BoardDrawer for each opponent.
		let opponentCounter = 1;
		this.opponentIds.forEach(id => {
			this.opponentBoardDrawers[id] = new BoardDrawer(this.settings, this.userSettings.appearance, opponentCounter);
			this.opponentIdToBoardDrawer[id] = opponentCounter;
			opponentCounter++;
		});

		// Reset the event listeners
		this.socket.off('sendState');
		this.socket.off('sendSound');
		this.socket.off('sendVoice');

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (oppId, boardHash, score, nuisance) => {
			if(frame === 0) {
				this.opponentBoardDrawers[oppId].drawFromHash(boardHash);
				frame = userSettings.skipFrames;
			}
			else{
				frame--;
			}
			this.updateOpponentScore(oppId, score);
		});

		this.socket.on('sendSound', (oppId, sfx_name, index) => {
			this.audioPlayer.playSfx(sfx_name, index);
		});

		this.socket.on('sendVoice', (oppId, character, audio_name, index) => {
			this.audioPlayer.playVoice(character, audio_name, index);
		});
	}

	/**
	 * @Override
	 * Increments the game. Since player is spectating, do nothing.
	 */
	step() {
		return;
	}

	/**
	 * Updates the score for opponents.
	 */
	updateOpponentScore(oppId, score) {
		const pointsDisplayName = 'pointsDisplay' + this.opponentIdToBoardDrawer[oppId];
		const pointsDisplay = document.getElementById(pointsDisplayName);

		// Make sure element exists
		if(pointsDisplay) {
			pointsDisplay.innerHTML = `${score}`.padStart(8, '0');
		}
	}
}

module.exports = {
	PlayerGame,
	SpectateGame
};
