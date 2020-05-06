'use strict';

const SHEET_ROWS = 16;  // number of rows in the sprite grid
const SHEET_COLS = 16;  // number of columns in the sprite grid
const SHEET_UNIT = 32;  // number of pixels in a sprite grid unit
const SHEET_GAP = 1;    // number of pixels before sprite starts (top/left)
const SHEET_USED_UNIT = SHEET_UNIT - SHEET_GAP;
const SUB_SCALE_FACTOR = 1.05;

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
                (sX * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * size,
                (sY * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * size,
                sWidth * size + (sWidth - 1) * size / SHEET_USED_UNIT,
                sHeight * size + (sHeight - 1) * size / SHEET_USED_UNIT,
                cX * size - sWidth * size / 2, cY * size - sHeight * size / 2,
                sWidth * size + (sWidth - 1) * size / SHEET_USED_UNIT,
                sHeight * size + (sHeight - 1) * size / SHEET_USED_UNIT
            )
        }
    }
    drawSubsprite(ctx, spriteSheet, size, sX, sY, cX, cY, sWidth = 1, sHeight = 1) {
        const sourceSize = size * SUB_SCALE_FACTOR;
        if (this.loadSprite(spriteSheet, sourceSize) === true) {
            const canvasName = 'c' + sourceSize.toString();
            ctx.drawImage(
                this[spriteSheet][canvasName],
                (sX * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceSize,
                (sY * SHEET_UNIT / SHEET_USED_UNIT + 1 / SHEET_USED_UNIT) * sourceSize,
                sWidth * sourceSize + (sWidth - 1) * sourceSize / SHEET_USED_UNIT,
                sHeight * sourceSize + (sHeight - 1) * sourceSize / SHEET_USED_UNIT,
                cX * size - sWidth * sourceSize / 2, cY * size - sHeight * sourceSize / 2,
                sWidth * sourceSize + (sWidth - 1) * sourceSize / SHEET_USED_UNIT,
                sHeight * sourceSize + (sHeight - 1) * sourceSize / SHEET_USED_UNIT
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
                this[spriteSheet][canvasName].width = Math.ceil(SHEET_COLS * SHEET_UNIT * size / SHEET_USED_UNIT);
                this[spriteSheet][canvasName].height = Math.ceil(SHEET_ROWS * SHEET_UNIT * size / SHEET_USED_UNIT);
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
