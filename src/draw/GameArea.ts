import { BoardLayer } from './BoardLayer';
import { Drop } from '../Drop';
import { CanvasLayer } from './GameDrawer';
import { NuisanceLayer } from './NuisanceLayer';
import { QueueLayer } from './PuyoDrawingLayer';
import { Settings } from '../utils/Settings';

import * as CONSTANTS from './DrawingConfig';

export class GameArea extends CanvasLayer {
	settings: Settings;
	appearance: string;
	boardLayer: BoardLayer;
	nuisanceLayer: NuisanceLayer;
	queueLayer: QueueLayer;
	simplified: boolean;

	constructor(settings: Settings, appearance: string, scaleFactor = 1, onNode = false) {
		super(
			CONSTANTS.DIMENSIONS.BOARD.W * scaleFactor + ((scaleFactor > CONSTANTS.DIMENSIONS.MIN_SCALE) ? (CONSTANTS.DIMENSIONS.MARGIN + CONSTANTS.DIMENSIONS.QUEUE.W * scaleFactor) : 0),
			CONSTANTS.DIMENSIONS.BOARD.H * scaleFactor + CONSTANTS.DIMENSIONS.MARGIN + CONSTANTS.DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor,
			onNode
		);
		this.settings = settings;
		this.appearance = appearance;
		this.boardLayer = new BoardLayer(settings, appearance, scaleFactor, onNode);
		this.nuisanceLayer = new NuisanceLayer(CONSTANTS.DIMENSIONS.NUISANCE_QUEUE.W * scaleFactor, CONSTANTS.DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor, appearance, onNode);
		this.queueLayer = new QueueLayer(CONSTANTS.DIMENSIONS.QUEUE.W * scaleFactor, CONSTANTS.DIMENSIONS.QUEUE.H * scaleFactor, CONSTANTS.DIMENSIONS.QUEUE.W * scaleFactor / 2, appearance, onNode);
		this.simplified = scaleFactor <= CONSTANTS.DIMENSIONS.MIN_SCALE;
	}

	update(): void {
		if (!this.onNode) {
			this.clear();
			this.ctx.drawImage(this.nuisanceLayer.canvas, 0, 0);
			this.ctx.drawImage(this.boardLayer.canvas, 0, this.nuisanceLayer.canvas.height + CONSTANTS.DIMENSIONS.MARGIN);
			if (!this.simplified) {
				this.ctx.drawImage(this.queueLayer.canvas, this.boardLayer.canvas.width + CONSTANTS.DIMENSIONS.MARGIN, 0);
			}
		}
	}

	getHash(): string {
		return JSON.stringify({
			boardObject: this.boardLayer.getStateObject(),
			nuisanceObject: this.nuisanceLayer.getStateObject(),
			queueObject: this.queueLayer.getStateObject()
		});
	}

	drawFromHash(hash: string): void {
		const stateObject = JSON.parse(hash) as GameHash;
		this.boardLayer.drawFromStateObject(stateObject.boardObject);
		this.nuisanceLayer.drawFromStateObject(stateObject.nuisanceObject);
		if (!this.simplified) {
			this.queueLayer.drawFromStateObject(stateObject.queueObject);
		}
		this.update();
	}

	updateBoard(currentBoardState: { connections: Puyo[][], currentDrop: Drop }): string {
		this.boardLayer.updateBoard(currentBoardState);
		this.update();
		return this.getHash();
	}

	squishPuyos(currentBoardState: { connections: Puyo[][], squishingPuyos: Puyo[] }, squishState: { currentFrame: number }): string {
		this.boardLayer.squishPuyos(currentBoardState, squishState);
		this.update();
		return this.getHash();
	}

	resolveChains(resolvingState: ResolvingState): string {
		this.boardLayer.resolveChains(resolvingState);
		this.update();
		return this.getHash();
	}

	dropNuisance(boardState: number[][], nuisanceState: NuisanceState): string {
		this.boardLayer.dropNuisance(boardState, nuisanceState);
		this.update();
		return this.getHash();
	}

	updateQueue(queueState: { dropArray: Drop[] }): string {
		this.queueLayer.updateQueue(queueState);
		this.update();
		return this.getHash();
	}

	updateNuisance(nuisance: number): string {
		this.nuisanceLayer.updateNuisance(nuisance);
		this.update();
		return this.getHash();
	}
}
