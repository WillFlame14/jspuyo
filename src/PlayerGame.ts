'use strict';

import { AudioPlayer } from './utils/AudioPlayer';
import { Game } from './Game';
import { GameArea } from './draw/GameArea';
import { InputManager } from './InputManager';
import { Settings, UserSettings } from './utils/Settings';

export class PlayerGame extends Game {
	inputManager: InputManager;
	opponentGameAreas: Record<string, GameArea>;
	opponentIdToCellId: Record<string, number>;

	constructor(
		gameId: string,
		opponentIds: string[],
		socket: SocketIOClient.Socket,
		settings: Settings,
		userSettings: UserSettings,
		gameAreas: Record<number, GameArea>,
		audioPlayer: AudioPlayer
	) {
		super(gameId, opponentIds, socket, settings, userSettings, 1, gameAreas[1]);

		let frame = 0;

		// Accepts inputs from player
		this.inputManager = new InputManager(this.userSettings);
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
		this.socket.off('sendState', undefined);
		this.socket.off('sendSound', undefined);
		this.socket.off('sendVoice', undefined);

		// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
		this.socket.on('sendState', (oppId: string, boardHash: string, score: number, nuisance: number) => {
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
	getInputs(): void {
		this.inputManager.executeKeys();
	}

	/**
	 * @Override
	 * Draws the board with the new hash after stepping.
	 */
	step(): string {
		const currentBoardHash = super.step();
		if(currentBoardHash) {
			this.gameArea.drawFromHash(currentBoardHash);
		}
		return currentBoardHash;
	}

	/**
	 * @Override
	 * Updates the score displayed on screen.
	 */
	updateVisibleScore(pointsDisplayName: string, score: number): void {
		document.getElementById(pointsDisplayName).innerHTML = `${score}`.padStart(8, '0');
	}

	/**
	 * Updates the score displayed on screen for opponents.
	 */
	updateOpponentScore(oppId: string, score: number): void {
		const pointsDisplayName = `pointsDisplay${this.opponentIdToCellId[oppId]}`;
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
export class SpectateGame extends Game {
	opponentGameAreas: Record<string, GameArea>;
	opponentIdToCellId: Record<string, number>;

	constructor(
		gameId: string,
		opponentIds: string[],
		socket: SocketIOClient.Socket,
		settings: Settings,
		userSettings: UserSettings,
		gameAreas: Record<number, GameArea>,
		audioPlayer: AudioPlayer
	) {
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
		this.audioPlayer.configureVolume(this.userSettings.sfxVolume, this.userSettings.musicVolume);

		// Reset the event listeners
		this.socket.off('sendState', undefined);
		this.socket.off('sendSound', undefined);
		this.socket.off('sendVoice', undefined);

		// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
		this.socket.on('sendState', (oppId: string, boardHash: string, score: number, nuisance: number) => {
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
	step(): string {
		return;
	}

	/**
	 * Updates the score for opponents.
	 */
	updateOpponentScore(oppId: string, score: number): void {
		const pointsDisplayName = `pointsDisplay${this.opponentIdToCellId[oppId]}`;
		const pointsDisplay = document.getElementById(pointsDisplayName);

		// Make sure element exists
		if(pointsDisplay) {
			pointsDisplay.innerHTML = `${score}`.padStart(8, '0');
		}
	}
}
