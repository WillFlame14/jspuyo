interface Sprite {
	image: HTMLImageElement,
	sizes: Map<number, HTMLCanvasElement>
}

interface DrawingArgs {
	/** The context to draw on */
	ctx: CanvasRenderingContext2D,
	/** The name of the sprite sheet to use, e.g. "TsuClassic" for TsuClassic.png */
	appearance: string,
	/** The size of a single sprite unit on the destination, in pixels */
	size: number,
	/** The 0-indexed column number of the leftmost column of the sprite on the sheet */
	sX: number,
	/** The 0-indexed row number of the topmost row of the sprite on the sheet */
	sY: number,
	/** How many pixels right to draw the centre of the sprite relative to the current ctx origin */
	dX?: number,
	/** How many pixels down to draw the centre of the sprite relative to the current ctx origin */
	dY?: number,
	/** How many columns wide the sprite is on the sheet */
	sWidth?: number,
	/** How many rows tall the sprite is on the sheet */
	sHeight?: number,
	/** If the sprite should be scaled up slightly to ensure visual contiguity */
	merge?: boolean
}

interface OptionalDrawingArgs {
	/** The context to draw on (Required) */
	ctx?: CanvasRenderingContext2D,
	/** The name of the sprite sheet to use, e.g. "TsuClassic" for TsuClassic.png (Required) */
	appearance?: string,
	/** The size of a single sprite unit on the destination, in pixels (Required) */
	size?: number,
	/** The 0-indexed column number of the leftmost column of the sprite on the sheet (Required) */
	sX?: number,
	/** The 0-indexed row number of the topmost row of the sprite on the sheet (Required) */
	sY?: number,
	/** How many pixels right to draw the centre of the sprite relative to the current ctx origin */
	dX?: number,
	/** How many pixels down to draw the centre of the sprite relative to the current ctx origin */
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
	objectsDrawn: OptionalDrawingArgs[]
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
