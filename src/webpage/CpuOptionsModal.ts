import * as Vue from 'vue';

import { CPU_NAMES } from '../cpu/CpuVariants';
import { puyoImgs } from './panels_custom';

interface BasicCpuInfo {
	ai: string,
	speed: number
}

const CpuSettingsComponent = Vue.defineComponent({
	props: ['id', 'name', 'speed'],
	data(): { cpuNames: string[], puyoImgs: string[] } {
		return {
			cpuNames: CPU_NAMES,
			puyoImgs
		};
	},
	template: `
		<div class="cpuOption" v-bind:id="'cpu' + (id + 1)">
			<img v-bind:src="'images/modal_boxes/puyo_' + puyoImgs[id] + '.png'">
			<span class='option-title aiLabel'>AI</span>
			<span class='option-title speedLabel'>Speed</span>
			<select class="aiOption" v-bind:value="name" v-on:change="$emit('setAI', { id, ai: $event.target.value })">
				<option v-for="cpuName in cpuNames" v-bind:value="cpuName" v-bind:selected="name === cpuName">{{cpuName}}</option>
			</select>
			<span class="option-title speedDisplay">{{speed}}</span>
			<input type="range" class="cpuSpeedSlider" v-bind:value="speed" min="0" max="10"
				v-on:input="$emit('setSpeed', { id, speed: $event.target.value })">
		</div>
		`
});

export const CpuOptionsModal = Vue.defineComponent({
	components: {
		'cpu-settings-component': CpuSettingsComponent
	},
	inject: ['audioPlayer', 'socket'],
	data(): { uid: string, cpus: BasicCpuInfo[], errorMsg: string } {
		return {
			uid: '',
			cpus: [],
			errorMsg: ''
		};
	},
	methods: {
		addCpu() {
			this.audioPlayer.playSfx('submit');

			if(this.uid.length === 0) {
				this.retrieveUID();
			}

			// Send request to server to add CPU (can only add only up to roomsize)
			this.socket.emit('addCpu', this.uid, (index: number) => {
				if(index === -1) {
					this.errorMsg = 'There is no more space in the room.';
					return;
				}
				else {
					this.cpus.push({ ai: 'Random', speed: 8 });
					this.errorMsg = '';
				}
			});
		},

		removeCpu() {
			this.audioPlayer.playSfx('submit');

			if(this.uid.length === 0) {
				this.retrieveUID();
			}

			// Send request to server to remove CPU (can only remove if there are any CPUs)
			this.socket.emit('removeCpu', this.uid, (index: number) => {
				if(index === -1) {
					// No CPUs in room
					this.errorMsg = 'There no CPUs currently in the room.';
					return;
				}
				else {
					this.cpus.pop();
					this.errorMsg = '';
				}
			});
		},

		submitCpus() {
			this.emitter.emit('setCpus', this.cpus);
		},

		setAI({ id, ai }: { id: number, ai: string }) {
			console.log('setting ai ' + ai);
			this.cpus[id].ai = ai;
		},

		setSpeed({ id, speed }: { id: number, speed: number }) {
			this.cpus[id].speed = speed;
		},

		retrieveUID() {
			this.emitter.emit('getCurrentUID', (currentUID: string) => {
				this.uid = currentUID;
			});
		}
	},
	mounted() {
		this.emitter.on('presetCpus', (cpus: BasicCpuInfo[]) => {
			this.cpus = cpus;
		});
	},
	unmounted() {
		this.emitter.off('presetCpus', undefined);
	},
	template: `
		<div class="close">&times;</div>
		<div class="modal-title">CPU Options</div>
		<div class="errorMsg" id="cpuOptionsError" v-show="errorMsg.length !== 0">{{errorMsg}}</div>
		<div id="cpuOptionsEmpty" v-show="cpus.length === 0">No CPUs in room</div>
		<div class="cpu-container" id="cpuOptions">
			<cpu-settings-component v-for="(cpu, index) in cpus"
				v-bind:name="cpu.ai"
				v-bind:speed="cpu.speed"
				v-bind:id="index"
				v-on:setSpeed="setSpeed"
				v-on:setAI="setAI">
			</cpu-settings-component>
		</div>
		<div id="cpuOptionsButtons">
			<button id="cpuOptionsAdd" v-on:click="addCpu()">Add CPU</button>
			<button id="cpuOptionsSubmit" v-on:click="submitCpus()">Save CPU Selections</button>
			<button id="cpuOptionsRemove" v-on:click="removeCpu()">Remove CPU</button>
		</div>`
});
