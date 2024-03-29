import { ServerToClientEvents, ClientToServerEvents } from './@types/events';
import { Socket } from 'socket.io-client';

import { Game } from './Game';
import { PlayerInfo } from './webpage/firebase';
import { Session } from './Session';
import { showDialog } from './webpage/panels';

type CSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let last_frame_drawn = false;

export class PlayerSession extends Session {
	spectating: boolean;

	constructor(gameId: string, opponentIds: string[], game: Game, socket: CSocket, roomId: string, spectating = false) {
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

			if(!this.paused && !this.spectating) {
				const { currentBoardHash, score, nuisance, nuisanceSent, activateNuisance } = this.game.step();

				if(currentBoardHash != null) {
					this.socket.emit('sendState', this.gameId, currentBoardHash, score, nuisance);
				}

				// Still nuisance left to send
				if(nuisanceSent !== undefined && nuisanceSent > 0) {
					this.socket.emit('sendNuisance', this.gameId, nuisanceSent);
				}

				if(activateNuisance) {
					this.socket.emit('activateNuisance', this.gameId);
				}
			}

			// Check end results
			const endResult = this.game.end();
			if(endResult !== null && last_frame_drawn) {
				window.cancelAnimationFrame(mainFrame);
				this.finish(endResult);
				this.stopped = true;
				last_frame_drawn = false;

				// Save stats
				PlayerInfo.updateUser(this.gameId, 'stats', { [Date.now()]: this.game.statTracker.toString() }, false);
				return;
			}
			else if (endResult !== null) {
				last_frame_drawn = true;
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
	constructor(game: Game, socket: CSocket) {
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
