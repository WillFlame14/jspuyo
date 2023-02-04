import type { Game, GameState } from '../Game';

export class PuyoDroppingSplitState implements GameState {
	name = 'PuyoDroppingSplit';
	game: Game;
	fallingVelocity: number;

	constructor(game: Game) {
		this.game = game;
	}

	enter() {
		this.fallingVelocity = this.game.settings.splitPuyoInitialSpeed;
		return this;
	}

	step() {
		const { board, currentDrop, gameArea, settings } = this.game;

		const { boardState } = board;
		const { arle, schezo } = currentDrop;
		const { splitPuyoAcceleration, terminalVelocity } = settings;

		const arleDropped = arle.y <= boardState[arle.x].length;
		const schezoDropped = schezo.y <= boardState[schezo.x].length;

		const puyo = arleDropped ? schezo : arle;

		// Translate puyo (without going into the stack)
		puyo.y = Math.max(puyo.y - this.fallingVelocity, boardState[puyo.x].length);

		// Affect gravity (without surpassing terminal velocity)
		this.fallingVelocity = Math.min(this.fallingVelocity + splitPuyoAcceleration, terminalVelocity);

		const currentBoardState = { connections: board.getConnections(), currentDrop };
		const boardHash = gameArea.updateBoard(currentBoardState);

		// TODO: need to trim board??
		if (arleDropped && schezoDropped) {
			this.game.gameState = this.game.states.PuyoSquishingState.enter();
		}

		return { boardHash };
	}
}
