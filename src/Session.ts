'use strict';

import { Game } from './Game';
import { showDialog } from './webpage/dialog';
import { PlayerInfo } from './webpage/firebase';

export class Session {
	gameId: string;
	game: Game;
	socket: SocketIOClient.Socket;
	roomId: string;
	spectating: boolean;

	forceStop = false;
	stopped = false;

	constructor(gameId: string, game: Game, socket: SocketIOClient.Socket, roomId: string, spectating = false) {
		this.gameId = gameId;
		this.game = game;
		this.socket = socket;
		this.roomId = roomId;
		this.spectating = spectating;
	}

	run(): void {
		const main = () => {
			const mainFrame = window.requestAnimationFrame(main);

			if(this.forceStop) {
				window.cancelAnimationFrame(mainFrame);
				this.finish('Disconnect');

				// Save stats since the game was forcefully disconnected
				this.game.statTracker.addResult('undecided');
				PlayerInfo.updateUser(this.gameId, 'stats', { [Date.now()]: this.game.statTracker.toString() }, false);
				this.stopped = true;
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

	finish(endResult: string): void {
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
	stop(): Promise<boolean> {
		return new Promise((resolve) => {
			if(this.stopped) {
				resolve(false);
			}
			else {
				this.forceStop = true;

				const waitForStop = () => {
					if(this.stopped) {
						resolve(true);
					}
					else {
						setTimeout(waitForStop, 500);
					}
				};
				setTimeout(waitForStop, 500);
			}
		});
	}
}
