'use strict';

function updateBoard(currentBoardState) {
    const { boardState, currentDrop } = currentBoardState;
    const schezo = getOtherPuyo(currentDrop);
    const droppingX = [currentDrop.arle.x, schezo.x];
    const droppingY = [currentDrop.arle.y, schezo.y];
    const droppingColour = currentDrop.colours;
    
    let board = document.getElementById("board");
    let ctx = board.getContext("2d");
    ctx.clearRect(0, 0, board.width, board.height);
    //alert("cleared board");
    ctx.save(); // save plain state

    function drawPuyo(xPos, yPos, colour) {
        ctx.translate(board.width / COLS * xPos, - board.height / ROWS * yPos);
        //alert("moved origin " + xPos + " right and " + yPos + " up");
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

        ctx.restore(); // restore to stacked/dropping state
        ctx.save(); // add stacked/dropping state back
        //alert("restored origin");
    }
    
    ctx.translate(0.5 * board.width / COLS, (ROWS - 0.5) * board.height / ROWS);
    ctx.save(); // save stacked state
    for (let j = boardState.length - 1; j >= 0; j--) {
        for (let i = boardState[j].length - 1; i >= 0; i--) {
            if (boardState[j][i] != null) {
                //alert("drawing puyo at (" + i + ", " + j + ")");
                drawPuyo(j, i, boardState[j][i]);
            }
        }
    }
    ctx.restore(); // restore to stacked state
    ctx.restore(); // restore to plain state
    ctx.save();

    ctx.translate(0, board.height);
    ctx.save(); // save dropping state
    for (let i = droppingColour.length - 1; i >= 0; i--) {
        drawPuyo(droppingX[i], droppingY[i], droppingColour[i]);
        //alert("drew puyo centred at (" + droppingX[i] + ", " + droppingY[i] + ") with colour " + droppingColour[i]);
    }

    ctx.restore(); // restore to dropping state
    ctx.restore(); // restore to plain state
}

