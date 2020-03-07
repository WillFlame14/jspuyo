'use strict';

(function () {
	const game = new window.Game('Tsu');
	let gameOver = false;		// Flag so that one last frame is requested before termination

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
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
