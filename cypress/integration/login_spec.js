'use strict';

import { TEST_USERNAME } from '../support/index.js';

describe('Login flow', () => {
	it('can log out if logged in', () => {
		cy.visit('/').then(async () => {
			cy.wait(500);
			// Log out if already logged in
			cy.get('#welcomeMessage').then(element => {
				if(!element.is(':visible')) {
					cy.get('#profilePanel').click();
					cy.contains('Log Out').click();
				}
			});
		});
	});

	it('can login a guest account', () => {
		cy.get('#welcomeMessage').should('be.visible');
		cy.contains('Continue as guest').click();
		cy.get('#usernamePickerText').type(TEST_USERNAME);
		cy.contains('Confirm').click();

		cy.get('.playerList').should('contain', TEST_USERNAME);
	});
});
