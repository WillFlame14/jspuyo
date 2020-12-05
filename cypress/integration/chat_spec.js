'use strict';

const { MOCK_UID } = require('../support/index.js');

const io_client = require('socket.io-client');
const socket = io_client.connect('http://localhost:3000');

let roomId;

describe('Chatting', () => {
	it('can send and receive a chat message', () => {
		cy.get('#messageField').type('test message');
		cy.get('#sendMessage').submit();
		cy.get('#chatMessages').contains('test message');
	});

	it('can correctly chain chat messages', () => {
		// Send two more chat messages
		cy.get('#messageField').type('this is another');
		cy.get('#sendMessage').submit();
		cy.get('#messageField').type('aaaaa');
		cy.get('#sendMessage').submit();

		// The chat messages should be combined into one
		cy.get('#chatMessages').find('li').then(elements => {
			expect(elements.length).to.equal(1);
		});
		cy.get('#chatMessages').contains('this is another');
		cy.get('#chatMessages').contains('aaaaa');
	});

	it('should clear chat messages when joining a new room', () => {
		cy.get('#customPanel').click();
		cy.get('#createRoom').click();
		cy.get('#createRoomSubmit').click();

		cy.get('#joinIdLink').should((element) => {
			roomId = element.val().split('=')[1];
		});

		cy.get('#giveJoinId').find('.close').click();

		cy.get('#chatMessages').then((element) => {
			expect(element.children().length).to.equal(0);
		});
	});

	it('can receive chat messages sent by someone else', () => {
		cy.get('#messageField').type('test message');
		cy.get('#sendMessage').submit();

		// Send a message from the test socket
		socket.emit('sendMessage', MOCK_UID, 'different message', roomId);

		cy.get('#chatMessages').contains('different message');
		cy.get('#chatMessages').find('li').then(elements => {
			expect(elements.length).to.equal(2);
		});
	});
});
