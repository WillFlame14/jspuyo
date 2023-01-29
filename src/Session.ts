'use strict';

import { Game } from './Game';

import { ServerToClientEvents, ClientToServerEvents } from './@types/events';
import { Socket } from 'socket.io-client';

export class Session {
	gameId: string;
	opponentIds: string[];
	game: Game;
	socket: Socket<ServerToClientEvents, ClientToServerEvents>;
	roomId: string;

	/** Flag to force the session to end immediately. */
	forceStop = false;

	stopped = false;
	paused = false;

	constructor(gameId: string, opponentIds: string[], game: Game, socket: Socket<ServerToClientEvents, ClientToServerEvents>, roomId: string) {
		this.gameId = gameId;
		this.opponentIds = opponentIds;
		this.game = game;
		this.socket = socket;
		this.roomId = roomId;

		this.initialize();
	}

	initialize(): void {
		this.socket.off('sendNuisance');
		this.socket.on('sendNuisance', (oppId, nuisance) => {
			this.sendNuisance(oppId, nuisance);
		});

		this.socket.off('activateNuisance');
		this.socket.on('activateNuisance', (oppId) => {
			this.activateNuisance(oppId);
		});

		this.socket.off('gameOver');
		this.socket.on('gameOver', (oppId, disconnect) => {
			this.opponentIds.splice(this.opponentIds.indexOf(oppId), 1);
			if(disconnect) {
				// Opponent lost due to disconnecting
			}
		});

		this.socket.off('winnerResult');
		this.socket.on('winnerResult', (winnerId) => {
			this.game.endResult = winnerId === this.gameId ? 'Win' : 'Loss';
			// Regardless of whether this player won, someone did, so win sfx should be played.
			setTimeout(() => this.game.audioPlayer.playAndEmitSfx('win'), 2000);
		});

		this.socket.off('pause');
		this.socket.on('pause', () => {
			this.paused = true;
		});

		this.socket.off('play');
		this.socket.on('play', () => {
			this.paused = false;
		});

		this.socket.off('timeout');
		this.socket.on('timeout', () => {
			this.game.endResult = 'Timeout';
		});
	}

	/**
	 * Starts the session by running requestAnimationFrame().
	 */
	run(): void {
		throw new Error('run() must be implemented by the child class!');
	}

	/**
	 * Called internally when the game has ended. Emits the corresponding response to the server.
	 * @param {string} endResult The result of the game.
	 */
	finish(endResult: string): void {
		switch(endResult) {
			case 'Win':
				//this.socket.emit('gameEnd', this.roomId);
				break;
			case 'Loss':
				this.socket.emit('gameOver', this.gameId);
				break;
			case 'OppDisconnect':
				//this.socket.emit('gameEnd', this.roomId);
				break;
			case 'Disconnect':
				this.socket.emit('forceDisconnect', this.gameId, this.roomId);
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

	sendNuisance(oppId: string, nuisance: number): void {
		this.game.receiveNuisance(oppId, nuisance);
	}

	activateNuisance(oppId: string): void {
		this.game.activateNuisance(oppId);
	}
}

export class CpuSession extends Session {
	timer: ReturnType<typeof setTimeout>;

	constructor(gameId: string, opponentIds: string[], game: Game, socket: Socket, roomId: string) {
		super(gameId, opponentIds, game, socket, roomId);
	}

	run(): void {
		// Called every "frame" to simulate the game loop
		const main = () => {
			if(this.forceStop) {
				clearTimeout(this.timer);
				this.stopped = true;
				return;
			}

			if(!this.paused) {
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

			const endResult = this.game.end();
			if(endResult !== null) {
				this.finish(endResult);
				this.stopped = true;
			}
			else {
				// If CPU game has not ended, recursively set a new timeout
				this.timer = setTimeout(main, 16.67);
			}
		};
		main();
	}
}
