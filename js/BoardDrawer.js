'use strict';

const { Board } = require('./Board.js');
const { SpriteDrawer } = require('./Draw.js');
const { DIMENSIONS } = require('./Utils.js');
const { POSITIONS } = require('../images/sprite-positions.json');
const NUM_DRAWING_STATES = 5;
const ARG_INDEX = {
    appearance: 0,
    size: 1,
    sX: 2,
    sY: 3,
    dX: 4,
    dY: 5,
    sWidth: 6,
    sHeight: 7,
    merge: 8
};
const MODE = {
    PUYO_DROPPING: 0,
    PUYO_DROPPING_SPLIT: 1,
    PUYO_SQUISHING: 2,
    CHAIN_POPPING: 3,
    CHAIN_DROPPING: 4,
    CHAIN_SQUISHING: 5,
    NUISANCE_DROPPING: 6
};
const NUISANCE = 0;

class CanvasLayer {
    constructor(width, height, className) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        if (className) {
            this.canvas.className = className;
        }
        this.ctx = this.canvas.getContext('2d');
    }
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class DrawingLayer extends CanvasLayer {
    constructor(width, height, unit, className) {
        super(width, height, className);
        this.unit = unit;
        this.objectsDrawn = [];
        this.drawingState = 0;
        this.defaultArgs = [null, null, null, null, null, null, null, null, null];
    }
    drawHere(appearance, size, sX, sY, dX, dY, sWidth, sHeight, merge) {
        SpriteDrawer.drawSprite(
            this.ctx, appearance,
            size * this.unit, sX, sY,
            dX * this.unit, dY * this.unit, sWidth, sHeight, merge
        );
    }
    drawFromArgs(drawingArgs) {
        const usedArgs = [...this.defaultArgs];
        let drawingArgsIndex = 0;
        usedArgs.forEach((argument, i, arr) => {
            if(argument === null) {
                arr[i] = drawingArgs[drawingArgsIndex];
                drawingArgsIndex++;
            }
        });
        this.drawHere(...usedArgs);
    }
    draw(drawingArgs) {
        this.drawFromArgs(drawingArgs);
        this.objectsDrawn.push(drawingArgs);
    }
    getStateObject() {
        return {drawingState: this.drawingState, objectsDrawn: this.objectsDrawn};
    }
    drawFromStateObject(state) {
        if (state.drawingState !== this.drawingState) {
            state.objectsDrawn.forEach((drawingArgs) => {
                this.drawFromArgs(drawingArgs);
            });
            this.drawingState = state.drawingState;
        }
    }
    setState() {
        this.drawingState++;
        this.drawingState %= NUM_DRAWING_STATES;
    }
    resetState() {
        this.objectsDrawn = [];
        this.clear();
        this.setState();
    }
}

class PuyoDrawingLayer extends DrawingLayer {
    constructor(width, height, unit, appearance, className) {
        super(width, height, unit, className);
        this.defaultArgs[ARG_INDEX.appearance] = appearance;
        this.defaultArgs[ARG_INDEX.size] = 1;
        this.defaultArgs[ARG_INDEX.sWidth] = 1;
        this.defaultArgs[ARG_INDEX.sHeight] = 1;
        this.defaultArgs[ARG_INDEX.merge] = true;
    }
    drawPuyo(colour, dX, dY, directions = []) {
        let xPos, yPos;
        if(colour === 0) {
            xPos = POSITIONS.NUISANCE.X;
            yPos = POSITIONS.NUISANCE.Y;
        }
        else {
            xPos = POSITIONS.PUYO_START.X;
            yPos = POSITIONS.PUYO_START.Y + colour - 1;
            if(directions.includes('Down')) {
                xPos += 1;
            }
            if(directions.includes('Up')) {
                xPos += 2;
            }
            if(directions.includes('Right')) {
                xPos += 4;
            }
            if(directions.includes('Left')) {
                xPos += 8;
            }
        }
        this.draw([xPos, yPos, dX, dY]);
    }
    drawPoppingPuyo(colour, dX, dY, drawPhaseTwo) {
        if(colour === 0) {
            if(!drawPhaseTwo) {
                const xPos = POSITIONS.NUISANCE.X;
                const yPos = POSITIONS.NUISANCE.Y;
                this.draw([xPos, yPos, dX, dY]);
            }
        }
        else {
            const xPos = (colour - 1) * 2 + (drawPhaseTwo ? 7 : 6);
            const yPos = 10;
            this.draw([xPos, yPos, dX, dY]);
        }
    }
    drawDrop(drop, dX, dY) {
        if("IhLHO".includes(drop.shape)) {
            this["draw_" + drop.shape](drop, dX, dY);
        }
        else {
            console.log('lol that\'s not a valid drop shape what kind of shape is ' + drop.shape);
        }
    }
    draw_I(drop, dX, dY) {
        this.drawPuyo(drop.colours[0], dX, dY, []);
        dX += this.unit * Math.cos(drop.standardAngle + Math.PI / 2);
        dY -= this.unit * Math.sin(drop.standardAngle + Math.PI / 2);
        this.drawPuyo(drop.colours[1], dX, dY, []);
    }
}

class GameArea extends CanvasLayer {
    constructor(settings, appearance, scaleFactor = 1) {
        super(
            DIMENSIONS.BOARD.W * scaleFactor + (scaleFactor > DIMENSIONS.MIN_SCALE) ? (DIMENSIONS.MARGIN + DIMENSIONS.QUEUE.W * scaleFactor) : 0,
            DIMENSIONS.BOARD.H * scaleFactor + DIMENSIONS.MARGIN + DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor
        );
        this.settings = settings;
        this.appearance = appearance;
        this.boardLayer = new BoardLayer(settings, appearance, scaleFactor);
        this.nuisanceLayer = new NuisanceLayer(DIMENSIONS.NUISANCE_QUEUE.W * scaleFactor, DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor);
        this.queueLayer = new QueueLayer(DIMENSIONS.QUEUE.W * scaleFactor, DIMENSIONS.QUEUE.H * scaleFactor);
        this.simplified = scaleFactor <= DIMENSIONS.MIN_SCALE;
    }
    update() {
        this.clear();
        this.ctx.drawImage(this.nuisanceLayer.canvas, 0, 0);
        this.ctx.drawImage(this.boardLayer.canvas, 0, this.nuisanceLayer.canvas.height + DIMENSIONS.MARGIN);
        if (!this.simplified) {
            this.ctx.drawImage(this.queueLayer.canvas, this.boardLayer.canvas.width + DIMENSIONS.MARGIN);
        }
    }
    getHash() {
        return JSON.stringify({boardObject: this.boardLayer.getStateObject(), nuisanceObject: this.nuisanceLayer.getStateObject(), queueObject: this.queueLayer.getStateObject()});
    }
    drawFromHash(hash) {
        this.clear();
        const stateObject = JSON.parse(hash);
        this.boardLayer.drawFromStateObject(stateObject.boardObject);
        this.nuisanceLayer.drawFromStateObject(stateObject.nuisanceObject);
        if (!this.simplified) {
            this.queueLayer.drawFromStateObject(stateObject.queueObject);
        }
        this.update();
    }
    updateBoard(currentBoardState) {
        this.boardLayer.updateBoard(currentBoardState);
        this.update();
        return this.getHash();
    }
    resolveChains(resolvingState) {
        this.boardLayer.resolveChains(resolvingState);
        this.update();
        return this.getHash();
    }
    initNuisanceDrop(nuisanceCascadeFPR) {
        this.boardLayer.initNuisanceDrop(nuisanceCascadeFPR);
        this.update();
        return this.getHash();
    }
    dropNuisance(boardState, nuisanceState) {
        this.boardLayer.dropNuisance(boardState, nuisanceState);
        this.update();
        return this.getHash();
    }
}

class BoardLayer extends CanvasLayer {
    constructor(settings, appearance, scaleFactor = 1) {
        super(
            DIMENSIONS.BOARD.W * scaleFactor, DIMENSIONS.BOARD.H * scaleFactor
        );
        this.unit = this.canvas.width / settings.cols;
        this.settings = settings;
        this.appearance = appearance;
        this.stackLayer = new PuyoDrawingLayer(this.canvas.width, this.canvas.height, this.unit, appearance);
        this.dynamicLayer = new PuyoDrawingLayer(this.canvas.width, this.canvas.height, this.unit, appearance);
        this.nuisanceCascadeFPR = [];
        this.mode = null;
    }
    update() {
        this.clear();
        this.ctx.drawImage(this.stackLayer, 0, 0);
        this.ctx.drawImage(this.dynamicLayer, 0, 0);
    }
    getStateObject() {
        return {stackObject: this.stackLayer.getStateObject(), dynamicObject: this.dynamicLayer.getStateObject()};
    }
    drawFromStateObject(stateObject) {
        this.clear();
        this.stackLayer.drawFromStateObject(stateObject.stackObject);
        this.dynamicLayer.drawFromStateObject(stateObject.dynamicObject);
        this.update();
    }
    hasStackChanged(mode) {
        if (this.mode !== mode) {
            this.mode = mode;
            return true;
        }
        return false;
    }
    updateBoard(currentBoardState) {
        const {connections, currentDrop} = currentBoardState;
        if (currentDrop.schezo.y == null) {
            if (this.hasStackChanged(MODE.PUYO_DROPPING)) {
                this.stackLayer.resetState();
                connections.forEach(group => {
                    group.forEach(puyo => {
                        this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
                    });
                });
            }
            this.dynamicLayer.resetState();
            this.dynamicLayer.drawDrop(currentDrop, 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - currentDrop.arle.y);

        }
        else {
            if (this.hasStackChanged(MODE.PUYO_DROPPING_SPLIT)) {
                this.stackLayer.resetState();
                connections.forEach(group => {
                    group.forEach(puyo => {
                        this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
                    });
                });
            }
            this.dynamicLayer.resetState();
            this.dynamicLayer.drawPuyo(currentDrop.colours[0], 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - currentDrop.arle.y);
            this.dynamicLayer.drawPuyo(currentDrop.colours[1], 0.5 + currentDrop.schezo.x, this.settings.rows - 0.5 - currentDrop.schezo.y);
        }
        this.update();
    }
    resolveChains(resolvingState) {
        const {connections, poppedLocs, connectionsAfterPop, unstablePuyos} = resolvingState;
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            if (this.hasStackChanged(MODE.CHAIN_POPPING)) {
                this.stackLayer.resetState();
                connections.forEach(group => {
                    group.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
                        this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
                    });
                });
            }
            this.dynamicLayer.resetState();
            poppedLocs.forEach(puyo => {
                this.dynamicLayer.drawPoppingPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, resolvingState.currentFrame >= this.settings.popFrames / 3);
            });
        }
        else {
            if (this.hasStackChanged(MODE.CHAIN_DROPPING)) {
                this.stackLayer.resetState();
                connectionsAfterPop.forEach(group => {
                    group.forEach(puyo => {
                        this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
                    });
                });
            }
            this.dynamicLayer.resetState();
            unstablePuyos.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
                this.dynamicLayer.drawPuyo(
                    puyo.colour,
                    0.5 + puyo.col,
                    this.settings.rows - 0.5 - Math.max(puyo.row - (puyo.row - puyo.above) * (resolvingState.currentFrame - this.settings.popFrames) / this.settings.dropFrames, puyo.above)
                );
            });
        }
        this.update();
    }
    initNuisanceDrop(nuisanceCascadeFPR) {
        this.nuisanceCascadeFPR = nuisanceCascadeFPR;
        this.update();
    }
    dropNuisance(boardState, nuisanceState) {
        const {nuisanceArray, currentFrame} = nuisanceState;
        if (this.hasStackChanged(MODE.NUISANCE_DROPPING)) {
            this.stackLayer.resetState();
            const connections = new Board(this.settings, boardState).getConnections();
            connections.forEach(group => {
                group.forEach(puyo => {
                    this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
                });
            });
        }
        this.dynamicLayer.resetState();
        for (let i = 0; i < this.settings.cols; i++) {
            const startingRowsAbove = this.settings.nuisanceSpawnRow - boardState[i].length;
            const rowsDropped = Math.min(currentFrame / this.nuisanceCascadeFPR[i], startingRowsAbove);
            for (let j = 0; j < nuisanceArray[i].length; j++) {
                this.dynamicLayer.drawPuyo(NUISANCE, i, this.settings.rows - 0.5 - this.settings.nuisanceSpawnRow + rowsDropped - j);
            }
        }
        this.update();
    }
}

class NuisanceLayer extends PuyoDrawingLayer {
}

class QueueLayer extends PuyoDrawingLayer {
}

/**
 * Class to manage updating for any canvas that draws Puyo (the main board or the queue).
 * The settings should not change over the span of the drawer being used
 * but the update function will need game state info.
 */
class DrawerWithPuyo {
    constructor() {
        this.objectsDrawn = [];
    }
    drawObject(xPos, yPos, size, dX, dY) {
        SpriteDrawer.drawSprite(this.ctx, this.appearance, size, xPos, yPos, dX, dY);
        this.objectsDrawn.push({xPos, yPos, size, dX, dY});
    }
    drawPuyo(colour, size, directions = [], dX, dY) {
        let xPos, yPos;
        if(colour === 0) {
            xPos = 6;
            yPos = 12;
        }
        else {
            xPos = 0;
            yPos = colour - 1;

            if(directions.includes('Down')) {
                xPos += 1;
            }
            if(directions.includes('Up')) {
                xPos += 2;
            }
            if(directions.includes('Right')) {
                xPos += 4;
            }
            if(directions.includes('Left')) {
                xPos += 8;
            }
        }
        this.drawObject(xPos, yPos, size, dX, dY);
    }
    drawPoppingPuyo(colour, size, drawPhaseTwo, dX, dY) {
        if(colour === 0) {
            if(!drawPhaseTwo) {
                this.drawObject(6, 12, size, dX, dY);
            }
            return;
        }
        const xPos = (colour - 1) * 2 + (drawPhaseTwo ? 7 : 6);
        const yPos = 10;

        this.drawObject(xPos, yPos, size, dX, dY);
    }
    drawDrop(drop, size, dX, dY) {
        if ("IhLHO".includes(drop.shape)) {
            this["draw_" + drop.shape](drop, size, dX, dY);
        }
    }
    draw_I(drop, size, dX, dY) {
        this.drawPuyo(drop.colours[0], size, [], dX, dY);

        dX += size * Math.cos(drop.standardAngle + Math.PI / 2);
        dY -= size * Math.sin(drop.standardAngle + Math.PI / 2);

        this.drawPuyo(drop.colours[1], size, [], dX, dY);
    }

    draw_h(drop, size, dX, dY) {
        this.drawPuyo(drop.colours[0], size, [], dX, dY);

        const dX2 = dX + size * Math.cos(drop.standardAngle + Math.PI / 2);
        const dY2 = dY - size * Math.sin(drop.standardAngle + Math.PI / 2);

        this.drawPuyo(drop.colours[0], size, [], dX2, dY2);

        const dX3 = dX + size * Math.cos(drop.standardAngle);
        const dY3 = dY - size * Math.sin(drop.standardAngle);

        this.drawPuyo(drop.colours[1], size, [], dX3, dY3);
    }

    draw_L(drop, size, dX, dY) {
        this.drawPuyo(drop.colours[0], size, [], dX, dY);

        const dX2 = dX + size * Math.cos(drop.standardAngle + Math.PI / 2);
        const dY2 = dY - size * Math.sin(drop.standardAngle + Math.PI / 2);

        this.drawPuyo(drop.colours[1], size, [], dX2, dY2);

        const dX3 = dX + size * Math.cos(drop.standardAngle);
        const dY3 = dY - size * Math.sin(drop.standardAngle);

        this.drawPuyo(drop.colours[0], size, [], dX3, dY3);
    }

    draw_H(drop, size, dX, dY) {
        const xChange = size / Math.sqrt(2) * Math.cos(- drop.standardAngle + Math.PI / 4);
        const yChange = size / Math.sqrt(2) * Math.sin(- drop.standardAngle + Math.PI / 4);

        this.drawPuyo(drop.colours[0], size, [], dX - xChange, dY - yChange);
        this.drawPuyo(drop.colours[0], size, [], dX -yChange, dY + xChange);
        this.drawPuyo(drop.colours[1], size, [], dX + xChange, dY + yChange);
        this.drawPuyo(drop.colours[1], size, [], dX + yChange, dY - xChange);
    }

    draw_O(drop, size, dX, dY) {
        const xChange = size / 2;
        const yChange = size / 2;

        this.drawPuyo(drop.colours[0], size, [], dX - xChange, dY - yChange);
        this.drawPuyo(drop.colours[0], size, [], dX - yChange, dY - xChange);
        this.drawPuyo(drop.colours[0], size, [], dX + xChange, dY + yChange);
        this.drawPuyo(drop.colours[0], size, [], dX + yChange, dY - xChange);
    }
}

/**
 * The drawer for the main area of the game.
 */
class BoardDrawer extends DrawerWithPuyo {
    constructor(settings, appearance, boardNum) {
        super();
        this.board = document.getElementById("board" + boardNum);
        this.ctx = this.board.getContext("2d");
        this.appearance = appearance;
        this.settings = settings;

        this.width = this.board.width;
        this.height = this.board.height;
        this.unitW = this.width / this.settings.cols;
        this.unitH = this.height / this.settings.rows;

        this.nuisanceCascadeFPR = [];
    }

    updateBoard(currentBoardState) {
        // Get current information about what to draw and get current width and height in case of resizing
        const {connections, currentDrop} = currentBoardState;
        const {rows} = this.settings;

        // Clear list of drawn objects
        this.objectsDrawn = [];

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * this.unitW, (rows - 0.5) * this.unitH);

        // Use the connections array instead of board state
        connections.forEach(group => {
            group.forEach(puyo => {
                this.drawPuyo(puyo.colour, this.unitW, puyo.connections, this.unitW * puyo.col, - this.unitH * puyo.row);
            });
        });

        if (currentDrop.schezo.y != null) {
            this.drawPuyo(currentDrop.colours[0], this.unitW, [], this.unitW * currentDrop.arle.x, -this.unitH * currentDrop.arle.y);
            this.drawPuyo(currentDrop.colours[1], this.unitW, [], this.unitW * currentDrop.schezo.x, -this.unitH * currentDrop.schezo.y);
        } else {
            this.drawDrop(currentDrop, this.unitW, this.unitW * currentDrop.arle.x, - this.unitH * currentDrop.arle.y);
        }

        // Restore origin to top left
        ctx.restore();
        return JSON.stringify(this.objectsDrawn);
    }

    resolveChains(resolvingState) {
        // Get current information and assign it to convenient variables
        const {popFrames, dropFrames} = this.settings;
        const {connections, poppedLocs, connectionsAfterPop, unstablePuyos} = resolvingState;
        const {rows} = this.settings;

        // Clear list of drawn objects
        this.objectsDrawn = [];

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * this.unitW, (rows - 0.5) * this.unitH);

        // Draw the stack in the pre-pop positions, with some puyo mid pop
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            connections.forEach(group => {
                group.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
                    this.drawPuyo(puyo.colour, this.unitW, puyo.connections, this.unitW * puyo.col, - this.unitH * puyo.row);
                });
            });

            poppedLocs.forEach(puyo => {
                this.drawPoppingPuyo(
                    puyo.colour,
                    this.unitW,
                    resolvingState.currentFrame >= this.settings.popFrames / 3,
                    this.unitW * puyo.col,
                    -this.unitH * puyo.row
                );
            });
        }
        // Draw the stack dropping with the popped puyos gone
        else {
            // Unaffected puyos
            connectionsAfterPop.forEach(group => {
                group.forEach(puyo => {
                    this.drawPuyo(puyo.colour, this.unitW, puyo.connections, this.unitW * puyo.col, - this.unitH * puyo.row);
                });
            });
            // Unstable Puyos
            unstablePuyos.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
                this.drawPuyo(
                    puyo.colour,
                    this.unitW,
                    [],             // Force drawing of isolated puyo
                    this.unitW * puyo.col,
                    -this.unitH * Math.max(puyo.row - (puyo.row - puyo.above) * (resolvingState.currentFrame - popFrames) / dropFrames, puyo.above)
                );
            });
        }
        ctx.restore();
        return JSON.stringify(this.objectsDrawn);
    }

    initNuisanceDrop(nuisanceCascadeFPR) {
        this.nuisanceCascadeFPR = nuisanceCascadeFPR;
    }

    dropNuisance(boardState, nuisanceState) {
        const {nuisanceArray, currentFrame} = nuisanceState;
        const {cols, rows} = this.settings;

        // Clear list of drawn objects
        this.objectsDrawn = [];

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * this.unitW, (rows - 0.5) * this.unitH);

        const connections = new Board(this.settings, boardState).getConnections();
        connections.forEach(group => {
            group.forEach(puyo => {
                this.drawPuyo(puyo.colour, this.unitW, puyo.connections, this.unitW * puyo.col, - this.unitH * puyo.row);
            });
        });

        for (let i = 0; i < cols; i++) {
            const startingRowsAbove = this.settings.nuisanceSpawnRow - boardState[i].length;
            const rowsDropped = Math.min(currentFrame / this.nuisanceCascadeFPR[i], startingRowsAbove);
            for (let j = 0; j < nuisanceArray[i].length; j++) {
                this.drawPuyo(0, this.unitW, [], this.unitW * i, -this.unitH * (this.settings.nuisanceSpawnRow - rowsDropped + j));
            }
        }

        // Restore origin to top left
        ctx.restore();
        return JSON.stringify(this.objectsDrawn);
    }

    drawFromHash(hash) {
        const objects = JSON.parse(hash);
        const {rows} = this.settings;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * this.unitW, (rows - 0.5) * this.unitH);

        objects.forEach(object => {
            const { xPos, yPos, size, dX, dY } = object;
            this.drawObject(xPos, yPos, size, dX, dY);
        });

        ctx.restore();
    }
}

module.exports = { BoardDrawer, GameArea };
