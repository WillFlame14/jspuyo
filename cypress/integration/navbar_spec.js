'use strict';

import { TEST_USERNAME } from '../support/index.js';

// NOTE: For all future tests, the user is assumed to be logged in.

describe('Navbar', () => {
	it('can expand the Queue navbar panel', () => {
		cy.get('#queuePanel').should('not.have.class', 'expanded');
		cy.get('#queuePanel').click();
		cy.get('#queuePanel').should('have.class', 'expanded');
	});

	it('can expand the Custom Room navbar panel', () => {
		cy.get('#customPanel').should('not.have.class', 'expanded');
		cy.get('#customPanel').click();
		cy.get('#customPanel').should('have.class', 'expanded');
		cy.get('#queuePanel').should('not.have.class', 'expanded');
	});

	it('can expand the Singleplayer navbar panel', () => {
		cy.get('#singleplayerPanel').should('not.have.class', 'expanded');
		cy.get('#singleplayerPanel').click();
		cy.get('#singleplayerPanel').should('have.class', 'expanded');
		cy.get('#customPanel').should('not.have.class', 'expanded');
	});

	it('can expand the Profile navbar panel', () => {
		cy.get('#profilePanel').should('not.have.class', 'expanded');
		cy.get('#profilePanel').click();
		cy.get('#profilePanel').should('have.class', 'expanded');
		cy.get('#singleplayerPanel').should('not.have.class', 'expanded');
	});

	it('can close the currently open navbar panel', () => {
		cy.get('#profilePanel').click();

		const panelIds = ['#profilePanel', '#queuePanel', '#customPanel', '#singleplayerPanel'];
		panelIds.forEach(id => {
			cy.get(id).should('not.have.class', 'expanded');
		});
	});

	it('can join the Ranked queue', () => {
		cy.get('#queuePanel').click();
		cy.contains('Ranked').click();

		cy.get('#statusGamemode').should('contain', 'Ranked');
		cy.get('#playerList').should('contain', TEST_USERNAME);
	});

	it('cannot rejoin the Ranked room when already in it', () => {
		cy.get('#queuePanel').click();
		cy.contains('Ranked').click();

		cy.get('#joinRoomModal .errorMsg').should('be.visible');
		cy.get('#joinRoomModal > .close').click();
	});

	it('can rejoin the FFA queue', () => {
		cy.get('#queuePanel').click();
		cy.contains('Free for all').click();

		cy.get('#statusGamemode').should('contain', 'Free For All');
		cy.get('#playerList').should('contain', TEST_USERNAME);
	});

	it('cannot rejoin the FFA room when already in it', () => {
		cy.get('#queuePanel').click();
		cy.contains('Free for all').click();

		cy.get('#joinRoomModal .errorMsg').should('be.visible');
		cy.get('#joinRoomModal > .close').click();
	});
});
