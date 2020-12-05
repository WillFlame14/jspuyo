'use strict';

import { TEST_USERNAME } from '../support/index.js';

describe('CPU options', () => {
	before(() => {
		// Create a custom room
		cy.get('#customPanel').click();
		cy.get('#createRoom').click();
		cy.get('#createRoomSubmit').click();
		cy.get('#giveJoinId').find('.close').click();
	})

	beforeEach(() => {
		// Close CPU Options modal if it is open (i.e. a test failed and left incomplete state)
		cy.get('#cpuRoomModal').then(element => {
			if(element.is(':visible')) {
				cy.get('#cpuRoomModal').find('.close').click();
			}
		})
	});

	it('can add and remove CPUs', () => {
		// No CPUs in room, should show message
		cy.get('#manageCpus').click();
		cy.contains('No CPUs in room');

		// One CPU should become visible
		cy.get('#cpuOptionsAdd').click();
		cy.get('.cpuOption').should(elements => {
			expect(elements.filter((index, element) => Cypress.$(element).is(':visible')).length).to.equal(1);
		});
		cy.get('#cpuOptions').should('not.contain', 'No CPUs in room');

		// Fill up the room to 3 CPUs
		cy.get('#cpuOptionsAdd').click();
		cy.get('#cpuOptionsAdd').click();
		cy.get('.cpuOption').should(elements => {
			expect(elements.filter((index, element) => Cypress.$(element).is(':visible')).length).to.equal(3);
		});

		// Cannot add more than 3 CPUs, since the room has a size of 4
		cy.get('#cpuOptionsAdd').click();
		cy.get('.errorMsg').should('be.visible');

		// Remove one CPU, down to 2
		cy.get('#cpuOptionsRemove').click();
		cy.get('.cpuOption').should(elements => {
			expect(elements.filter((index, element) => Cypress.$(element).is(':visible')).length).to.equal(2);
		});
		cy.get('.errorMsg').should('not.be.visible');

		// Remove remaining CPUs
		cy.get('#cpuOptionsRemove').click();
		cy.get('#cpuOptionsRemove').click();
		cy.contains('No CPUs in room');

		// Cannot remove any more CPUs
		cy.get('#cpuOptionsRemove').click();
		cy.get('.errorMsg').should('be.visible');
		cy.get('#cpuOptionsModal > .close').click();
	});

	it('remembers selected CPUs', () => {
		cy.get('#manageCpus').click();
		cy.contains('No CPUs in room');

		// Add 2 CPUs
		cy.get('#cpuOptionsAdd').click();
		cy.get('#cpuOptionsAdd').click();
		cy.get('#cpuOptionsSubmit').click();

		// CPUs should show up in player list
		cy.get('.playerIndividual').should('have.length', 3);
		cy.get('#playerList').should('contain', TEST_USERNAME);
		cy.get('#playerList').should('contain', 'CPU');

		// CPUs should still be in Manage CPUs modal
		cy.get('#manageCpus').click();
		cy.get('.cpuOption').should(elements => {
			expect(elements.filter((index, element) => Cypress.$(element).is(':visible')).length).to.equal(2);
		});
		cy.get('#cpuOptionsSubmit').click();

		// Just submitting the modal should not change the number of CPUs
		cy.get('.playerIndividual').should('have.length', 3);
		cy.get('#playerList').should('contain', TEST_USERNAME);
		cy.get('#playerList').should('contain', 'CPU');

		// Remove the 2 CPUs
		cy.get('#manageCpus').click();
		cy.get('#cpuOptionsRemove').click();
		cy.get('#cpuOptionsRemove').click();
		cy.get('#cpuOptionsSubmit').click();

		// CPUs should be gone from player list
		cy.get('.playerIndividual').should('have.length', 1);
		cy.get('#playerList').should('contain', TEST_USERNAME);
		cy.get('#playerList').should('not.contain', 'CPU');
	});

	it('can start a CPU game', () => {
		cy.get('#manageCpus').click();
		cy.get('#cpuOptionsAdd').click();
		cy.get('#cpuOptionsSubmit').click();
		cy.get('#manageStartRoom').click();

		// Wait for game to start
		cy.get('#statusArea').should('not.be.visible');
		cy.get('#sidebar').should('not.be.visible');
		cy.get('body').find('canvas').should(elements => {
			expect(elements.length).to.equal(2);
		});

		// Hold down soft drop
		cy.get('body').trigger('keydown', { key: 'ArrowDown', code: 'ArrowDown', which: 40 });
		cy.wait(6500);
		cy.get('body').trigger('keyup', { key: 'ArrowDown', code: 'ArrowDown', which: 40 });

		// Returned to room after loss
		cy.get('#statusArea', {timeout: 60000}).should('be.visible');
		cy.get('#sidebar').should('be.visible');
	});

	it('can start a second CPU game', () => {
		cy.get('#manageStartRoom').click();

		// Wait for game to start
		cy.get('#statusArea').should('not.be.visible');
		cy.get('#sidebar').should('not.be.visible');
		cy.get('body').find('canvas').should(elements => {
			expect(elements.length).to.equal(2);
		});

		// Hold down soft drop
		cy.get('body').trigger('keydown', { key: 'ArrowDown', code: 'ArrowDown', which: 40 });
		cy.wait(6500);
		cy.get('body').trigger('keyup', { key: 'ArrowDown', code: 'ArrowDown', which: 40 });

		// Returned to room after loss
		cy.get('#statusArea', {timeout: 60000}).should('be.visible');
		cy.get('#sidebar').should('be.visible');
	});
});
