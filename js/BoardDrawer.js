'use strict';

window.BoardDrawer = class BoardDrawer{
    constructor(settings) {
        this.settings = settings;
    }

    updateBoard(currentBoardState) {
        // alert("updateBoard started")
        const { boardState, currentDrop } = currentBoardState;

        let board = document.getElementById("board");
        let ctx = board.getContext("2d");
        ctx.clearRect(0, 0, board.width, board.height);
        ctx.save();
        ctx.translate(0.5 * board.width / this.settings.cols, (this.settings.rows - 0.5) * board.height / this.settings.rows);
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
            ctx.beginPath();
            ctx.arc(0, 0, board.width / this.settings.cols / 2, 0, 2 * Math.PI);
            ctx.fillStyle = colour;
            ctx.fill();

            ctx.translate(- board.width / this.settings.cols / 5, -board.width / this.settings.cols / 10);

            ctx.beginPath();
            ctx.arc(0, 0, board.width / this.settings.cols / 5, 0, 2 * Math.PI);
            ctx.translate(2 * board.width / this.settings.cols / 5, 0);
            ctx.arc(0, 0, board.width / this.settings.cols / 5, 0, 2 * Math.PI);
            ctx.fillStyle = window.PUYO_EYES_COLOUR;
            ctx.fill();
        }
        function drawSingle(xPos, yPos, colour) {
            ctx.save();
            ctx.translate(board.width / this.settings.cols * xPos, - board.height / this.settings.rows * yPos);
            drawPuyo(colour);
            ctx.restore();
        }
        function draw_I(drop) {
            ctx.save();
            ctx.translate(board.width / this.settings.cols * drop.arle.x, - board.height / this.settings.rows * drop.arle.y);
            //alert(`${board.width / this.settings.cols * drop.arle.x} and ${- board.height / this.settings.rows * drop.arle.y}`);
            ctx.save();
            drawPuyo(drop.colours[0]);
            ctx.restore();
            ctx.translate(board.width / this.settings.cols * Math.cos(drop.standardAngle - Math.PI / 2), - board.height / this.settings.rows * Math.sin(drop.standardAngle - Math.PI / 2));
            drawPuyo(drop.colours[1]);
            ctx.restore();
            ctx.restore();
        }
        /* eslint-disable-next-line no-unused-vars */
        function draw_h(drop) {
            // TODO: program this
        }
        /* eslint-disable-next-line no-unused-vars */
        function draw_L(drop) {
            // TODO: program this
        }
        /* eslint-disable-next-line no-unused-vars */
        function draw_H(drop) {
            // TODO: program this
        }
        /* eslint-disable-next-line no-unused-vars */
        function draw_O(drop) {
            // TODO: program this
        }
        function drawDrop(drop) {
            switch (drop.shape) {
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
        }
    }
}
