import * as Vue from 'vue';

import { UserSettings } from '../utils/Settings';
import { AudioInfo, VOICES } from '../utils/AudioPlayer';
import { PlayerInfo } from './firebase';

const ranks: Record<string, string> = {
	'0': 'Blob',
	'1000': 'Forest Learner',
	'1250': 'Ocean Diver',
	'1500': 'Waterfall Fighter',
	'1750': 'Lightning Ranger'
};

interface VoiceInfo extends AudioInfo {
	colourStr: string;
}

export const StatusComponent = Vue.defineComponent({
	inject: ['audioPlayer', 'getCurrentUID'],
	data(): { name: string, rating: number, voice: string, title: string, statusBarOpen: boolean, voiceSets: VoiceInfo[][] } {
		return {
			name: 'Test',
			rating: 1000,
			voice: 'akari',
			title: ranks['0'],
			statusBarOpen: false,
			voiceSets: []
		};
	},
	methods: {
		toggleStatusBar() {
			this.statusBarOpen = !this.statusBarOpen;
		},
		selectVoice(name: string) {
			this.audioPlayer.playVoice(name, 'select');
			PlayerInfo.getUserProperty(this.getCurrentUID(), 'userSettings').then((userSettings: UserSettings) => {
				// Select new voice
				this.voice = name;

				// Update user settings
				userSettings.voice = name;
				PlayerInfo.updateUser(this.getCurrentUID(), 'userSettings', userSettings);
			}).catch((err) => {
				console.log(err);
			});
		}
	},
	mounted() {
		this.emitter.on('updateStatus', ({ name, rating, voice }: { name: string, rating: number, voice: string }) => {
			this.name = name;
			this.rating = rating;
			this.voice = voice;

			const rankBoundaries = Object.keys(ranks);
			this.title = ranks[rankBoundaries[rankBoundaries.findIndex(minimumRating => Number(minimumRating) > rating) - 1]];
		});

		let set = [];

		// Split the VOICES object into groups of 4
		for(const [index, name] of Object.keys(VOICES).entries()) {
			if(index % 4 === 0 && index !== 0) {
				this.voiceSets.push(set);
				set = [];
			}
			// Add the 'name' property
			set.push(Object.assign(VOICES[name], { name, colourStr: rgbaString(...VOICES[name].colour, 0.8) }));
		}
		if(set.length !== 0) {
			this.voiceSets.push(set);
		}
	},
	unmounted() {
		this.emitter.off('updateStatus', undefined);
	},
	template:
		`<div id="statusHover" v-bind:class="{ open: statusBarOpen }">
			<div id="statusName">{{name}}</div>
			<div id="statusRating">Rating: {{rating}}</div>
			<div id="statusTitle">{{title}}</div>
			<div id="voiceSelectTitle">Voice Selector</div>
			<table id="voiceSelect">
				<tr v-for="voiceSet in voiceSets">
					<th v-for="voiceOpt in voiceSet">
						<div
							class="voiceOption"
							v-bind:class="{ selected: voice === voiceOpt.name }"
							v-bind:style="{ background: voiceOpt.colourStr }"
							v-on:click="selectVoice(voiceOpt.name)"
						></div>
					</th>
				</tr>
			</table>
		</div>
		<div
			id="statusClick"
			v-on:click="toggleStatusBar()"
			v-bind:class="{ open: statusBarOpen }"
		>☰</div>`
});

/**
 * Returns an rgba CSS string, given the RGB + opacity values.
 */
function rgbaString(red?: number, green?: number, blue?: number, opacity = 1) {
	return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
