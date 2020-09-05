'use strict';

describe('mainpage', () => {
	before(() => {
		cy.visit('/').then(async () => {
			cy.wait(500);
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
		cy.get('#usernamePickerText').type('cypressTest');
		cy.contains('Confirm').click();

		cy.get('.playerList').should('contain', 'cypressTest');
	});

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
		cy.get('#profilePanel').should('not.have.class', 'expanded');
		cy.get('#queuePanel').should('not.have.class', 'expanded');
		cy.get('#customPanel').should('not.have.class', 'expanded');
		cy.get('#singleplayerPanel').should('not.have.class', 'expanded');
	});

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
		cy.get('#messageField').type('this is another');
		cy.get('#messageField').type('aaaaa');
		cy.get('#sendMessage').submit();

		// The chat messages should be combined into one
		cy.get('#chatMessages').find('li').then(elements => {
			expect(elements.length).to.equal(1);
		});
		cy.get('#chatMessages').contains('this is another');
		cy.get('#chatMessages').contains('aaaaa');
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
		cy.wait(5000);
		cy.get('body').trigger('keyup', { key: 'ArrowDown', code: 'ArrowDown', which: 40 });

		// Returned to room after loss
		cy.get('#statusArea', {timeout: 60000}).should('be.visible');
		cy.get('#sidebar').should('be.visible');
	});
});
