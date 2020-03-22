'use strict';

window.PlayerGame = class PlayerGame extends window.Game {
	constructor(gamemode, gameId, opponentIds, socket, settings) {
		super(gamemode, gameId, opponentIds, socket, 1, settings);

		this.inputManager = new window.InputManager(this.settings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('Move', this.move.bind(this));
		this.inputManager.on('Rotate', this.rotate.bind(this));
		this.opponentBoardDrawers = {};

		// Add a BoardDrawer for each opponent. CPU boards will draw themselves
		let opponentCounter = 1;
		this.opponentIds.forEach(id => {
			if(id > 0) {
				this.opponentBoardDrawers[id] = new window.BoardDrawer(this.settings, opponentCounter + 1);
			}
			opponentCounter++;
		});

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (gameId, boardHash, score, nuisance) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.opponentBoardDrawers[gameId].drawFromHash(boardHash);
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

	updateOpponentScore(gameId, score) {
		const pointsDisplayName = 'pointsDisplay' + '2';
		document.getElementById(pointsDisplayName).innerHTML = "Score: " + score;
	}
}
