const PUYO_COLOURS = ["rgba(200, 20, 20, 0.9)", "rgba(20, 200, 20, 0.9)", "rgba(20, 20, 200, 0.9)", "rgba(150, 150, 20, 0.9)", "rgba(150, 20, 150, 0.9)"];
const PUYO_EYES = "rgba(255, 255, 255, 0.7)";
const COLS = 6;
const ROWS = 12;

let boardState = [
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

boardState = boardState.reverse();

function updateBoard() {
    let board = document.getElementById("board");
    let ctx = board.getContext("2d");
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.translate(0.5 * board.width / COLS, (ROWS - 0.5) * board.height / ROWS);
    ctx.save();
    function drawPlaced(xPos, yPos, colour) {
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
        ctx.fillStyle = PUYO_EYES;
        ctx.fill();

        ctx.restore();
        ctx.save();
    }
    for (let j = boardState.length - 1; j >= 0; j--) {
        for (let i = boardState[j].length - 1; i >= 0; i--) {
            if (boardState[j][i] != null) {
                //alert("drawing puyo at (" + i + ", " + j + ")");
                drawPlaced(i, j, PUYO_COLOURS[boardState[j][i]]);
            }
        }
    }
}

updateBoard();
