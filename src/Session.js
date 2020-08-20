'use strict';

const { showDialog } = require('./webpage/dialog.js');
const { PlayerInfo } = require('./webpage/firebase.js');

class Session {
	constructor(gameId, game, socket, roomId) {
		this.gameId = gameId;
		this.game = game;
		this.socket = socket;
		this.stopped = false;
		this.roomId = roomId;
	}

	run() {
		const main = () => {
			const mainFrame = window.requestAnimationFrame(main);

			if(this.stopped) {
				window.cancelAnimationFrame(mainFrame);
				this.finish('Disconnect');

				// Save stats since the game was forcefully disconnected
				this.game.statTracker.addResult('undecided');
				PlayerInfo.updateUser(this.gameId, 'stats', { [Date.now()]: this.game.statTracker.toString() }, false);
				return;
			}

			this.game.step();

			// Check end results
			const endResult = this.game.end();
			if(endResult !== null) {
				window.cancelAnimationFrame(mainFrame);
				this.finish(endResult);
				this.stopped = true;

				// Save stats
				PlayerInfo.updateUser(this.gameId, 'stats', { [Date.now()]: this.game.statTracker.toString() }, false);
				return;
			}
		};
		main();
	}

	finish(endResult) {
		switch(endResult) {
			case 'Win':
				console.log('You win!');
				this.socket.emit('gameEnd', this.roomId);
				break;
			case 'Loss':
				console.log('You lose...');
				this.socket.emit('gameOver', this.gameId);
				break;
			case 'OppDisconnect':
				console.log('Your opponent has disconnected. This match will be counted as a win.');
				this.socket.emit('gameEnd', this.roomId);
				break;
			case 'Disconnect':
				this.socket.emit('forceDisconnect', this.gameId, this.roomId);
				break;
			case 'Timeout':
				showDialog('You have been disconnected from the game due to connection timeout.');
				break;
		}
	}

	/**
	 * Forcefully stops the session (if it is still running). Called when a player navigates away from a game.
	 * Returns true if the force stop had an effect, and false if it did not.
	 */
	stop() {
		if(this.stopped) {
			return false;
		}
		else {
			this.stopped = true;
			return true;
		}
	}
}

module.exports = { Session };
