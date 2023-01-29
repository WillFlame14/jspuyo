import * as Vue from 'vue';

export const AppearanceComponent = Vue.defineComponent({
	emits: ['selectAppearance'],
	data(): { appearances: string[] } {
		return {
			appearances: ['Aqua', 'Chalk', 'TsuClassic', 'Custom', 'FlatColour', 'Test']
		};
	},
	props: {
		selected: {
			type: String,
			defaultValue: 'TsuClassic'
		}
	},
	template:
		`<div class="justify-flexbox">
			<img class="appearanceIcon"
				v-for="appearance in appearances"
				v-bind:class="{selected: selected === appearance}"
				v-bind:id="appearance"
				v-bind:src="'images/modal_boxes/puyo_' + appearance.toLowerCase() + '.png'"
				v-on:click="$emit('selectAppearance', appearance)">
		</div>`
});
