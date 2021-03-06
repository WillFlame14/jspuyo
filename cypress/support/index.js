// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

const TEST_USERNAME = 'cypressTest';
const MOCK_UID = '070fPnWMWCfuHZPIav9ZxWyhA8V2';

before(() => {
	cy.visit('/').then(() => {
		cy.wait(500);
		// Make sure user is logged in
		cy.get('#welcomeMessage').then(element => {
			if(element.is(':visible')) {
				cy.contains('Continue as guest').click();
				cy.get('#usernamePickerText').type(TEST_USERNAME);
				cy.contains('Confirm').click();
			}
			cy.contains('Free For All', { timeout: 20000 }).should('be.visible');
		});
	});
});

module.exports = { TEST_USERNAME, MOCK_UID };
