'use strict';

const { MOCK_UID } = require('../support/index.js');

const io_client = require('socket.io-client');
const socket = io_client.connect('http://localhost:3000');

const { shuffleArray } = require('../../src/utils/Utils.js');

describe('User Settings', () => {
	beforeEach(() => {
		// Close settings modal if it is open
		cy.get('#settingsModal').then((element) => {
			if(element.is(':visible')) {
				cy.get('#settingsModal').find('.close').click();
			}
		});
	});

	it('can set DAS and ARR', () => {
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		const das = Math.round(Math.random() * 200);
		const arr = Math.round(Math.random() * 50);

		cy.get('#das').clear();
		cy.get('#das').type(das);

		cy.get('#arr').clear();
		cy.get('#arr').type(arr);

		cy.contains('Save Settings').click();

		// Re-open settings panel
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		cy.get('#das').should((element) => {
			expect(Number(element.val())).to.equal(das);
		});

		cy.get('#arr').should((element) => {
			expect(Number(element.val())).to.equal(arr);
		});

		cy.get('#settingsModal').find('.close').click();
	});

	it('can set the sliders for volume and skipFrames', () => {
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		const sfxVolume = Math.round(Math.random() * 100);
		const musicVolume = Math.round(Math.random() * 100);
		const skipFrames = Math.round(Math.random() * 50);

		cy.get('#sfxVolume').invoke('val', sfxVolume).trigger('change');
		cy.get('#musicVolume').invoke('val', musicVolume).trigger('change');
		cy.get('#skipFrames').invoke('val', skipFrames).trigger('change');

		cy.contains('Save Settings').click();

		// Re-open settings panel
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		cy.get('#sfxVolume').should((element) => {
			expect(Number(element.val())).to.equal(sfxVolume);
		});

		cy.get('#musicVolume').should((element) => {
			expect(Number(element.val())).to.equal(musicVolume);
		});

		cy.get('#skipFrames').should((element) => {
			expect(Number(element.val())).to.equal(skipFrames);
		});

		cy.get('#settingsModal').find('.close').click();
	});

	it('can set keybinds', () => {
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		const keyBindings = ['moveLeft', 'moveRight', 'rotateCW', 'rotateCCW', 'softDrop', 'hardDrop'];
		const keyPairs = [
			{ keypress: '{uparrow}', text: '↑' },
			{ keypress: '{leftarrow}', text: '←' },
			{ keypress: '{downarrow}', text: '↓' },
			{ keypress: '{rightarrow}', text: '→' },
			{ keypress: '{shift}', text: 'LSH' }
		];

		let randomLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26));
		keyPairs.push({ keypress: randomLetter, text: randomLetter.toUpperCase() });

		shuffleArray(keyPairs);

		// Randomly assign key bindings
		keyBindings.forEach((keyBinding, index) => {
			cy.get(`#${keyBinding}Binding`).click();
			cy.focused().then((element) => {
				expect(element.val()).to.equal('...');
			});

			cy.focused().type(keyPairs[index].keypress);
			cy.get(`#${keyBinding}Binding`).then((element) => {
				expect(element.val()).to.equal(keyPairs[index].text);
			});
		});

		cy.contains('Save Settings').click();

		// Re-open settings panel
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		// Confirm that key bindings didn't change
		keyBindings.forEach((keyBinding, index) => {
			cy.get(`#${keyBinding}Binding`).then((element) => {
				expect(element.val()).to.equal(keyPairs[index].text);
			});
		});

		// Reset soft drop to down arrow
		cy.get(`#softDropBinding`).click();
		cy.focused().type('{downarrow}');

		cy.contains('Save Settings').click();
	});

	// TODO: Add test for Ghost drop and chain highlighting once they are implemented

	it('can change appearance', () => {
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		let selectedAppearance;

		cy.get('.appearanceIcon').then((elements) => {
			selectedAppearance = elements[Math.floor(Math.random() * elements.length)].id;

			cy.get(`#${selectedAppearance}`).click();
		});
		cy.contains('Save Settings').click();

		// Re-open settings panel
		cy.get('#profilePanel').click();
		cy.get('#settings').click();

		cy.get('.appearanceIcon.selected').then((elements) => {
			expect(elements.length).to.equal(1);
			expect(elements[0].id).to.equal(selectedAppearance);
		});

		cy.get('#settingsModal').find('.close').click();
	})
});
