let c = document.getElementById("board");
let ctx = c.getContext("2d");
const PUYO_RED = "rgba(200, 20, 20, 0.9)";
const PUYO_BLUE = "rgba(20, 20, 200, 0.9)";
const PUYO_GREEN = "rgba(20, 200, 20, 0.9)";
const PUYO_EYES = "rgba(255, 255, 255, 0.7)";

alert("begin script")

function fillBlock(xPos, yPos, colour) {
    ctx.beginPath();
    ctx.fillStyle = colour;
    ctx.arc(xPos * 25 + 25 / 2, 300 - (yPos + 0.5) * 25, 25 / 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = PUYO_EYES;
    ctx.arc(xPos * 25 + 25 / 2 - 5, 300 - (yPos + 0.5) * 25 - 3, 5, 0, 2 * Math.PI);
    ctx.arc(xPos * 25 + 25 / 2 + 5, 300 - (yPos + 0.5) * 25 - 3, 5, 0, 2 * Math.PI);
    ctx.fill();
}
fillBlock(0, 1, PUYO_RED);
fillBlock(0, 2, PUYO_RED);
fillBlock(1, 1, PUYO_RED);
fillBlock(0, 0, PUYO_BLUE);
fillBlock(1, 0, PUYO_BLUE);
fillBlock(2, 1, PUYO_BLUE);
fillBlock(1, 2, PUYO_BLUE);
fillBlock(2, 0, PUYO_GREEN);
