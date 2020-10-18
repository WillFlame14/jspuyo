'use strict';

import { UserSettings } from './Settings';

const audioFilenames = {
	move: { numClips: 1, defaultVolume: 1, extension: 'wav' },
	rotate: { numClips: 1, defaultVolume: 1, extension: 'wav' },
	win: { numClips: 1, defaultVolume: 0.8, extension: 'wav' },
	loss: { numClips: 1, defaultVolume: 0.8, extension: 'wav' },
	chain: { numClips: 7, defaultVolume: 1, start: 1, extension: 'wav' },
	nuisance_send: { numClips: 4, defaultVolume: 1, start: 2, extension: 'wav' },
	nuisance_fall: { numClips: 2, defaultVolume: 1, extension: 'wav' },
	all_clear: { numClips: 1, defaultVolume: 1, extension: 'wav' },
	open_panel: { numClips: 1, defaultVolume: 10, extension: 'ogg' },
	close_panel: { numClips: 1, defaultVolume: 10, extension: 'ogg' },
	hover_option: { numClips: 2, defaultVolume: 2, extension: 'ogg' },
	click_option: { numClips: 1, defaultVolume: 6, extension: 'ogg' },
	close_modal: { numClips: 1, defaultVolume: 6, extension: 'ogg' },
	submit: { numClips: 1, defaultVolume: 2, extension: 'ogg' }
};

export const VOICES = {
	'akari': { defaultVolume: 3, extension: 'ogg', colour: [130, 212, 187] },
	'maria': { defaultVolume: 6, extension: 'ogg', colour: [224, 175, 160] },
};

// Relative to root directory
const SOUNDS_DIRECTORY = './sounds';

export class AudioPlayer {
	socket: SocketIO.Socket;
	disabled: boolean;
	sfxVolume: number;
	musicVolume: number;

	sfx: any;
	voices: any;

	gameId: string;

	constructor(socket: SocketIO.Socket, disable: string = null) {
		this.socket = socket;
		this.disabled = disable === 'disable';

		const { sfxVolume, musicVolume } = new UserSettings();

		this.sfxVolume = sfxVolume;
		this.musicVolume = musicVolume;

		this.sfx = {};

		// Load sound clips
		if(!this.disabled) {
			Object.keys(audioFilenames).forEach(name => {
				const audioInfo = audioFilenames[name];

				if(audioInfo.numClips === 1) {
					const audio = new Audio(`${SOUNDS_DIRECTORY}/${name}.${audioInfo.extension}`);
					this.sfx[name] = [audio];
				}
				else {
					const start = audioInfo.start || 0;
					const audioFiles = Array(start).fill(null);		// Fill array with null until start

					for(let i = 0; i < audioInfo.numClips; i++) {
						const audio = new Audio(`${SOUNDS_DIRECTORY}/${name}_${i + 1}.${audioInfo.extension}`);
						audioFiles.push([audio]);
					}
					this.sfx[name] = audioFiles;
				}
			});

			this.voices = {};

			Object.keys(VOICES).forEach(name => {
				const { extension } = VOICES[name];
				const chainAudio = [null];

				for(let i = 0; i < 13; i++) {
					const audio = new Audio(`${SOUNDS_DIRECTORY}/voices/${name}/chain_${i + 1}.${extension}`);
					chainAudio.push([audio]);
				}

				const spellAudio = [null];
				for(let i = 0; i < 5; i++) {
					const audio = new Audio(`${SOUNDS_DIRECTORY}/voices/${name}/spell_${i + 1}.${extension}`);
					spellAudio.push([audio]);
				}

				const selectAudio = [new Audio(`${SOUNDS_DIRECTORY}/voices/${name}/select.${extension}`)];
				this.voices[name] = { chain: chainAudio, spell: spellAudio, select: selectAudio };
			});
		}
	}

	assignGameId(gameId) {
		this.gameId = gameId;
	}

	configureVolume(sfxVolume, musicVolume) {
		this.sfxVolume = sfxVolume;
		this.musicVolume = musicVolume;
	}

	/**
	 * Plays an audio clip. An 1-based index parameter is provided for more detailed selection.
	 */
	playAudio(audio, volume) {
		let channel = 0;
		while(channel < audio.length && !audio[channel].paused) {
			channel++;
		}

		// Generate a new audio object
		if(channel === audio.length) {
			const newsfx = audio[channel - 1].cloneNode();
			audio.push(newsfx);
		}
		audio[channel].volume = volume;
		audio[channel].play();
	}

	playSfx(sfx_name, index = null) {
		if(this.disabled) {
			return;
		}
		const audio = (index === null) ? this.sfx[sfx_name] : this.sfx[sfx_name][index];
		const volume = this.sfxVolume * audioFilenames[sfx_name].defaultVolume;
		this.playAudio(audio, volume);
	}

	playVoice(character, audio_name, index = null) {
		if(this.disabled) {
			return;
		}
		const audio = (index === null) ? this.voices[character][audio_name] : this.voices[character][audio_name][index];
		const volume = this.sfxVolume * VOICES[character].defaultVolume;
		this.playAudio(audio, volume);
	}

	/**
	 * Plays a sound effect, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitSfx(sfx_name, index = null) {
		this.playSfx(sfx_name, index);
		this.socket.emit('sendSound', this.gameId, sfx_name, index);
	}

	/**
	 * Plays a voiced audio clip, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitVoice(character, audio_name, index = null) {
		this.playVoice(character, audio_name, index);
		this.socket.emit('sendVoice', this.gameId, character, audio_name, index);
	}
}
