'use strict';

window.PlayerGame = class PlayerGame extends window.Game {
	constructor(gamemode, gameId, opponentIds, socket, settings) {
		super(gamemode, gameId, opponentIds, socket, 1, settings);

		this.inputManager = new window.InputManager(this.settings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('Move', this.move.bind(this));
		this.inputManager.on('Rotate', this.rotate.bind(this));
		this.opponentBoardDrawers = {};

		// Add a HashedBoardDrawer for each opponent. CPU boards will draw themselves
		// eslint-disable-next-line no-unused-vars
		let opponentCounter = 1;
		this.opponentIds.forEach(id => {
			if(id > 0) {
				// this.opponentBoardDrawers[id] = new window.HashedBoardDrawer(opponentCounter + 1);
			}
			opponentCounter++;
		});
	}

	/**
	 * @Override
	 * Executes the InputManager for the game.
	 */
	getInputs() {
		this.inputManager.executeKeys();
	}
}
