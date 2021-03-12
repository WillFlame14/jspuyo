'use strict';

const SHEET_ROWS = 16;  // number of rows in the sprite grid
const SHEET_COLS = 16;  // number of columns in the sprite grid
const SHEET_UNIT = 32;  // number of pixels in a sprite grid unit
const SHEET_GAP = 1;    // number of pixels before sprite starts within its grid space (top/left)
const SHEET_USED_UNIT = SHEET_UNIT - SHEET_GAP; // number of pixels containing sprite content in a 1x1 sprite
const SUB_SCALE_FACTOR = 1.05; // experimentally-determined scale factor that allows interconnecting "sub"-sprites to visually meld

const SpriteCache: Record<string, Sprite> = {};

/**
 * Loads all the sprites associated with an appearance ahead of time. This prevents problems such as failing to clear canvas between draws.
 */
export function preloadSprites(appearance: string): void {
	// Probably should be more robust, but this is good enough for now.
	loadSprite(appearance, SUB_SCALE_FACTOR, SUB_SCALE_FACTOR);
}

/**
 * Stores and loads scaled sprites.
 * @param {CanvasRenderingContext2D}    ctx         The canvas to draw the sprite onto
 * @param {string}                      appearance  The name of the spritesheet
 * @param {number}                      unitW       The unit width of the canvas to be drawn on in pixels
 * @param {number}                      unitH       The unit height of the canvas to be drawn on in pixels
 * @param {number}                      sX          The source x-coordinate in sprite units, with 0 denoting the leftmost column
 * @param {number}                      sY          The source y-coordinate in sprite units, with 0 denoting the topmost row
 * @param {number}                      dX          The destination x-coordinate in sprite units, with 0 denoting the leftmost column
 * @param {number}                      dY          The destination y-coordinate in sprite units, with 0 denoting the topmost row
 * @param {number}                      sWidth      The source width in sprite units
 * @param {number}                      sHeight     The source height in sprite units
 * @param {boolean}                     merge       Whether the sprite should be scaled up slightly to meld with interconnecting sprites
 * Use loadImage to pre-emptively load an unscaled image for use
 * Use loadSprite to pre-emptively load an appropriately unit scaled version of an image (as an offscreen canvas)
 * Use drawSprite to draw a specific sprite at a specific size onto a desired canvas
 * Returns true if the sprite was successfully drawn.
 */

export function drawSprite(args: DrawingArgs): boolean {
	const { ctx, appearance: spriteSheet, unitW, unitH, sX, sY, dX = 0, dY = 0, sWidth = 1, sHeight = 1, merge = true} = args;

	const sourceW = merge ? unitW * SUB_SCALE_FACTOR : unitW;
	const sourceH = merge ? unitH * SUB_SCALE_FACTOR : unitH;
	if (loadSprite(spriteSheet, sourceW, sourceH)) {
		const spriteWidth = sWidth * sourceW + (sWidth - 1) * sourceW / SHEET_USED_UNIT;
		const spriteHeight = sHeight * sourceH + (sHeight - 1) * sourceW / SHEET_USED_UNIT;
		ctx.drawImage(
			SpriteCache[spriteSheet].sizes.get(getSpriteKey(sourceW, sourceH)),
			(sX * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceW,
			(sY * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceH,
			spriteWidth, spriteHeight,
			unitW * dX - sWidth * sourceW / 2, unitH * dY - sHeight * sourceH / 2,
			spriteWidth, spriteHeight
		);
		return true;
	}
	return false;
}

/**
 * Loads canvas with scaled sprite sheet if it hasn't been loaded yet.
 * @param  {string} 	spriteSheet The name of the spritesheet
 * @param  {number} 	size        The unit size of the scaled spritesheet
 * @return {boolean}	            Whether the canvas with scaled sprite sheet has been loaded
 */
function loadSprite(spriteSheet: string, unitW: number, unitH: number): boolean {
	if(!loadImage(spriteSheet)) {
		return false;
	}

	// SpriteDrawer[spriteSheet].sizes.get(size) is an html canvas object
	// e.g. SpriteDrawer['Aqua'].sizes.get(50) is a canvas that has Aqua.png drawn with unit size 50
	const key = getSpriteKey(unitW, unitH);
	if(!SpriteCache[spriteSheet].sizes.has(key)) {
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(SHEET_COLS * SHEET_UNIT * unitW / SHEET_USED_UNIT);
		canvas.height = Math.ceil(SHEET_ROWS * SHEET_UNIT * unitH / SHEET_USED_UNIT);

		canvas.getContext('2d').drawImage(
			SpriteCache[spriteSheet].image,
			0, 0,
			canvas.width, canvas.height
		);
		SpriteCache[spriteSheet].sizes.set(key, canvas);
	}
	return true;
}

/**
 * Loads sprite sheet image if it hasn't been loaded yet.
 * @param 	{string} 	 	spriteSheet The name of the spritesheet
 * @return 	{boolean}					Whether the image has been loaded
 */
function loadImage(spriteSheet: string): boolean {
	if(SpriteCache[spriteSheet]) {
		return SpriteCache[spriteSheet].loaded;
	}

	const sprite = { sizes: new Map<string, HTMLCanvasElement>(), loaded: false } as Sprite;

	const image = new Image();
	image.src = `./images/${spriteSheet}.png`;
	image.addEventListener('load', function() {
		sprite.loaded = true;
	});
	sprite.image = image;

	SpriteCache[spriteSheet] = sprite;
	return sprite.loaded;
}

/**
 *  Utility function to get key for scaled sprite sheet
 * @param   {number}    unitW   The unit width of the sprite in pixels
 * @param   {number}    unitH   The unit height of the sprite in pixels
 * @return  {string}            The key for the sprite
 */
function getSpriteKey(unitW: number, unitH: number): string {
	return `${unitW},${unitH}`;
}
