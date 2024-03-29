import * as Vue from 'vue';
import type { PropType } from 'vue';

import { AppearanceComponent } from './AppearanceComponent';
import { KeyBindings as KeyBindingsComponent } from './KeyBindingsComponent';

import { UserSettings } from '../../utils/Settings';
import { PlayerInfo } from '../firebase';
import { preloadSprites } from '../../draw/SpriteDrawer';

import store from '../store';

interface AnonymousFunctions {
	saveSettings: (newSettings: Partial<UserSettings>) => void
}

export const SettingsModal = Vue.defineComponent({
	emits: ['clearModal'],
	components: {
		'appearance-icons': AppearanceComponent,
		'key-bindings': KeyBindingsComponent
	},
	inject: ['audioPlayer', 'getCurrentUID'],
	props: {
		anonymous: {
			type: Boolean
		},
		anonymousFunctions: {
			type: Object as PropType<AnonymousFunctions>
		}
	},
	data() {
		const localizedSettings = Object.assign({}, store.userSettings);

		// Perform conversions
		localizedSettings.skipFrames = 50 - localizedSettings.skipFrames;
		localizedSettings.sfxVolume = 100 * Math.sqrt(localizedSettings.sfxVolume / 0.4);
		localizedSettings.musicVolume = 100 * Math.sqrt(localizedSettings.musicVolume / 0.4);

		return {
			settings: localizedSettings
		};
	},
	methods: {
		saveSettings() {
			// Perform conversions
			const newSettings = Object.assign({}, this.settings);
			newSettings.skipFrames = 50 - Math.floor(newSettings.skipFrames);
			newSettings.sfxVolume = (newSettings.sfxVolume / 100)**2 * 0.4;
			newSettings.musicVolume = (newSettings.musicVolume / 100)**2 * 0.4;

			// Configure audio player with new volume settings
			this.audioPlayer.configureVolume(newSettings);
			this.audioPlayer.playSfx('submit');

			if (this.anonymous) {
				this.anonymousFunctions.saveSettings(newSettings);
			}
			else {
				void PlayerInfo.getUserProperty(this.getCurrentUID(), 'userSettings').then((userSettings: UserSettings) => {
					userSettings = Object.assign(userSettings, newSettings);

					// Update values
					PlayerInfo.updateUser(this.getCurrentUID(), 'userSettings', userSettings);

					this.$emit('clearModal', false);
				});
			}

			preloadSprites(newSettings.appearance);
		},

		updateKeybind(operation: string, newKey: string) {
			this.settings.keyBindings[operation] = newKey;
		},

		selectAppearance(appearance: string) {
			this.settings.appearance = appearance;
		}
	},
	template:`
		<div class="modal-content" id="settingsModal">
			<div class="close" v-on:click="$emit('clearModal')">&times;</div>
			<div class="modal-title">User Settings</div>
			<div class="left-right-container" id="userSettingsOptions">
				<div>
					<div class="justify-flexbox">
						<form class="block-form" autocomplete="off">
							<label for="das">DAS</label>
							<input type="number" class="dasArrInput" id="das" v-model="settings.das" min="0" max="999"><br>
						</form>
						<form class="block-form" autocomplete="off">
							<label for="arr">ARR</label>
							<input type="number" class="dasArrInput" id="arr" v-model="settings.arr" min="0" max="99">
						</form>
					</div>
					<form class="block-form sliders" autocomplete="off">
						<label class="slider-label" for="sfxVolume">SFX Volume</label>
						<input class="slider-range" type="range" id="sfxVolume" v-model="settings.sfxVolume"  min="0" max="100">
						<label class="slider-label" for="musicVolume">Music Volume</label>
						<input class="slider-range" type="range" id="musicVolume" v-model="settings.musicVolume" min="0" max="100">
						<label class="slider-label" for="skipFrames">Intermediate Frames Shown</label>
						<input class="slider-range" type="range" id="skipFrames" v-model="settings.skipFrames" min="0" max="50">
					</form>
				</div>
				<div class="divider vertical" id="settingsDivider"></div>
				<div>
					<key-bindings v-bind:keybinds="settings.keyBindings" v-on:update-keybind="updateKeybind"></key-bindings>
					<div class="justify-flexbox ghostHighlightOptions">
						<form class="block-form" autocomplete="off">
							<label for="ghost">Ghost Drop</label>
							<input type="button" class="off" id="ghost" value="OFF" disabled><br>
						</form>
						<form class="block-form" autocomplete="off">
							<label for="highlightChains">Highlight Chains</label>
							<input type="button" class="off" id="highlightChains" value="OFF" disabled>
						</form>
					</div>
					<div class="option-title">Appearance</div>
					<appearance-icons v-bind:selected="settings.appearance" v-on:select-appearance="selectAppearance"></appearance-icons>
					<button id="settingsSubmit" v-on:click="saveSettings()">Save Settings</button>
				</div>
			</div>
		</div>`
});


