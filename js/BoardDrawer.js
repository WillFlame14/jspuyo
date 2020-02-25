let c = document.getElementById("mainCanvas");
let ctx = c.getContext("2d");

ctx.fillRect(25, 250, 25, 25);

function fillBlock(xPos, yPos, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(xPos * 25, 300 - (yPos + 1) * 25, 25, 25);
}
fillBlock(0, 1, "red");
fillBlock(0, 2, "red");
fillBlock(1, 1, "red");
fillBlock(0, 0, "blue");
fillBlock(1, 0, "blue");
fillBlock(2, 1, "blue");
fillBlock(1, 2, "blue");
fillBlock(2, 0, "green");

