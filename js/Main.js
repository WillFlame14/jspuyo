'use strict';

(function () {
	const game = new Game('Tsu');

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step(mainFrame);
		updateBoard(game.getBoardState());
	}

	main();
})();


