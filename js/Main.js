'use strict';

(function () {
	const game = new Game('Tsu');

	function main() {
		window.requestAnimationFrame(main);
		game.affectGravity();
		updateBoard(game.getBoardState());
	}

	main();
})();


