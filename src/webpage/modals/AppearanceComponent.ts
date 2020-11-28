import * as Vue from 'vue';

export const AppearanceComponent = Vue.defineComponent({
	data(): { appearances: string[], selected: string } {
		return {
			appearances: ['Aqua', 'Chalk', 'TsuClassic', 'Custom', 'FlatColour', 'Test'],
			selected: 'TsuClassic'
		};
	},
	methods: {
		selectAppearance(appearance: string) {
			this.selected = appearance;
		}
	},
	mounted() {
		this.emitter.on('setAppearance', (appearance: string) => {
			this.selected = appearance;
		});

		this.emitter.on('getAppearance', (callback: (appearance: string) => void) => {
			callback(this.selected);
		});
	},
	unmounted() {
		this.emitter.off('setAppearance', undefined);
		this.emitter.off('getAppearance', undefined);
	},
	template:
		`<div class="justify-flexbox">
			<img class="appearanceIcon"
				v-for="appearance in appearances"
				v-bind:class="{selected: selected === appearance}"
				v-bind:id="appearance"
				v-bind:src="'images/modal_boxes/puyo_' + appearance.toLowerCase() + '.png'"
				v-on:click="selectAppearance(appearance)">
		</div>`
});
