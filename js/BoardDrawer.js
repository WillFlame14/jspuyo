'use strict';

const { Drop } = require('./Drop.js');
const { SpriteDrawer } = require('./Draw.js');
const { PUYO_COLOURS, COLOUR_LIST, PUYO_EYES_COLOUR } = require('./Utils.js');

/**
 * Class to manage updating for any canvas that draws Puyo (the main board or the queue).
 * The settings should not change over the span of the drawer being used
 * but the update function will need game state info.
 */
class DrawerWithPuyo {
    constructor() {
        this.spriteDrawer = new SpriteDrawer();
    }
    drawPuyo(colour, size) {
        if (colour == PUYO_COLOURS['Gray']) {
            this.spriteDrawer.drawSprite(this.ctx, 'Aqua', size, 10, 9, 0, 0);
        } else {
            console.log(this.colourArray[colour]);
            this.spriteDrawer.drawSprite(this.ctx, 'Aqua', size, 0, this.colourArray.indexOf(colour), 0, 0);
        }
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
class BoardDrawer extends DrawerWithPuyo {
    constructor(settings, boardNum) {
        super();
        this.board = document.getElementById("board" + boardNum);
        this.ctx = this.board.getContext("2d");
        this.settings = settings;
        this.poppingPuyos = [];
        this.colourArray = [];
        for (let i = 0; i < COLOUR_LIST.length; i++) {
            this.colourArray.push(PUYO_COLOURS[COLOUR_LIST[i]]);
        }
        this.nuisanceCascadeFPR = [];
    }

    drawPopping(colour, size, frame, totalFrames) {
        // this.drawPuyo(colour, size * (1 - frame / totalFrames));
        this.drawPuyo(colour, size);
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
    }
    resolveChains(boardState, resolvingState) {
        // Get current information and assign it to convenient variables
        const {width, height} = this.board;
        const {cols, rows, popFrames, dropFrames} = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        if (resolvingState.setup === undefined) {
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
            resolvingState.setup = true;
        }

        ctx.clearRect(0, 0, width, height);

        ctx.save();

        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);
        // Draw the stack in the pre-pop positions, with some puyo mid pop
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows + 1; j++) {
                    if (boardState[i][j] != null && this.poppingPuyos[i][j] == null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPuyo(boardState[i][j], unitW);
                        ctx.restore();
                    }
                }
            }
        }
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows + 1; j++) {
                    if (this.poppingPuyos[i][j] != null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPopping(boardState[i][j], unitW, resolvingState.currentFrame, popFrames);
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
                for (let j = numUnder + 1; j < boardState[i].length; j++) {
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

    initNuisanceDrop(nuisanceCascadeFPR) {
        this.nuisanceCascadeFPR = nuisanceCascadeFPR;
    }

    dropNuisance(boardState, nuisanceState) {
        const { nuisanceArray, currentFrame } = nuisanceState;
        const { width, height } = this.board;
        const { cols, rows } = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                ctx.save();
                ctx.translate(unitW * i, - unitH * j);
                this.drawPuyo(boardState[i][j], unitW);
                ctx.restore();
            }
            const startingRowsAbove = this.settings.nuisanceSpawnRow - boardState[i].length;
            const rowsDropped = Math.min(currentFrame / this.nuisanceCascadeFPR[i], startingRowsAbove);
            for (let j = 0; j < nuisanceArray[i].length; j++) {
                ctx.save();
                ctx.translate(unitW * i, - unitH * (this.settings.nuisanceSpawnRow - rowsDropped + j));
                this.drawPuyo(PUYO_COLOURS['Gray'], unitW);
                ctx.restore();
            }
        }

        // Restore origin to top left
        ctx.restore();
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
                let arle = { x: dropArray[3], y: dropArray[4] };
                let schezo = { x: dropArray[5] == "n" ? null : dropArray[5], y: dropArray[6] == "n" ? null : dropArray[6] };
                let currentDrop = new Drop(
                    dropArray[0],
                    [this.colourArray[dropArray[1]], this.colourArray[dropArray[2]]],
                    null,
                    arle,
                    schezo,
                    dropArray[7] * 2 * Math.PI,
                    dropArray[8]);
                return this.updateBoard({ boardState, currentDrop });
            }
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

                return this.resolveChains(boardState,
                    {
                        chain: resolvingStateArray[0],
                        puyoLocs,
                        nuisanceLocs,
                        currentFrame: resolvingStateArray[5],
                        totalFrames: resolvingStateArray[6]
                    }
                );
            }
            case "2": {
                return this.initNuisanceDrop(splitHash[1].split(","));
            }
            case "3": {
                let boardState = [];
                let boardStateCols = splitHash[1].split(",");
                for (let i = 0; i < this.settings.cols; i++) {
                    boardState.push([]);
                    for (let j = 0; j < boardStateCols[i].length; j++) {
                        boardState[i].push(this.colourArray[boardStateCols[i][j]]);
                    }
                }
                const nuisanceState = {
                    nuisanceArray: splitHash[2].split(",").map(col => col ? col.split(">").map(num => this.colourArray[num]) : []),
                    nuisanceAmount: Number(splitHash[3]),
                    currentFrame: Number(splitHash[4]),
                    totalFrames: Number(splitHash[5])
                };
                return this.dropNuisance(boardState, nuisanceState);
            }
            default:
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
        hash += Math.round(currentDrop.arle.y * this.settings.hashSnapFactor) / this.settings.hashSnapFactor + ","; // 4: arle y (rounded)
        // 5 and 6: schezo x and rounded y
        if (currentDrop.schezo.y == null) {
            hash += "n,n,"
        } else {
            hash += currentDrop.schezo.x + ",";
            hash += Math.round(currentDrop.schezo.y * this.settings.hashSnapFactor) / this.settings.hashSnapFactor + ",";
        }
        hash += Math.round(currentDrop.standardAngle / Math.PI / 2 * this.settings.hashRotFactor) / this.settings.hashRotFactor + ","; // 7: angle in rev rounded to nearest gradian
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

    hashForNuisanceInit(nuisanceCascadeFPR) {
        return "2:" + nuisanceCascadeFPR.join(",");
    }

    hashForNuisance(boardState, nuisanceState) {
        let hash = "3:";
        for (let i = 0; i < boardState.length; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                hash += this.colourArray.indexOf(boardState[i][j]);
            }
            hash += ",";
        }
        hash += ":";
        hash += nuisanceState.nuisanceArray.map(col => col.map(puyo => this.colourArray.indexOf(puyo)).join(">")).join(",") + ":";
        hash += nuisanceState.nuisanceAmount + ":";
        hash += nuisanceState.currentFrame + ":";
        hash += nuisanceState.totalFrames;
        return hash;
    }
}

module.exports = { BoardDrawer };
