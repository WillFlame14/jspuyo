import * as Vue from 'vue';
import type { PropType } from 'vue';

const KeyBindingComponent = Vue.defineComponent({
	props: ['keybind', 'operation'],
	data() {
		return {
			awaitingBinding: false
		};
	},
	methods: {
		/** Releases a keybind, to allow binding a new one. */
		releaseBind() {
			this.awaitingBinding = true;
		},
		/** Restores a keybind after the user does not select a new one. */
		restoreBind() {
			if(!this.awaitingBinding) {
				return;
			}

			this.awaitingBinding = false;
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
		},
		getName(operation: string) {
			const opToName: Record<string, string> = {
				moveLeft: 'Move Left',
				moveRight: 'Move Right',
				rotateCCW: 'Rotate CCW',
				rotateCW: 'Rotate CW',
				softDrop: 'Soft Drop',
				hardDrop: 'Hard Drop'
			};
			return opToName[operation];
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
	template:
		`<form autocomplete="off">
			<label v-bind:for="operation + 'Binding'">{{getName(operation)}}</label>
			<input type="button" class="keyBinding"
				v-bind:id="operation + 'Binding'"
				v-bind:value="awaitingBinding ? '...' : codeToDisplay(keybind)"
				v-on:click="releaseBind()"
				v-on:keydown="bindNewKey($event, operation)"
				v-on:blur="restoreBind()">
		</form>`
});

export const KeyBindings = Vue.defineComponent({
	components: {
		'key-binding': KeyBindingComponent
	},
	props: {
		keybinds: {
			type: Object as PropType<Record<string, string>>
		}
	},
	methods: {
		updateBind(operation: string, newKey: string) {
			this.$emit('updateKeybind', operation, newKey);
		}
	},
	template:
		`<div class="keyBindings" id="keyBindings">
			<key-binding
				v-for="(keybind, operation) in keybinds"
				v-bind:keybind="keybind"
				v-bind:operation="operation"
				v-on:updateBind="updateBind">
			</key-binding>
		</div>`
});
