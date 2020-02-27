'use strict';

class InputManager {
	constructor() {
		this.events = [];
		document.addEventListener("keydown", event => {
			switch(event.key) {
				case 'ArrowLeft':
					this.emit('move', 'left')
					break;
				case 'ArrowRight':
					this.emit('move', 'right');
					break;
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


