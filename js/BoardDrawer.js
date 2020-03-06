'use strict';

/**
 * Class to manage updating for any canvas that draws Puyo (the main board or the queue).
 * The settings should not change over the span of the drawer being used
 * but the update function will need game state info.
 */
class DrawerWithPuyo {
    constructor(settings) {
    }
    drawPuyo(colour, size) {
        let ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.translate(- size / 5, - size / 10);
        ctx.beginPath();
        ctx.arc(0, 0, size / 5, 0, 2 * Math.PI);
        ctx.translate(2 * size / 5, 0);
        ctx.arc(0, 0, size / 5, 0, 2 * Math.PI);
        ctx.fillStyle = window.PUYO_EYES_COLOUR;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(- size / 6, - size / 13);
        ctx.beginPath();
        ctx.arc(0, 0, size / 8, 0, 2 * Math.PI);
        ctx.translate(2 * size / 6, 0);
        ctx.arc(0, 0, size / 8, 0, 2 * Math.PI);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.restore();
    }
    drawDrop(drop, size) {
        let ctx = this.ctx;
        this['draw_' + drop.shape](drop, size);
    }
    draw_I(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_h(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(size * Math.cos(drop.standardAngle), - size * Math.sin(drop.standardAngle));
        drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_L(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        drawPuyo(drop.colours[1], size);
        ctx.restore();
        ctx.save();
        ctx.translate(size * Math.cos(drop.standardAngle), - size * Math.sin(drop.standardAngle));
        drawPuyo(drop.colours[0], size);
        ctx.restore();
    }

    draw_H(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        let xChange = size / Math.sqrt(2) * Math.cos(- drop.standardAngle + Math.PI / 4);
        let yChange = size / Math.sqrt(2) * Math.sin(- drop.standardAngle + Math.PI / 4);
        ctx.translate(- xChange, - yChange);
        drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(- yChange, xChange);
        drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(xChange, yChange);
        drawPuyo(drop.colours[1], size);
        ctx.restore();
        ctx.save();
        ctx.translate(yChange, - xChange);
        drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_O(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        let xChange = size / 2;
        let yChange = size / 2;
        ctx.translate(- xChange, - yChange);
        drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(- yChange, xChange);
        drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(xChange, yChange);
        drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(yChange, - xChange);
        drawPuyo(drop.colours[0], size);
        ctx.restore();
    }
}

/**
 * The drawer for the main area of the game.
 */
window.BoardDrawer = class BoardDrawer extends DrawerWithPuyo {
    constructor(settings) {
        super(settings);
        this.board = document.getElementById("board");
        this.ctx = board.getContext("2d");
        this.cols = settings.cols;
        this.rows = settings.rows;
    }
    updateBoard(currentBoardState) {
        // Get current information about what to draw and get current width and height in case of resizing
        const {boardState, currentDrop} = currentBoardState;
        alert(boardState);
        let width = this.board.width;
        let height = this.board.height;
        let unitW = width / this.cols;
        let unitH = height / this.rows;
        let ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * unitW, (this.rows - 0.5) * unitH);

        for (let i = this.rows - 1; i >= 0; i--) {
            for (let j = this.cols - 1; j >= 0; j--) {
                if (boardState[i][j] != null) {
                    ctx.save();
                    ctx.translate(unitW * xPos, - unitH * yPos);
                    drawPuyo(colour, unitW);
                    ctx.restore();
                }
            }
        }

        // Save a canvas with the origin at the location
        ctx.translate(unitW * currentDrop.arle.x, - unitH * currentDrop.arle.y);
        drawDrop(currentDrop);

        // Restore origin to top left
        ctx.restore();
    }

}
