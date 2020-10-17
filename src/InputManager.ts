'use strict';

class InputManager{
	constructor(userSettings) {
		this.events = [];				// Array of callback functions, indexed at their triggering event
		this.keysPressed = {};			// Object containing keys with whether they are pressed or not
		this.lastPressed = undefined;	// Last pressed Left/Right key. Becomes undefined if the key is released.
		this.dasTimer = {};				// Object containing DAS timers for each key
		this.arrTimer = {};				// Object containing ARR timers for each key
		this.userSettings = userSettings;
		this.keyBindings = userSettings.keyBindings;

		document.addEventListener("keydown", event => {
			this.keysPressed[event.code] = true;
			if(event.code === this.keyBindings.moveLeft || event.code === this.keyBindings.moveRight) {
				this.lastPressed = event.code;
			}
		});

		document.addEventListener("keyup", event => {
			this.keysPressed[event.code] = undefined;
			this.dasTimer[event.code] = undefined;
			if(this.arrTimer[event.code] !== undefined) {
				this.arrTimer[event.code] = undefined;
			}
			if(event.code === this.keyBindings.moveLeft || event.code === this.keyBindings.moveRight) {
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
			if(this.dasTimer[key] === undefined || (Date.now() - this.dasTimer[key]) >= this.userSettings.das || key === this.keyBindings.softDrop) {
				// If the puyo is undergoing ARR AND the ARR timer has not completed
				if(this.arrTimer[key] !== undefined && (Date.now() - this.arrTimer[key]) < this.userSettings.arr && key !== this.keyBindings.softDrop) {
					return;
				}

				// If the puyo is rotating and the rotate button is still held
				if(this.dasTimer[key] !== undefined && (key === this.keyBindings.rotateCCW || key === this.keyBindings.rotateCW)) {
					return;
				}

				let das = false;

				// If took an action and DAS timer exists, that must mean entering ARR
				if(this.dasTimer[key] !== undefined) {
					this.arrTimer[key] = Date.now();
					das = true;
				}
				// Otherwise, this is a new press and must undergo DAS
				else {
					this.dasTimer[key] = Date.now();
				}

				// Perform key action
				switch(key) {
					case this.keyBindings.moveLeft:
						// Special case for holding both directions down
						if(this.lastPressed !== this.keyBindings.moveRight) {
							this.emit('Move', 'Left', das);
						}
						break;
					case this.keyBindings.moveRight:
						// Special case for holding both directions down
						if(this.lastPressed !== this.keyBindings.moveLeft) {
							this.emit('Move', 'Right', das);
						}
						break;
					case this.keyBindings.softDrop:
						this.emit('Move', 'Down');
						break;
					case this.keyBindings.rotateCCW:
						this.emit('Rotate', 'CCW');
						break;
					case this.keyBindings.rotateCW:
						this.emit('Rotate', 'CW');
						break;
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
	emit(event, data, das) {
		const callback = this.events[event];
		callback(data, das);
	}
}

module.exports = { InputManager };
