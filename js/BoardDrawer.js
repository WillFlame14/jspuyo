'use strict';

/**
 * Class to manage updating for any canvas that draws Puyo (the main board or the queue).
 * The settings should not change over the span of the drawer being used
 * but the update function will need game state info.
 */
class DrawerWithPuyo {
    constructor() {
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
        if ("IhLHO".includes(drop.shape)) {
            this["draw_" + drop.shape](drop, size);
        }
    }
    draw_I(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        this.drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_h(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        this.drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(size * Math.cos(drop.standardAngle), - size * Math.sin(drop.standardAngle));
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_L(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        this.drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
        ctx.save();
        ctx.translate(size * Math.cos(drop.standardAngle), - size * Math.sin(drop.standardAngle));
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
    }

    draw_H(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        let xChange = size / Math.sqrt(2) * Math.cos(- drop.standardAngle + Math.PI / 4);
        let yChange = size / Math.sqrt(2) * Math.sin(- drop.standardAngle + Math.PI / 4);
        ctx.translate(- xChange, - yChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(- yChange, xChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(xChange, yChange);
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
        ctx.save();
        ctx.translate(yChange, - xChange);
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_O(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        let xChange = size / 2;
        let yChange = size / 2;
        ctx.translate(- xChange, - yChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(- yChange, xChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(xChange, yChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(yChange, - xChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
    }
}

/**
 * The drawer for the main area of the game.
 */
window.BoardDrawer = class BoardDrawer extends DrawerWithPuyo {
    constructor(settings, boardNum) {
        super();
        this.board = document.getElementById("board" + boardNum);
        this.ctx = this.board.getContext("2d");
        this.settings = settings;
        this.poppingPuyos = [];
    }
    updateBoard(currentBoardState) {
        // Get current information about what to draw and get current width and height in case of resizing
        const {boardState, currentDrop} = currentBoardState;
        const {width, height} = this.board;
        const {cols, rows} = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                if (boardState[i][j]) {
                    ctx.save();
                    ctx.translate(unitW * i, - unitH * j);
                    this.drawPuyo(boardState[i][j], unitW);
                    ctx.restore();
                }
            }
        }

        if (currentDrop.schezo.x) {
            ctx.save();
            ctx.translate(unitW * currentDrop.arle.x, - unitH * currentDrop.arle.y);
            this.drawPuyo(currentDrop.colours[0], unitW);
            ctx.restore();
            ctx.translate(unitW * currentDrop.schezo.x, - unitH * currentDrop.schezo.y);
            this.drawPuyo(currentDrop.colours[1], unitW);
        } else {
            ctx.translate(unitW * currentDrop.arle.x, - unitH * currentDrop.arle.y);
            this.drawDrop(currentDrop, unitW);
        }

        // Restore origin to top left
        ctx.restore();
    }
    resolveChains(boardState, resolvingState) {
        // Get current information and assign it to convenient variables
        // alert(boardState);
        const {width, height} = this.board;
        const {cols, rows, popFrames, cascadeFramesPerRow} = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;
        // alert("resolveChains called");

        if (resolvingState.currentFrame == 1) {
            this.poppingPuyos = [];
            for (let i = 0; i < cols; i++) {
                this.poppingPuyos.push([]);
            }
            for (let i = resolvingState.puyoLocs.length - 1; i >= 0; i--) {
                this.poppingPuyos[resolvingState.puyoLocs[i].col][resolvingState.puyoLocs[i].row] = true;
                // alert("setting " + resolvingState.puyoLocs[i].col + ", " + resolvingState.puyoLocs[i].row + " to popping");
            }
        }

        ctx.clearRect(0, 0, width, height);

        ctx.save();

        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);
        // alert ("moved origin");
        // alert ("cols: " + cols + " , rows: " + rows);

        if (resolvingState.currentFrame <= this.settings.popFrames) {
            // if (resolvingState.currentFrame == 1) {
            //     alert("drawing popping phase");
            //     let full = "occupied:\n";
            //     let popping = "popping:\n";
            //     for (let i = rows - 1; i >= 0; i--) {
            //         for (let j = 0; j < cols; j++) {
            //                 full += boardState[j][i]?'O':'X';
            //                 popping += this.poppingPuyos[j][i]?'O':'X';
            //         }
            //         full += '\n';
            //         popping += '\n';
            //     }
            //     alert(full);
            //     alert(popping);
            // }
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    // alert("popping? " + this.poppingPuyos[i][j]);
                    // alert("puyo here? " + boardState[i][j]);
                    if (this.poppingPuyos[i][j]) {
                        // alert("a puyo is popping at " + i + ", " + j + ". The colour is " + boardState[i][j]);
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        // alert("popping translation complete");
                        this.drawPopping(boardState[i][j], unitW, resolvingState.currentFrame, popFrames);
                        ctx.restore();
                    } else if (boardState[i][j]) {
                        // alert("drawing non popping puyo");
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPuyo(boardState[i][j], unitW);
                        ctx.restore();
                    }
                }
            }
        }
        else {
            for (let i = 0; i < cols; i++) {
                let numUnder = 0;
                while (boardState[i][numUnder] && !this.poppingPuyos[i][numUnder]) {
                    ctx.save();
                    ctx.translate(unitW * i, - unitH * numUnder);
                    this.drawPuyo(boardState[i][numUnder], unitW);
                    ctx.restore();
                    numUnder++;
                }
                for (let j = numUnder + 1; j < rows; j++) {
                    if (boardState[i][j] && !this.poppingPuyos[i][j]) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * (Math.max(j - (resolvingState.currentFrame - popFrames)/cascadeFramesPerRow, numUnder)));
                        this.drawPuyo(boardState[i][j], unitW);
                        ctx.restore();
                        numUnder++;
                    }
                }
            }
        }
        ctx.restore();
    }
    drawPopping(colour, size, frame, totalFrames) {
        // alert ("drawPopping called with colour: " + colour + " on frame " + frame + " out of " + totalFrames);
        this.drawPuyo(colour, size * (1 - frame / totalFrames));
    }
}
