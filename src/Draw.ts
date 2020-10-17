'use strict';

const SHEET_ROWS = 16;  // number of rows in the sprite grid
const SHEET_COLS = 16;  // number of columns in the sprite grid
const SHEET_UNIT = 32;  // number of pixels in a sprite grid unit
const SHEET_GAP = 1;    // number of pixels before sprite starts (top/left)
const SHEET_USED_UNIT = SHEET_UNIT - SHEET_GAP;
const SUB_SCALE_FACTOR = 1.05;

/**
 * Stores and loads scaled sprites.
 * Use loadImage to pre-emptively load an unscaled image for use
 * Use loadSprite to pre-emptively load an appropriately unit scaled version of an image (as an offscreen canvas)
 * Use drawSprite to draw a specific sprite at a specific size onto a desired canvas
 *
 */

class SpriteDrawer {
	/**
	 * @param   {CanvasRenderingContext2D}  ctx         The context to draw on
	 * @param   {String}                    spriteSheet The name of the sprite sheet to use, e.g. "TsuClassic" for TsuClassic.png
	 * @param   {Number}                    size        The size of a single sprite unit on the destination, in pixels
	 * @param   {Number}                    sX          The 0-indexed column number of the leftmost column of the sprite on the sheet
	 * @param   {Number}                    sY          The 0-indexed row number of the topmost row of the sprite on the sheet
	 * @param   {Number}                    dX          How many pixels right to draw the centre of the sprite relative to the current ctx origin
	 * @param   {Number}                    dY          How many pixels down to draw the centre of the sprite relative to the current ctx origin
	 * @param   {Number}                    sWidth      How many columns wide the sprite is on the sheet
	 * @param   {Number}                    sHeight     How many rows tall the sprite is on the sheet
	 * @param   {Boolean}                   merge       If the sprite should be scaled up slightly to ensure visual contiguity
	 */

	static drawSprite(ctx, spriteSheet, size, sX, sY, dX = 0, dY = 0, sWidth = 1, sHeight = 1, merge = true) {
		const sourceSize = merge ? size * SUB_SCALE_FACTOR : size;
		if (SpriteDrawer.loadSprite(spriteSheet, sourceSize) === true) {
			const spriteWidth = sWidth * sourceSize + (sWidth - 1) * sourceSize / SHEET_USED_UNIT;
			const spriteHeight = sHeight * sourceSize + (sHeight - 1) * sourceSize / SHEET_USED_UNIT;
			ctx.drawImage(
				SpriteDrawer[spriteSheet][sourceSize],
				(sX * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceSize,
				(sY * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceSize,
				spriteWidth, spriteHeight,
				dX - sWidth * sourceSize / 2, dY - sHeight * sourceSize / 2,
				spriteWidth, spriteHeight
			);
		}
	}
	// Loads canvas with scaled sprite sheet if it hasn't been done yet
	// Will return false if the original image hasn't been loaded and cannot be accessed to scale into a canvas
	static loadSprite(spriteSheet, size) {
		SpriteDrawer.loadImage(spriteSheet);
		if(SpriteDrawer[spriteSheet].image.loaded === false) {
			return false;
		} else {
			// SpriteDrawer[spriteSheet][size] is an html canvas object
			// e.g. SpriteDrawer['Aqua'][50] is a canvas that has Aqua.png drawn with unit size 50
			if(SpriteDrawer[spriteSheet][size] == null) {
				SpriteDrawer[spriteSheet][size] = document.createElement('canvas');
				SpriteDrawer[spriteSheet][size].width = Math.ceil(SHEET_COLS * SHEET_UNIT * size / SHEET_USED_UNIT);
				SpriteDrawer[spriteSheet][size].height = Math.ceil(SHEET_ROWS * SHEET_UNIT * size / SHEET_USED_UNIT);
				SpriteDrawer[spriteSheet][size].getContext('2d').drawImage(
					SpriteDrawer[spriteSheet].image,
					0, 0,
					SpriteDrawer[spriteSheet][size].width, SpriteDrawer[spriteSheet][size].height
				);
			}
			return true;
		}
	}
	// Loads sprite sheet image if it hasn't been done yet
	static loadImage(spriteSheet) {
		if(SpriteDrawer[spriteSheet] == null) {
			SpriteDrawer[spriteSheet] = {};
			SpriteDrawer[spriteSheet].image = new Image();
			SpriteDrawer[spriteSheet].image.loaded = false;
			SpriteDrawer[spriteSheet].image.addEventListener('load', function() {
				this.loaded = true;
			});
			SpriteDrawer[spriteSheet].image.src = '../images/' + spriteSheet + ".png";
		}
	}
}

module.exports = { SpriteDrawer };
