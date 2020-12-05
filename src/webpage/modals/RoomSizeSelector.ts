import * as Vue from 'vue';

export const RoomSizeSelector = Vue.defineComponent({
	props: ['selectedNum', 'wildNumSelected', 'disabled'],
	data(): { wildNum: number } {
		return {
			wildNum: 5
		};
	},
	template: `
		<div id="roomSizeSelector">
			<div class="option-title">Players</div>
			<form id="playerButtons" autocomplete="off">
				<span class="numPlayerButton" v-for="index in 3"
					v-bind:class="{ selected: selectedNum === (index + 1) && !wildNumSelected, disabled }"
					v-on:click="$emit('selectNumPlayers', { num: index + 1, wildNum: false })">
					{{index + 1}}
				</span>
				<input class="numPlayerButton" type="number" min="5" max="16"
					v-model.number="wildNum"
					v-bind:class="{ selected: wildNumSelected, disabled }"
					v-on:click="$emit('selectNumPlayers', { num: wildNum, wildNum: true })"
					v-on:input="$emit('selectNumPlayers', { num: wildNum, wildNum: true } )"
					v-bind:disabled="disabled">
			</form>
		</div>`
});
