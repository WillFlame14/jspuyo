'use strict';

class Session {
	constructor(playerGame, cpuGames, roomId) {
		this.playerGame = playerGame;
		this.cpuGames = cpuGames;
		this.stopped = false;
		this.roomId = roomId;
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
			this.playerGame.game.step();
			this.cpuGames.forEach(cpuGame => cpuGame.game.step());

			// Check end results
			const endResult = this.playerGame.game.end();
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

	finish(endResult) {
		switch(endResult) {
			case 'Win':
				console.log('You win!');
				this.playerGame.socket.emit('gameEnd', this.playerGame.gameId, this.roomId);
				break;
			case 'Loss':
				console.log('You lose...');
				this.playerGame.socket.emit('gameOver', this.playerGame.gameId);
				break;
			case 'OppDisconnect':
				console.log('Your opponent has disconnected. This match will be counted as a win.');
				this.playerGame.socket.emit('gameEnd', this.playerGame.gameId, this.roomId);
				break;
			case 'Disconnect':
				console.log('Disconnected from the previous game. That match will be counted as a loss.')
				this.playerGame.socket.emit('gameEnd', this.playerGame.gameId, this.roomId);
				break;
		}
	}

	stop() {
		this.stopped = true;
	}
}

module.exports = { Session };
