'use strict';

import { TEST_USERNAME } from '../support/index.js';

describe('Custom rooms', () => {
	it('can create a room', () => {
		cy.get('#customPanel').click();
		cy.get('#createRoom').click();
		cy.get('#createRoomSubmit').click();
		cy.get('#giveJoinId').find('.close').click();
		cy.get('#statusArea').contains('Manage CPUs');
	});

	it('cannot spectate a room when there is only one player', () => {
		cy.get('#manageSpectate').click();
		cy.contains('You cannot spectate').should('be.visible');
		cy.contains('OK').click();
	});

	it('can view the room join link', () => {
		cy.get('#manageJoinLink').click();
		cy.get('#giveJoinId').should('be.visible');
		cy.get('#joinIdLink').then(element => {
			const joinLink = element.val();
			expect(joinLink).to.include('http://localhost:3000/?joinRoom=');
		});
		cy.get('#giveJoinId > .close').click();
	});
});
