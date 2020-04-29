'use strict';

const SHEET_ROWS = 16;  // number of rows in the sprite grid
const SHEET_COLS = 16;  // number of columns in the sprite grid
const SHEET_UNIT = 32;  // number of pixels in a sprite grid unit
const SHEET_GAP = 1;    // number of pixels before sprite starts (top/left)

/**
 * Stores and loads scaled sprites.
 * Use loadSprite to pre-emptively load the spritesheet for a given unit scale
 * Use drawSprite to draw a specific sprite at a specific size onto a desired canvas
 */
class SpriteDrawer {
    // sX, sY, sWidth, sHeight, are sprite sheet parameters 0-indexed from top-left
    drawSprite(ctx, spriteSheet, size, sX, sY, cX, cY, sWidth = 1.025, sHeight = 1.025) {
        if (this.loadSprite(spriteSheet, size) === true) {
            const canvasName = 'c' + size.toString();
            ctx.drawImage(
                this[spriteSheet][canvasName],
                (sX * (SHEET_UNIT + SHEET_GAP) / SHEET_UNIT + SHEET_GAP / SHEET_UNIT) * size,
                (sY * (SHEET_UNIT + SHEET_GAP) / SHEET_UNIT + SHEET_GAP / SHEET_UNIT) * size,
                size, size,
                cX, cY,
                sWidth * size, sHeight * size
            )
        }
    }
    // Loads canvas with scaled sprite sheet if it hasn't been done yet
    // Will return false if the original image hasn't been loaded and cannot be accessed to scale into a canvas
    loadSprite(spriteSheet, size) {
        this.loadImage(spriteSheet);
        if(this[spriteSheet].image.loaded === false) {
            return false;
        } else {
            const canvasName = 'c' + size.toString();
            // this[spriteSheet][canvasName] is an html canvas object
            // e.g. this['aqua']['c50'] or this.aqua.c50 is a canvas that has aqua.png drawn with unit size 50
            if(this[spriteSheet][canvasName] == null) {
                this[spriteSheet][canvasName] = document.createElement('canvas');
                this[spriteSheet][canvasName].width = size * SHEET_COLS * SHEET_UNIT / (SHEET_UNIT - SHEET_GAP);
                this[spriteSheet][canvasName].height = size * SHEET_ROWS * SHEET_UNIT / (SHEET_UNIT - SHEET_GAP);
                this[spriteSheet][canvasName].getContext('2d').drawImage(
                    this[spriteSheet].image,
                    0, 0,
                    this[spriteSheet][canvasName].width, this[spriteSheet][canvasName].height
                );
            }
            return true;
        }
    }
    // Loads sprite sheet image if it hasn't been done yet
    loadImage(spriteSheet) {
        if(this[spriteSheet] == null) {
            this[spriteSheet] = {};
            this[spriteSheet].image = new Image();
            this[spriteSheet].image.loaded = false;
            this[spriteSheet].image.addEventListener('load', function() {
                this.loaded = true;
            });
            this[spriteSheet].image.src = '../images/' + spriteSheet + ".png";
        }
    }
}

module.exports = { SpriteDrawer }
