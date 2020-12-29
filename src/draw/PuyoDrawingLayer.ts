import { DrawingLayer } from './GameDrawer';
import { Drop } from '../Drop';
import * as CONSTANTS from './DrawingConfig';

export class PuyoDrawingLayer extends DrawingLayer {
	constructor(width: number, height: number, unit: number, appearance: string, onNode: boolean, className = undefined) {
		super(width, height, unit, onNode, className);
		this.defaultArgs = {
			appearance,
			size: 1,
			sWidth: 1,
			sHeight: 1,
			merge: true
		};
	}

	drawPuyo(colour: number, dX: number, dY: number, directions: string[] = []): void {
		let sX: number, sY: number;
		if(colour === 0) {
			sX = CONSTANTS.PUYO_COORDINATES.NUISANCE.X;
			sY = CONSTANTS.PUYO_COORDINATES.NUISANCE.Y;
		}
		else {
			sX = CONSTANTS.PUYO_COORDINATES.PUYO_START.X;
			sY = CONSTANTS.PUYO_COORDINATES.PUYO_START.Y + colour - 1;
			if(directions.includes('Down')) {
				sX += 1;
			}
			if(directions.includes('Up')) {
				sX += 2;
			}
			if(directions.includes('Right')) {
				sX += 4;
			}
			if(directions.includes('Left')) {
				sX += 8;
			}
		}
		this.draw({ sX, sY, dX, dY });
	}

	drawPoppingPuyo(colour: number, dX: number, dY: number, drawPhaseTwo: boolean): void {
		const { X: sX, Y: sY } = CONSTANTS.PUYO_COORDINATES.POPPING[colour][drawPhaseTwo ? 2 : 1];
		this.draw({ sX, sY, dX, dY });
	}

	drawSquishingPuyo(colour: number, dX: number, dY: number, type: SquishType): void {
		const { X: sX, Y: sY } = CONSTANTS.PUYO_COORDINATES.SQUISHING[colour][type];
		this.draw({ sX, sY, dX, dY });
	}

	drawDrop(drop: Drop, dX: number, dY: number): void {
		if('I'.includes(drop.shape)) {
			this.drawI(drop, dX, dY, false);
		}
	}

	drawHighlightedDrop(drop: Drop, dX: number, dY: number): void {
		if('I'.includes(drop.shape)) {
			this.drawI(drop, dX, dY, true);
		}
	}

	drawI(drop: Drop, dX: number, dY: number, highlighted = false): void {
		if (highlighted) {
			this.drawHighlighted(drop.colours[0], dX, dY);
		}
		else {
			this.drawPuyo(drop.colours[0], dX, dY, []);
		}
		dX += Math.cos(drop.standardAngle + Math.PI / 2);
		dY -= Math.sin(drop.standardAngle + Math.PI / 2);
		this.drawPuyo(drop.colours[1], dX, dY, []);
	}

	drawHighlighted(colour: number, dX: number, dY: number): void {
		const sX = CONSTANTS.PUYO_COORDINATES.HIGHLIGHT_START.X + colour - 1;
		const sY = CONSTANTS.PUYO_COORDINATES.HIGHLIGHT_START.Y;
		this.draw({ sX, sY, dX, dY });
	}

	drawGhost(colour: number, dX: number, dY: number): void {
		const { X: sX, Y: sY, SCALE: scale } = CONSTANTS.PUYO_COORDINATES.GHOST_START[colour];
		this.draw({ sX, sY, dX, dY, sWidth: scale, sHeight: scale });
	}
}

export class QueueLayer extends PuyoDrawingLayer {
	updateQueue(queueState: { dropArray: Drop[] }): void {
		const { dropArray } = queueState;
		this.resetState();
		for (let i = 0; i < dropArray.length; i++) {
			this.drawDrop(dropArray[i], 1, 2 + 3 * i);
		}
	}
}
