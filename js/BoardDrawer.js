'use strict';

let sampleBoardState = [
    //   0  1  2  3  4  5  6
    [null, null, null, null, null, null], // 11
    [null, null, null, null, null, null], // 10
    [null, null, null, null, null, null], // 9
    [null, null, null, null, null, null], // 8
    [null, 3, null, null, null, null], // 7
    [null, 4, null, null, null, null], // 6
    [1, 4, null, null, null, null], // 5
    [3, 4, null, null, null, null], // 4
    [3, 3, null, null, null, null], // 3
    [1, 0, null, null, null, null], // 2
    [1, 1, 0, null, null, null], // 1
    [0, 0, 2, null, null, null],  // 0
]
let droppingX = [0.5, 1.5];
let droppingY = [9.1, 9.1];
let droppingColour = [PUYO_COLOURS[4], PUYO_COLOURS[3]];

sampleBoardState = sampleBoardState.reverse();

function updateBoard(currentBoardState) {
    const { boardState, droppingX, droppingY, droppingColour } = currentBoardState;
    let board = document.getElementById("board");
    let ctx = board.getContext("2d");
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.save(); // save plain state

    function drawPuyo(xPos, yPos, colour) {
        ctx.translate(board.width / COLS * xPos, - board.height / ROWS * yPos);
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
    }
    
    ctx.translate(0.5 * board.width / COLS, (ROWS - 0.5) * board.height / ROWS);
    ctx.save(); // save stacked state
    for (let j = boardState.length - 1; j >= 0; j--) {
        for (let i = boardState[j].length - 1; i >= 0; i--) {
            if (boardState[j][i] != null) {
                //alert("drawing puyo at (" + i + ", " + j + ")");
                drawPuyo(i, j, PUYO_COLOURS[boardState[j][i]]);
            }
        }
    }
    ctx.restore(); // restore to stacked state
    ctx.restore(); // restore to plain state

    ctx.translate(0, board.height);
    ctx.save(); // save dropping state
    for (let i = droppingColour.length - 1; i >= 0; i--) {
        //alert("drawing puyo at (" + droppingX[i] + ", " + droppingY[i] + ") with colour " + droppingColour[i]);
        drawPuyo(droppingX[i], droppingY[i], droppingColour[i]);
    }

    ctx.restore(); // restore to dropping state
    ctx.restore(); // restore to plain state
}

//updateBoard(sampleBoardState);
