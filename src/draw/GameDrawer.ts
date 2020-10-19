'use strict';

import * as SpriteDrawer from './Draw';
import * as CONSTANTS from './DrawingConfig';

export class CanvasLayer {
	onNode: boolean;
	width: number;
	height: number;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor(width: number, height: number, onNode = false, className: string = undefined) {
		this.onNode = onNode;
		this.width = width;
		this.height = height;
		if (!this.onNode) {
			this.canvas = document.createElement('canvas');
			this.canvas.width = width;
			this.canvas.height = height;
			if (className) {
				this.canvas.className = className;
			}
			this.ctx = this.canvas.getContext('2d');
		}
	}
	clear(): void {
		if (!this.onNode) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}
}

export class DrawingLayer extends CanvasLayer {
	unit: number;
	objectsDrawn: OptionalDrawingArgs[];
	drawingState: number;
	defaultArgs: OptionalDrawingArgs;

	constructor(width: number, height: number, unit: number, onNode: boolean, className: string = undefined) {
		super(width, height, onNode, className);
		this.unit = unit;
		this.objectsDrawn = [];
		this.drawingState = 0;
		this.defaultArgs = {} as OptionalDrawingArgs;
	}

	drawFromArgs(drawingArgs: OptionalDrawingArgs): void {
		if (!this.onNode) {
			const args = Object.assign({ ctx: this.ctx }, this.defaultArgs, drawingArgs) as DrawingArgs;

			// Resize the sprite
			args.size *= this.unit;
			args.dX *= this.unit;
			args.dY *= this.unit;

			void SpriteDrawer.drawSprite(args);
		}
	}

	draw(drawingArgs: OptionalDrawingArgs): void {
		this.objectsDrawn.push(drawingArgs);
		this.drawFromArgs(drawingArgs);
	}

	getStateObject(): DrawingHash {
		return { drawingState: this.drawingState, objectsDrawn: this.objectsDrawn };
	}

	drawFromStateObject(state: DrawingHash): void {
		if (state.drawingState !== this.drawingState) {
			this.clear();
			state.objectsDrawn.forEach((drawingArgs) => {
				this.drawFromArgs(drawingArgs);
			});
			this.drawingState = state.drawingState;
		}
	}

	resetState(): void {
		this.objectsDrawn = [];
		this.clear();
		this.drawingState++;
		this.drawingState %= CONSTANTS.NUM_DRAWING_STATES;
	}
}
