import type { Game, GameState } from '../Game';

export class NuisanceDroppingState implements GameState {
	name = 'NuisanceDropping';
	game: Game;

	landFrames: number;
	nuisanceAmount: number;
	nuisanceArray: number[][];
	velocities: number[];
	positions: number[];

	constructor(game: Game) {
		this.game = game;
	}

	enter(nuisanceAmount: number, nuisanceArray: number[][]) {
		this.nuisanceAmount = nuisanceAmount;
		this.nuisanceArray = nuisanceArray;

		const { nuisanceInitialSpeed, nuisanceSpawnRow } = this.game.settings;

		this.velocities = [];
		this.positions = [];

		nuisanceArray.forEach((nuisance, index) => {
			this.velocities[index] = nuisance.length === 0 ? -1 : nuisanceInitialSpeed;
			this.positions[index] = nuisance.length === 0 ? -1 : nuisanceSpawnRow;
		});

		this.landFrames = 0;
		return this;
	}

	step() {
		const { audioPlayer, board, gameArea } = this.game;
		const { cols, nuisanceAcceleration, nuisanceLandFrames, terminalVelocity } = this.game.settings;

		const boardHash = gameArea.dropNuisance(board.boardState, this.nuisanceArray, this.positions);

		// Affect gravity
		for(let i = 0; i < cols; i++) {
			// Will be -1 if there is no nuisance puyos in this column, so continue
			if(this.positions[i] !== -1) {
				this.positions[i] -= this.velocities[i];

				// Increase velocity, but not beyond the terminal velocity
				this.velocities[i] = Math.min(this.velocities[i] + (nuisanceAcceleration[i] ?? 0.015 + Math.random() * 0.005), terminalVelocity);
			}
		}

		const allLanded = this.positions.every((height, index) => height <= board.boardState[index].length);

		// Once done falling, play SFX
		if(allLanded) {
			if(this.landFrames === 0) {
				if(this.nuisanceAmount >= cols * 2) {
					audioPlayer.playAndEmitSfx('nuisance_fall', 1);
				}
				else {
					if(this.nuisanceAmount > cols) {
						audioPlayer.playAndEmitSfx('nuisance_fall', 0);
						setTimeout(() => audioPlayer.playAndEmitSfx('nuisance_fall', 0), 300);
					}
					if(this.nuisanceAmount > 0) {
						audioPlayer.playAndEmitSfx('nuisance_fall', 0);
					}
				}
			}
			this.landFrames++;
		}

		// Finished dropping nuisance
		if (this.landFrames >= nuisanceLandFrames) {
			this.game.activeNuisance -= this.nuisanceAmount;

			// Add the nuisance to the stack
			for(let i = 0; i < cols; i++) {
				board.boardState[i] = board.boardState[i].concat(this.nuisanceArray[i]);
			}
			this.game.gameState = this.game.states.QueueShiftingState.enter();
		}

		return { boardHash };
	}
}
