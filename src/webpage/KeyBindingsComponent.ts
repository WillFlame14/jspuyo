import * as Vue from 'vue';

interface Binding {
	name: string,
	boundKey: string,
	displayKey: string
}

const KeyBindingComponent = Vue.defineComponent({
	props: ['keybind', 'operation'],
	data() {
		return {
			awaitingBinding: false
		};
	},
	methods: {
		releaseBind(operation: string) {
			this.awaitingBinding = true;
			this.$emit('releaseBind', operation);
		},
		restoreBind(operation: string) {
			if(!this.awaitingBinding) {
				return;
			}

			this.awaitingBinding = false;
			this.$emit('restoreBind', operation);
		},
		/**
		 * Binds a new key to the currently waiting operation.
		 * @param {string} key The key to be bound.
		 */
		bindNewKey(event: KeyboardEvent, operation: string) {
			// No key waiting to be bound
			if(!this.awaitingBinding) {
				return;
			}

			this.$emit('updateBind', operation, event.code);
			this.awaitingBinding = false;
		}
	},
	template:
		`<form autocomplete="off">
			<label v-bind:for="operation + 'Binding'">{{keybind.name}}</label>
			<input type="button" class="keyBinding"
				ref="bindInput"
				v-bind:id="operation + 'Binding'"
				v-bind:value="keybind.displayKey"
				v-on:click="releaseBind(operation)"
				v-on:keydown="bindNewKey($event, operation)"
				v-on:blur="restoreBind(operation)">
		</form>`
});

export const KeyBindings = Vue.defineComponent({
	components: {
		'key-binding': KeyBindingComponent
	},
	data(): { bindings: Record<string, Binding>, keyAwaitingBind: string } {
		return {
			bindings: {
				moveLeft: { name: 'Move Left', boundKey: 'ArrowLeft', displayKey: '\u2190' },
				moveRight: { name: 'Move Right', boundKey: 'ArrowRight', displayKey: '\u2192' },
				rotateCCW: { name: 'Rotate CCW', boundKey: 'KeyZ', displayKey: 'Z' },
				rotateCW: { name: 'Rotate CW', boundKey: 'KeyX', displayKey: 'X' },
				softDrop: { name: 'Soft Drop', boundKey: 'ArrowDown', displayKey: '\u2193' },
				hardDrop: { name: 'Hard Drop', boundKey: 'ArrowUp', displayKey: '\u2191' }
			},
			keyAwaitingBind: '',
		};
	},
	methods: {
		updateBind(operation: string, newKey: string) {
			this.bindings[operation].boundKey = newKey;
			this.bindings[operation].displayKey = this.codeToDisplay(newKey);
		},
		/**
		 * Releases a keybind, to allow binding a new one.
		 * @param {string} operation The operation to be unbound
		 */
		releaseBind(operation: string) {
			this.bindings[operation].displayKey = '...';
		},
		/**
		 * Restores a keybind after the user does not select a new one.
		 * @param {string} operation The operation to be rebound
		 */
		restoreBind(operation: string) {
			this.bindings[operation].displayKey = this.codeToDisplay(this.bindings[operation].boundKey);
		},
		/**
		 * Converts a KeyCode to a readable string/symbol.
		 * @param  {string} code The KeyCode
		 * @return {string}      The readable string
		 */
		codeToDisplay(code: string): string {
			// Cut off prefixes
			if(code.includes('Key')) {
				code = code.substring(3);
			}
			else if(code.includes('Digit')) {
				code = code.substring(5);
			}

			switch(code) {
				case 'ArrowLeft':
					return '\u2190';
				case 'ArrowRight':
					return '\u2192';
				case 'ArrowDown':
					return '\u2193';
				case 'ArrowUp':
					return '\u2191';
				case 'ShiftLeft':
					return 'LSH';
				case 'ShiftRight':
					return 'RSH';
				default:
					return code.toUpperCase();
			}
		}
	},
	mounted() {
		this.emitter.on('bindKeys', (keybinds: Record<string, string>) => {
			Object.keys(keybinds).forEach((operation: string) => {
				this.bindings[operation].boundKey = keybinds[operation];
				this.bindings[operation].displayKey = this.codeToDisplay(keybinds[operation]);
			});
		});

		this.emitter.on('reqKeys', (callback: (bindings: Record<string, Binding>) => void) => {
			callback(this.bindings);
		});
	},
	unmounted() {
		this.emitter.off('bindKeys', undefined);
		this.emitter.off('reqKeys', undefined);
	},
	template:
		`<div class="keyBindings" id="keyBindings">
			<key-binding
				ref="bindings"
				v-for="(keybind, operation) in bindings"
				v-bind:keybind="keybind"
				v-bind:operation="operation"
				v-on:releaseBind="releaseBind"
				v-on:restoreBind="restoreBind"
				v-on:updateBind="updateBind">
			</key-binding>
		</div>`
});
