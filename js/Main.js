'use strict';

(function () {
	const socket = window.io();
	let game, gameId;
	let cpuGames = [];

	// Dictionary of all URL query parameters
	const urlParams = new URLSearchParams(window.location.search);

	const cpu = urlParams.get('cpu') === 'true';				// Flag to play against a CPU
	const noPlayer = urlParams.get('player') === 'false';		// Flag to let CPU play for you
	const createRoom = urlParams.get('createRoom') === 'true';	// Flag to create a room
	const ranked = urlParams.get('ranked') === 'true';			// Flag to join ranked queue
	const joinId = urlParams.get('joinRoom');					// Flag to join a room

	let gameInfo = { gameId: null, settingsString: new window.Settings().toString(), joinId };

	// Send a registration request to the server to receive a gameId
	socket.emit('register');

	socket.on('getGameId', id => {
		gameId = id;
		gameInfo.gameId = id;
		// CPU overrides all other options
		if(cpu) {
			socket.emit('cpuMatch', gameInfo);
			console.log('Starting CPU match...');
		}
		else if(createRoom) {
			// TODO: Allow changing of room settings
			const roomSize = urlParams.get('size');			// Size of the room
			gameInfo.roomSize = Number(roomSize) || 2;

			socket.emit('createRoom', gameInfo);
			console.log('Creating a room...');
		}
		else if(joinId !== null) {
			socket.emit('joinRoom', gameInfo);
			console.log('Joining a room...');
		}
		else if(ranked) {
			socket.emit('ranked', gameInfo);
			console.log('Finding a match...')
		}
		else {
			socket.emit('quickPlay', gameInfo);
			console.log('Awaiting match...');
		}
	});

	socket.on('giveRoomId', id => {
		console.log('Other players can join this room by appending ?joinRoom=' + id);
	});

	socket.on('joinFailure', () => {
		console.log('ERROR: Unable to join room as this room id is not currently in use.');
	});

	socket.on('roomUpdate', (allIds, roomSize, settingsString) => {
		console.log('Current players: ' + allIds);
		if(roomSize > allIds.length) {
			console.log('Waiting for ' + (roomSize - allIds.length) + ' more players.');
		}
		console.log('Settings: ' + window.Settings.fromString(settingsString));
	});

	socket.on('start', (opponentIds, settingsString) => {
		console.log('gameId: ' + gameId + ' opponents: ' + JSON.stringify(opponentIds));

		if(noPlayer) {
			game = new window.CpuGame(gameId, opponentIds, socket, 1, new window.TestCpu(), window.Settings.fromString(settingsString));
		}
		else {
			game = new window.PlayerGame(gameId, opponentIds, socket, window.Settings.fromString(settingsString), new window.UserSettings());
		}

		let boardDrawerCounter = 2;
		const allIds = opponentIds.slice();
		allIds.push(gameId);

		// Create the CPU games
		cpuGames = opponentIds.filter(id => id < 0).map(id => {
			const thisSocket = window.io();
			const thisOppIds = allIds.slice();
			thisOppIds.splice(allIds.indexOf(id), 1);

			const thisGame = new window.CpuGame(
				id,
				thisOppIds,
				thisSocket,
				boardDrawerCounter,
				new window.TestCpu(),
				window.Settings.fromString(settingsString));

			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, id };
		});
		main();
	});

	let finalMessage = null;		// The message to be displayed

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		cpuGames.forEach(cpuGame => cpuGame.game.step());
		if(finalMessage !== null) {
			window.cancelAnimationFrame(mainFrame);
			console.log(finalMessage);
			return;
		}
		const endResult = game.end();
		if(endResult !== null) {
			switch(endResult) {
				case 'Win':
					finalMessage = 'You win!';
					socket.emit('gameEnd', gameId);
					break;
				case 'Loss':
					finalMessage = 'You lose...';
					socket.emit('gameOver', gameId);
					break;
				case 'OppDisconnect':
					finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
					break;
			}
		}

		cpuGames.forEach(cpuGame => {
			const cpuEndResult = cpuGame.game.end();
			if(cpuEndResult !== null) {
				switch(cpuEndResult) {
					case 'Win':
						// finalMessage = 'You win!';
						cpuGame.socket.emit('gameEnd', cpuGame.id);
						break;
					case 'Loss':
						// finalMessage = 'You lose...';
						cpuGame.socket.emit('gameOver', cpuGame.id);
						break;
					case 'OppDisconnect':
						// finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
						break;
				}
			}
		});
	}
})();
