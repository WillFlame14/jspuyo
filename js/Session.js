'use strict';

class Session {
	constructor(playerGame, cpuGames, finishCallback) {
		this.playerGame = playerGame;
		this.cpuGames = cpuGames;
		this.finish = finishCallback;
		this.stopped = false;
	}

	run() {
		const main = () => {
			let mainFrame =  window.requestAnimationFrame(main);

			if(this.stopped) {
				window.cancelAnimationFrame(mainFrame);
				this.finish('Disconnect');
				return;
			}

			// Step for all games
			this.playerGame.step();
			this.cpuGames.forEach(cpuGame => cpuGame.game.step());

			// Check end results
			const endResult = this.playerGame.end();
			if(endResult !== null) {
				window.cancelAnimationFrame(mainFrame);
				this.finish(endResult);
				return;
			}
			this.cpuGames.forEach(cpuGame => {
				const cpuEndResult = cpuGame.game.end();
				if(cpuEndResult !== null) {
					switch(cpuEndResult) {
						case 'Win':
							cpuGame.socket.emit('gameEnd', cpuGame.id);
							break;
						case 'Loss':
							cpuGame.socket.emit('gameOver', cpuGame.id);
							break;
						case 'OppDisconnect':
							// finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
							break;
					}
					// Set the game to be removed
					cpuGame.remove = true;
				}
			});
			this.cpuGames = this.cpuGames.filter(cpuGame => !cpuGame.remove);
		}
		main();
	}

	stop() {
		this.stopped = true;
	}
}

module.exports = { Session };