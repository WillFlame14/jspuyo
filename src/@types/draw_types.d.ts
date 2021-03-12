interface Sprite {
	image: HTMLImageElement,
	loaded: boolean,
	sizes: Map<string, HTMLCanvasElement>
}

interface DrawingArgs {
	/** The context to draw on */
	ctx: CanvasRenderingContext2D,
	/** The name of the sprite sheet to use, e.g. "TsuClassic" for TsuClassic.png */
	appearance: string,
	/** The width of a single sprite unit on the destination, in pixels */
	unitW: number,
	/** The height of a single sprite unit on the destination, in pixels */
	unitH: number,
	/** The 0-indexed column number of the leftmost column of the sprite on the sheet */
	sX: number,
	/** The 0-indexed row number of the topmost row of the sprite on the sheet */
	sY: number,
	/** How many columns right to draw the centre of the sprite relative to the current ctx origin */
	dX?: number,
	/** How many rows down to draw the centre of the sprite relative to the current ctx origin */
	dY?: number,
	/** How many columns wide the sprite is on the sheet */
	sWidth?: number,
	/** How many rows tall the sprite is on the sheet */
	sHeight?: number,
	/** If the sprite should be scaled up slightly to ensure visual contiguity */
	merge?: boolean
}

interface SpriteLocation {
	X: number,
	Y: number,
	SCALE?: number
}

interface DrawingHash {
	drawingState: number,
	objectsDrawn: Partial<DrawingArgs>[]
}

interface LayerHash {
	stackObject: DrawingHash,
	dynamicObject: DrawingHash
}

interface GameHash {
	boardObject: LayerHash,
	nuisanceObject: DrawingHash,
	queueObject: DrawingHash
}

type SquishType = 'NORMAL' | 'FLAT' | 'TALL';
