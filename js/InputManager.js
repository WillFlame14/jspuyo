'use strict';

window.InputManager = class InputManager{
	constructor(settings) {
		this.events = [];				// Array of callback functions, indexed at their triggering event
		this.keysPressed = {};			// Object containing keys with whether they are pressed or not
		this.lastPressed = undefined;	// Last pressed Left/Right key. Becomes undefined if the key is released.
		this.dasTimer = {};				// Object containing DAS timers for each key
		this.arrTimer = {};				// Object containing ARR timers for each key
		this.settings = settings;

		document.addEventListener("keydown", event => {
			this.keysPressed[event.key] = true;
			if(event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				this.lastPressed = event.key;
			}
		});

		document.addEventListener("keyup", event => {
			this.keysPressed[event.key] = undefined;
			this.dasTimer[event.key] = undefined;
			if(this.arrTimer[event.key] !== undefined) {
				this.arrTimer[event.key] = undefined;
			}
			if(event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				this.lastPressed = undefined;
			}
		});
	}

	/**
	 * The 'update' method for InputManager; called once every frame.
	 * Determines whether conditions such as DAS and ARR should be applied.
	 * All 'successful' events will be emitted and caught by the game's validation functions before being executed.
	 * Soft dropping will always be executed.
	 */
	executeKeys() {
		// First, take all the keys currently pressed
		Object.keys(this.keysPressed).filter(key => this.keysPressed[key] !== undefined).forEach(key => {

			// If this key is newly pressed OR the DAS timer has completed
			if(this.dasTimer[key] === undefined || (Date.now() - this.dasTimer[key]) >= this.settings.das || key === 'ArrowDown') {
				// If the puyo is undergoing ARR AND the ARR timer has not completed
				if(this.arrTimer[key] !== undefined && (Date.now() - this.arrTimer[key]) < this.settings.arr && key !== 'ArrowDown') {
					return;
				}

				// If the puyo is rotating and the rotate button is still held
				if(this.dasTimer[key] !== undefined && (key === 'z' || key === 'x')) {
					return;
				}

				// Perform key action
				switch(key) {
					case 'ArrowLeft':
						// Special case for holding both directions down
						if(this.lastPressed !== 'ArrowRight') {
							this.emit('Move', 'Left', true);
						}
						break;
					case 'ArrowRight':
						// Special case for holding both directions down
						if(this.lastPressed !== 'ArrowLeft') {
							this.emit('Move', 'Right', true);
						}
						break;
					case 'ArrowDown':
						this.emit('Move', 'Down', true);
						break;
					case 'z':
						this.emit('Rotate', 'CCW', true);
						break;
					case 'x':
						this.emit('Rotate', 'CW', true);
						break;
				}

				// If took an action and DAS timer exists, that must mean entering ARR
				if(this.dasTimer[key] !== undefined) {
					this.arrTimer[key] = Date.now();
				}
				// Otherwise, this is a new press and must undergo DAS
				else {
					this.dasTimer[key] = Date.now();
				}
			}
		});
	}

	/**
	 * Sets up a function to be called when a particular event fires.
	 *
	 * @param  {string}   event    The name of the event that will be fired
	 * @param  {Function} callback The function that will be executed when the event fires
	 */
	on(event, callback) {
		this.events[event] = callback;
	}

	/**
	 * Executes the appropriate callback function when an event fires.
	 *
	 * @param  {string} event  The name of the event that was fired
	 * @param  {[type]} data   Any parameters that need to be passed to the callback
	 */
	emit(event, data, player) {
		const callback = this.events[event];
		callback(data, player);
	}
}
