'use strict';

class InputManager {
	constructor(das = 200, arr = 20) {
		this.events = [];
		this.keysPressed = {};
		this.dasTimer = {};
		this.arrTimer = {};
		this.das = das;
		this.arr = arr;

		document.addEventListener("keydown", event => {
			this.keysPressed[event.key] = true;
		});

		document.addEventListener("keyup", event => {
			this.keysPressed[event.key] = undefined;
			this.dasTimer[event.key] = undefined;
			if(this.arrTimer[event.key] !== undefined) {
				this.arrTimer[event.key] = undefined;
			}
		});
	}

	executeKeys() {
		// First, take all the keys currently pressed
		Object.keys(this.keysPressed).filter(key => this.keysPressed[key] !== undefined).forEach(key => {

			// If this key is newly pressed OR the DAS timer has completed
			if(this.dasTimer[key] === undefined || (Date.now() - this.dasTimer[key]) >= this.das || key === 'ArrowDown') {
				// If the puyo is undergoing ARR AND the ARR timer has not completed
				if(this.arrTimer[key] !== undefined && (Date.now() - this.arrTimer[key]) < this.arr && key !== 'ArrowDown') {
					return;
				}

				// Perform key action
				switch(key) {
					case 'ArrowLeft':
						this.emit('move', 'left');
						break;
					case 'ArrowRight':
						this.emit('move', 'right');
						break;
					case 'ArrowDown':
						this.emit('move', 'down');
						break;
					case 'z':
						this.emit('rotate', 'CCW');
						break;
					case 'x':
						this.emit('rotate', 'CW');
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

	on(event, callback) {
		this.events[event] = callback;
	}

	emit(event, data) {
		const callback = this.events[event];
		callback(data);
	}
}


