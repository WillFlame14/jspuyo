'use strict';

function updateBoard(currentBoardState) {
    // alert("updateBoard started")
    const { boardState, currentDrop } = currentBoardState;

    let board = document.getElementById("board");
    let ctx = board.getContext("2d");
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.translate(0.5 * board.width / COLS, (ROWS - 0.5) * board.height / ROWS);
    for (let j = boardState.length - 1; j >= 0; j--) {
        for (let i = boardState[j].length - 1; i >= 0; i--) {
            // alert("drawing single at " + j + " " + i);
            if (boardState[j][i] != null) {
                drawSingle(j, i, boardState[j][i]);
            }
        }
    }
    drawDrop(currentDrop);

    function drawPuyo(colour) {
        ctx.beginPath();
        ctx.arc(0, 0, board.width / COLS / 2, 0, 2 * Math.PI);
        ctx.fillStyle = colour;
        ctx.fill();

        ctx.translate(- board.width / COLS / 5, -board.width / COLS / 10);
        ctx.beginPath();
        ctx.arc(0, 0, board.width / COLS / 5, 0, 2 * Math.PI);
        ctx.translate(2 * board.width / COLS / 5, 0);
        ctx.arc(0, 0, board.width / COLS / 5, 0, 2 * Math.PI);
        ctx.fillStyle = PUYO_EYES_COLOUR;
        ctx.fill();
    }
    function drawSingle(xPos, yPos, colour) {
        ctx.save();
        ctx.translate(board.width / COLS * xPos, - board.height / ROWS * yPos);
        drawPuyo(colour);
        ctx.restore();
    }
    function draw_I(drop xPos, yPos, angle, colourArle, colourSchezo) {
        ctx.save();
        ctx.translate(board.width / COLS * drop.arle.x - board.height / ROWS * drop.arle.y);
        ctx.save();
        drawPuyo(drop.colours[0]);
        ctx.restore();
        ctx.translate(board.width / COLS * Math.cos(drop.standardAngle), - board.height / ROWS * Math.sin(drop.standardAngle));
        drawPuyo(drop.colours[1]);
        ctx.restore();
        ctx.restore();
    }
    function draw_h(drop) {
        // TODO: program this
    }
    function draw_L(drop) {
        // TODO: program this
    }
    function draw_H(drop) {
        // TODO: program this
    }
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
