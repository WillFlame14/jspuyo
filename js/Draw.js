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
	 * @param   {Number}                    cX          How many pixels right to draw the centre of the sprite relative to the current ctx origin
	 * @param   {Number}                    cY          How many pixels down to draw the centre of the sprite relative to the current ctx origin
	 * @param   {Number}                    sWidth      How many columns wide the sprite is on the sheet
	 * @param   {Number}                    sHeight     How many rows tall the sprite is on the sheet
	 * @param   {Boolean}                   merge       If the sprite should be scaled up slightly to ensure visual contiguity
	 */
	drawSprite(ctx, spriteSheet, sizeX, sizeY, sX, sY, cX, cY, sWidth = 1, sHeight = 1, merge = true) {
		const sourceSizeX = merge ? sizeX * SUB_SCALE_FACTOR : sizeX;
		const sourceSizeY = merge ? sizeY * SUB_SCALE_FACTOR : sizeY;
		if (this.loadSprite(spriteSheet, sourceSizeX, sourceSizeY) === true) {
			const canvasName = 'c' + sourceSizeX.toString() + sourceSizeY.toString();
			ctx.drawImage(
				this[spriteSheet][canvasName],
				(sX * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceSizeX,
				(sY * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceSizeY,
				sWidth * sourceSizeX + (sWidth - 1) * sourceSizeX / SHEET_USED_UNIT,
				sHeight * sourceSizeY + (sHeight - 1) * sourceSizeY / SHEET_USED_UNIT,
				cX - sWidth * sourceSizeX / 2, cY - sHeight * sourceSizeY / 2,
				sWidth * sourceSizeX + (sWidth - 1) * sourceSizeY / SHEET_USED_UNIT,
				sHeight * sourceSizeX + (sHeight - 1) * sourceSizeY / SHEET_USED_UNIT
			);
		}
	}
	// Loads canvas with scaled sprite sheet if it hasn't been done yet
	// Will return false if the original image hasn't been loaded and cannot be accessed to scale into a canvas
	loadSprite(spriteSheet, sizeX, sizeY) {
		this.loadImage(spriteSheet);
		if(this[spriteSheet].image.loaded === false) {
			return false;
		} else {
			const canvasName = 'c' + sizeX.toString() + sizeY.toString();
			// this[spriteSheet][canvasName] is an html canvas object
			// e.g. this['aqua']['c50'] or this.aqua.c50 is a canvas that has aqua.png drawn with unit size 50
			if(this[spriteSheet][canvasName] == null) {
				const spriteCanvas = document.createElement('canvas');
				spriteCanvas.width = Math.ceil(SHEET_COLS * SHEET_UNIT * sizeX / SHEET_USED_UNIT);
				spriteCanvas.height = Math.ceil(SHEET_ROWS * SHEET_UNIT * sizeY / SHEET_USED_UNIT);
				spriteCanvas.getContext('2d').drawImage(
					this[spriteSheet].image,
					0, 0,
					spriteCanvas.width, spriteCanvas.height
				);
				this[spriteSheet][canvasName] = spriteCanvas;
			}
			return true;
		}
	}
	// Loads sprite sheet image if it hasn't been done yet
	loadImage(spriteSheet) {
		if(this[spriteSheet] == null) {
			const sheet = {};
			sheet.image = new Image();
			sheet.image.loaded = false;
			sheet.image.addEventListener('load', function() {
				this.loaded = true;
			});
			sheet.image.src = '../images/' + spriteSheet + ".png";
			this[spriteSheet] = sheet;
		}
	}
}

module.exports = { SpriteDrawer };
