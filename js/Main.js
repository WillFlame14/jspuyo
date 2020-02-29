'use strict';

(function () {
	const game = new window.Game('Tsu');

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step(mainFrame);
		game.updateBoard();
	}

	main();
})();
