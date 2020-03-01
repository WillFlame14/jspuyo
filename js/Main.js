'use strict';

(function () {
	const game = new window.Game('Tsu');
	let gameOver = false;

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		game.updateBoard();
		if(gameOver) {
			window.cancelAnimationFrame(mainFrame);
			alert("Game over!");
		}
		if(game.gameOver()) {
			gameOver = true;
		}
	}

	main();
})();
