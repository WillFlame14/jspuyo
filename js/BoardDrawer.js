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
        this.colourArray = [];
        for (let i = 0; i < window.COLOUR_LIST.length; i++) {
            this.colourArray.push(window.PUYO_COLOURS[window.COLOUR_LIST[i]]);
        }
        this.outSnapFactor = 2;
        this.outRotFactor = 8;
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

        if (currentDrop.schezo.y != null) {
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
        console.log(this.hashForUpdate(currentBoardState));
    }
    resolveChains(boardState, resolvingState) {
        // Get current information and assign it to convenient variables
        const {width, height} = this.board;
        const {cols, rows, popFrames, dropFrames} = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        if (resolvingState.currentFrame == 1) {
            this.poppingPuyos = [];
            for (let i = 0; i < cols; i++) {
                this.poppingPuyos.push([]);
            }
            for (let i = resolvingState.puyoLocs.length - 1; i >= 0; i--) {
                this.poppingPuyos[resolvingState.puyoLocs[i].col][resolvingState.puyoLocs[i].row] = true;
            }
            for (let i = resolvingState.nuisanceLocs.length - 1; i >= 0; i--) {
                this.poppingPuyos[resolvingState.nuisanceLocs[i].col][resolvingState.nuisanceLocs[i].row] = true;
            }
        }

        ctx.clearRect(0, 0, width, height);

        ctx.save();

        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);
        // Draw the stack in the pre-pop positions, with some puyo mid pop
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows + 1; j++) {
                    if (this.poppingPuyos[i][j] != null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPopping(boardState[i][j], unitW, resolvingState.currentFrame, popFrames);
                        ctx.restore();
                    } else if (boardState[i][j] != null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPuyo(boardState[i][j], unitW);
                        ctx.restore();
                    }
                }
            }
        }
        // Draw the stack dropping with the popped puyos gone
        else {
            for (let i = 0; i < cols; i++) {
                let numUnder = 0;
                while (boardState[i][numUnder] != null && this.poppingPuyos[i][numUnder] == null) {
                    ctx.save();
                    ctx.translate(unitW * i, - unitH * numUnder);
                    this.drawPuyo(boardState[i][numUnder], unitW);
                    ctx.restore();
                    numUnder++;
                }
                for (let j = numUnder + 1; j < rows + 1; j++) {
                    if (boardState[i][j] != null && this.poppingPuyos[i][j] == null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * (Math.max(j - (j - numUnder) * (resolvingState.currentFrame - popFrames) / dropFrames, numUnder)));
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
        this.drawPuyo(colour, size * (1 - frame / totalFrames));
    }

    drawFromHash(hash) {
        let splitHash = hash.split(":");
        switch (splitHash[0]) {
            case "0": {
                let boardState = [];
                let boardStateCols = splitHash[1].split(",");
                for (let i = 0; i < this.settings.cols; i++) {
                    boardState.push([]);
                    for (let j = 0; j < boardStateCols[i].length; j++) {
                        boardState[i].push(this.colourArray[boardStateCols[i][j]]);
                    }
                }
                let dropArray = splitHash[2].split(",");
                let arle = {x: dropArray[3], y: dropArray[4]};
                let schezo = {x: dropArray[5] == "n" ? null : dropArray[5], y: dropArray[6] == "n" ? null : dropArray[6]};
                let currentDrop = new window.Drop(dropArray[0], [this.colourArray[dropArray[1]], this.colourArray[dropArray[2]]], null, arle, schezo, dropArray[7] * 2 * Math.PI, dropArray[8]);
                this.updateBoard({ boardState: boardState, currentDrop: currentDrop });
            } break;
            case "1": {
                let boardState = [];
                let boardStateCols = splitHash[1].split(",");
                for (let i = 0; i < this.settings.cols; i++) {
                    boardState.push([]);
                    for (let j = 0; j < boardStateCols[i].length; j++) {
                        boardState[i].push(this.colourArray[boardStateCols[i][j]]);
                    }
                }
                let resolvingStateArray = splitHash[2].split(",")
                let puyoLocs = [];
                let puyoLocCols = resolvingStateArray[1].split(">");
                let puyoLocRows = resolvingStateArray[2].split(">");
                for (let i = 0; i < puyoLocCols.length - 1; i++) { // excess delimiter in hash causes off-by-one error due to a tailing ">" creating an undefined last element
                    puyoLocs.push({ col: puyoLocCols[i], row: puyoLocRows[i] });
                }
                let nuisanceLocs = [];
                let nuisanceLocCols = resolvingStateArray[3].split(">");
                let nuisanceLocRows = resolvingStateArray[4].split(">");
                for (let i = 0; i < nuisanceLocCols.length - 1; i++) { // excess delimiter in hash causes off-by-one error due to a tailing ">" creating an undefined last element
                    nuisanceLocs.push({ col: nuisanceLocCols[i], row: nuisanceLocRows[i] });
                }
                this.resolveChains(boardState, { chain: resolvingStateArray[0], puyoLocs: puyoLocs, nuisanceLocs: nuisanceLocs, currentFrame: resolvingStateArray[5], totalFrames: resolvingStateArray[6] })
            } break;
            default:
            break;
        }
    }

    hashForUpdate(currentBoardState) {
        const {boardState, currentDrop} = currentBoardState;

        let hash = "0:";
        for (let i = 0; i < boardState.length; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                hash += this.colourArray.indexOf(boardState[i][j]);
            }
            hash += ",";
        }
        hash += ":";
        hash += currentDrop.shape + ","; // 0: shape
        hash += this.colourArray.indexOf(currentDrop.colours[0]) + ","; // 1: colour 1
        hash += this.colourArray.indexOf(currentDrop.colours[1]) + ","; // 2: colour 2
        hash += currentDrop.arle.x + ","; // 3: arle x
        hash += Math.round(currentDrop.arle.y * this.outSnapFactor) / this.outSnapFactor + ","; // 4: arle y (rounded)
        // 5 and 6: schezo x and rounded y
        if (currentDrop.schezo.y == null) {
            hash += "n,n,"
        } else {
            hash += currentDrop.schezo.x + ",";
            hash += Math.round(currentDrop.schezo.y * this.outSnapFactor) / this.outSnapFactor + ",";
        }
        hash += Math.round(currentDrop.standardAngle / Math.PI / 2 * this.outRotFactor) / this.outRotFactor + ","; // 7: angle in rev rounded to nearest gradian
        hash += currentDrop.rotating; // 8: rotating
        return hash;
    }
    hashForResolving(boardState, resolvingState) {
        let hash = "1:";
        for (let i = 0; i < boardState.length; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                hash += this.colourArray.indexOf(boardState[i][j]);
            }
            hash += ",";
        }
        hash += ":";
        hash += resolvingState.chain + ","; // 0: chain
        // 1: puyoLoc cols
        for (let i = 0; i < resolvingState.puyoLocs.length; i++) {
            hash += resolvingState.puyoLocs[i].col + ">";
        }
        hash += ",";
        // 2: puyoLoc rows
        for (let i = 0; i < resolvingState.puyoLocs.length; i++) {
            hash += resolvingState.puyoLocs[i].row + ">";
        }
        hash += ",";
        // 3: nuisanceLoc cols
        for (let i = 0; i < resolvingState.nuisanceLocs.length; i++) {
            hash += resolvingState.nuisanceLocs[i].col + ">";
        }
        hash += ",";
        // 4: nuisanceLoc rows
        for (let i = 0; i < resolvingState.nuisanceLocs.length; i++) {
            hash += resolvingState.nuisanceLocs[i].row + ">";
        }
        hash += ",";
        hash += resolvingState.currentFrame + ","; // 5: current frame
        hash += resolvingState.totalFrames; // 6: total frames
        return hash;
    }
}
