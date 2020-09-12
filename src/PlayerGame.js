'use strict';

const { Game } = require('./Game.js');
const { InputManager } = require('./InputManager.js');

class PlayerGame extends Game {
	constructor(gameId, opponentIds, socket, settings, userSettings, gameAreas, audioPlayer) {
		super(gameId, opponentIds, socket, settings, userSettings, 1, gameAreas[1]);

		let frame = 0;

		// Accepts inputs from player
		this.inputManager = new InputManager(this.userSettings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('Move', this.move.bind(this));
		this.inputManager.on('Rotate', this.rotate.bind(this));
		this.opponentGameAreas = {};
		this.opponentIdToCellId = {};

		// Associate a GameArea to each opponent
		let opponentCounter = 2;
		this.opponentIds.forEach(id => {
			this.opponentGameAreas[id] = gameAreas[opponentCounter];
			this.opponentIdToCellId[id] = opponentCounter;
			opponentCounter++;
		});

		this.audioPlayer = audioPlayer;
		this.audioPlayer.assignGameId(this.gameId);

		// Reset the event listeners
		this.socket.off('sendState');
		this.socket.off('sendSound');
		this.socket.off('sendVoice');

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (oppId, boardHash, score, nuisance) => {
			if(frame === 0) {
				this.opponentGameAreas[oppId].drawFromHash(boardHash);
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
	 * @Override
	 * Draws the board with the new hash after stepping.
	 */
	step() {
		const currentBoardHash = super.step();
		if(currentBoardHash) {
			this.gameArea.drawFromHash(currentBoardHash);
		}
	}

	/**
	 * @Override
	 * Updates the score displayed on screen.
	 */
	updateVisibleScore(pointsDisplayName, score) {
		document.getElementById(pointsDisplayName).innerHTML = `${score}`.padStart(8, '0');
	}

	/**
	 * Updates the score displayed on screen for opponents.
	 */
	updateOpponentScore(oppId, score) {
		const pointsDisplayName = 'pointsDisplay' + this.opponentIdToCellId[oppId];
		const pointsDisplay = document.getElementById(pointsDisplayName);

		// Make sure element exists
		if(pointsDisplay) {
			pointsDisplay.innerHTML = `${score}`.padStart(8, '0');
		}
	}
}

/**
 * SpectateGame: Only interacts from opponent boards, does not create a board or register inputs for the player.
 */
class SpectateGame extends Game {
	constructor(gameId, opponentIds, socket, settings, userSettings, gameAreas, audioPlayer) {
		super(gameId, opponentIds, socket, settings, userSettings);

		let frame = 0;
		this.opponentGameAreas = {};
		this.opponentIdToCellId = {};

		// Associate a GameArea to each opponent
		let opponentCounter = 1;
		this.opponentIds.forEach(id => {
			this.opponentGameAreas[id] = gameAreas[opponentCounter];
			this.opponentIdToCellId[id] = opponentCounter;
			opponentCounter++;
		});

		this.audioPlayer = audioPlayer;
		this.audioPlayer.configure(this.gameId, this.userSettings.sfxVolume, this.userSettings.musicVolume);

		// Reset the event listeners
		this.socket.off('sendState');
		this.socket.off('sendSound');
		this.socket.off('sendVoice');

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (oppId, boardHash, score, nuisance) => {
			if(frame === 0) {
				this.opponentGameAreas[oppId].drawFromHash(boardHash);
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
		const pointsDisplayName = 'pointsDisplay' + this.opponentIdToCellId[oppId];
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
