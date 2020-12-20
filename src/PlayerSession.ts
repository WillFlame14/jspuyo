import { Game } from './Game';
import { PlayerInfo } from './webpage/firebase';
import { Session } from './Session';
import { showDialog } from './webpage/panels';

export class PlayerSession extends Session {
	spectating: boolean;

	constructor(gameId: string, opponentIds: string[], game: Game, socket: SocketIOClient.Socket, roomId: string, spectating = false) {
		super(gameId, opponentIds, game, socket, roomId);

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

			if(!this.paused) {
				const { currentBoardHash, score, nuisance, nuisanceSent } = this.game.step();

				if(currentBoardHash != null) {
					this.socket.emit('sendState', this.gameId, currentBoardHash, score, nuisance);
				}

				// Still nuisance left to send
				if(nuisanceSent !== undefined && nuisanceSent > 0) {
					this.socket.emit('sendNuisance', this.gameId, nuisanceSent);
				}
			}

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
		if (endResult === 'Timeout') {
			showDialog('You have been disconnected from the game due to connection timeout.');
		}
		else {
			super.finish(endResult);
		}
	}
}

export class Simulator extends Session {
	constructor(game: Game, socket: SocketIOClient.Socket) {
		super(null, [], game, socket, null);
	}

	run(): void {
		const main = () => {
			const mainFrame = window.requestAnimationFrame(main);

			if(this.forceStop) {
				window.cancelAnimationFrame(mainFrame);
				this.stopped = true;
				return;
			}

			if(!this.paused) {
				this.game.step();
			}

			// Check end results
			const endResult = this.game.end();
			if(endResult !== null) {
				window.cancelAnimationFrame(mainFrame);
				this.stopped = true;
			}
		};
		main();
	}

	finish(): void {
		// Do nothing on finish.
		return;
	}
}
