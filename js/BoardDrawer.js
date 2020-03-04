'use strict';

window.BoardDrawer = class BoardDrawer{
    constructor(settings) {
        this.settings = settings;
    }

    updateBoard(currentBoardState) {
        // alert("updateBoard started")
        const { boardState, currentDrop } = currentBoardState;
        const settings = this.settings;

        let board = document.getElementById("board");
        let ctx = board.getContext("2d");
        ctx.clearRect(0, 0, board.width, board.height);
        ctx.save();
        ctx.translate(0.5 * board.width / settings.cols, (settings.rows - 0.5) * board.height / settings.rows);
        for (let j = boardState.length - 1; j >= 0; j--) {
            for (let i = boardState[j].length - 1; i >= 0; i--) {
                // alert("drawing single at " + j + " " + i);
                if (boardState[j][i] != null) {
                    drawSingle(j, i, boardState[j][i]);
                }
            }
        }
        drawDrop(currentDrop);
        ctx.restore();

        function drawPuyo(colour) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, board.width / settings.cols / 2, 0, 2 * Math.PI);
            ctx.fillStyle = colour;
            ctx.fill();
            ctx.translate(- board.width / settings.cols / 5, -board.width / settings.cols / 10);
            ctx.beginPath();
            ctx.arc(0, 0, board.width / settings.cols / 5, 0, 2 * Math.PI);
            ctx.translate(2 * board.width / settings.cols / 5, 0);
            ctx.arc(0, 0, board.width / settings.cols / 5, 0, 2 * Math.PI);
            ctx.fillStyle = window.PUYO_EYES_COLOUR;
            ctx.fill();
            ctx.restore();
        }

        function drawSingle(xPos, yPos, colour) {
            ctx.save();
            ctx.translate(board.width / settings.cols * xPos, - board.height / settings.rows * yPos);
            drawPuyo(colour);
            ctx.restore();
        }

        function drawDrop(drop) {
            ctx.translate(board.width / settings.cols * drop.arle.x, - board.height / settings.rows * drop.arle.y);
            ctx.save();
            switch (currentDrop.shape) {
                case 'I':
                    draw_I(drop);
                    break;
                case 'h':
                    draw_h(drop);
                    break;
                case 'L':
                    draw_L(drop);
                    break;
                case 'H':
                    draw_H(drop);
                    break;
                case 'O':
                    draw_O(drop);
                    break;
            }
            ctx.restore();
        }

        function draw_I(drop) {
            //alert(`${board.width / settings.cols * drop.arle.x} and ${- board.height / settings.rows * drop.arle.y}`);
            drawPuyo(drop.colours[0]);
            ctx.translate(board.width / settings.cols * Math.cos(drop.standardAngle + Math.PI / 2), - board.height / settings.rows * Math.sin(drop.standardAngle + Math.PI / 2));
            drawPuyo(drop.colours[1]);
        }

        function draw_h(drop) {
            drawPuyo(drop.colours[0]);
            ctx.translate(board.width / settings.cols * Math.cos(drop.standardAngle + Math.PI / 2), - board.height / settings.rows * Math.sin(drop.standardAngle + Math.PI / 2));
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.save();
            ctx.translate(board.width / settings.cols * Math.cos(drop.standardAngle), - board.height / settings.rows * Math.sin(drop.standardAngle));
            drawPuyo(drop.colours[1]);
        }

        function draw_L(drop) {
            drawPuyo(drop.colours[0]);
            ctx.translate(board.width / settings.cols * Math.cos(drop.standardAngle + Math.PI / 2), - board.height / settings.rows * Math.sin(drop.standardAngle + Math.PI / 2));
            drawPuyo(drop.colours[1]);
            ctx.restore();
            ctx.save();
            ctx.translate(board.width / settings.cols * Math.cos(drop.standardAngle), - board.height / settings.rows * Math.sin(drop.standardAngle));
            drawPuyo(drop.colours[0]);
        }

        function draw_H(drop) {
            let xChange = board.width / settings.cols / Math.sqrt(2) * Math.cos(- drop.standardAngle + Math.PI / 4);
            let yChange = board.height / settings.rows / Math.sqrt(2) * Math.sin(- drop.standardAngle + Math.PI / 4);
            ctx.translate(- xChange, - yChange);
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.save();
            ctx.translate(- yChange, xChange);
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.save();
            ctx.translate(xChange, yChange);
            drawPuyo(drop.colours[1]);
            ctx.restore();
            ctx.save();
            ctx.translate(yChange, - xChange);
            drawPuyo(drop.colours[1]);
        }

        function draw_O(drop) {
            let xChange = board.width / settings.cols / 2;
            let yChange = board.height / settings.rows / 2;
            ctx.translate(- xChange, - yChange);
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.save();
            ctx.translate(- yChange, xChange);
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.save();
            ctx.translate(xChange, yChange);
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.save();
            ctx.translate(yChange, - xChange);
            drawPuyo(drop.colours[0]);
        }
    }
}
