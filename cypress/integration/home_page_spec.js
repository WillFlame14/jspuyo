'use strict';

const TEST_USERNAME = 'cypressTest';

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

	it('can rejoin the FFA queue', () => {
		cy.get('#queuePanel').click();
		cy.contains('Free for all').click();

		cy.get('#statusGamemode').should('contain', 'Free For All');
		cy.get('#playerList').should('contain', TEST_USERNAME);
	});
});

describe('Custom rooms', () => {
	it('can create a room', () => {
		cy.get('#customPanel').click();
		cy.get('#createRoom').click();
		cy.get('#createRoomSubmit').click();
		cy.get('#giveJoinId').find('.close').click();
		cy.get('#statusArea').contains('Manage CPUs');
	});

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
		cy.get('body').find('.centralArea').then(elements => {
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
		cy.get('body').find('.centralArea').then(elements => {
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
