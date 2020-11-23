'use strict';

const { MOCK_UID } = require('../support/index.js');

const io_client = require('socket.io-client');
const socket = io_client.connect('http://localhost:3000');

let testPassword = 'pas3sword';
let roomId;

describe('Passworded room', () => {
	it('can create a passworded room', () => {
		cy.get('#customPanel').click();
		cy.get('#createRoom').click();
		cy.get('#createRoomSubmit').click();

		cy.get('#joinIdLink').should((element) => {
			roomId = element.val().split('=')[1];
		});

		cy.get('#giveJoinId').find('.close').click();

		cy.contains('Set Password').click();
		cy.get('#roomPasswordModal').find('input[type="text"]').type(testPassword);
		cy.get('#roomPasswordForm').submit();
	});

	it('saves the previous password', () => {
		cy.contains('Set Password').click();
		cy.get('#roomPasswordModal').find('input[type="text"]').should((element) => {
			expect(element.val()).to.equal(testPassword);
		});
		cy.get('#roomPasswordModal').find('.close').click();
	});

	it('should prevent people from joining without a password', async () => {
		const password_required = new Promise((resolve) => {
			socket.on('requireRoomPassword', () => {
				resolve('requireRoomPassword');
			});
			setTimeout(() => resolve('timed out'), 3000);
		});

		socket.emit('joinRoom', { gameId: MOCK_UID, joinId: roomId });

		const result = await password_required;
		expect(result).to.equal('requireRoomPassword');

		socket.off('requireRoomPassword');
	});

	it('should prevent people from joining with the wrong password', async () => {
		const password_required = new Promise((resolve) => {
			socket.on('joinRoomPasswordFailure', () => {
				resolve('joinRoomPasswordFailure');
			});
			setTimeout(() => resolve('timed out'), 3000);
		});

		socket.emit('joinRoom', { gameId: MOCK_UID, joinId: roomId, roomPassword: 'bleh' });

		const result = await password_required;
		expect(result).to.equal('joinRoomPasswordFailure');

		socket.off('joinRoomPasswordFailure');
	});

	it('should let people join with the correct password', async () => {
		const password_required = new Promise((resolve) => {
			socket.on('roomUpdate', () => {
				resolve('roomUpdate');
			});
			setTimeout(() => resolve('timed out'), 3000);
		});

		socket.emit('joinRoom', { gameId: MOCK_UID, joinId: roomId, roomPassword: testPassword });

		const result = await password_required;
		expect(result).to.equal('roomUpdate');

		socket.off('roomUpdate');
	});
});
