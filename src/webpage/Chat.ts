import * as Vue from 'vue';

import { PlayerInfo } from './firebase';

interface ChatMessage {
	sender: string,
	message: string
}

export const Chat = Vue.defineComponent({
	data(): { chatMessages: ChatMessage[], messageText: string } {
		return {
			chatMessages: [],
			messageText: ''
		};
	},
	inject: ['socket', 'getCurrentUID'],
	methods: {
		sendMessage() {
			event.preventDefault();		// Do not refresh the page

			// Send message and clear the input field
			this.socket.emit('sendMessage', this.getCurrentUID(), this.messageText);
			this.messageText = '';
		}
	},
	mounted() {
		this.socket.on('sendMessage', (sender: string, message: string) => {
			void PlayerInfo.getUserProperty(sender, 'username').then((newSender: string) => {
				const lastMessage = this.chatMessages[this.chatMessages.length - 1];

				if(this.chatMessages.length !== 0 && lastMessage.sender === newSender) {
					// Same sender, so attach to previous message
					lastMessage.message += `\n${message}`;
				}
				else {
					// New sender, so create a new message
					this.chatMessages.push({ sender: newSender, message });
				}
			});

			// Automatically scroll to latest message
			const messageList = (this.$refs.messageList as HTMLUListElement);
			messageList.scrollTop = messageList.scrollHeight;
		});

		this.emitter.on('clearMessages', () => {
			this.chatMessages = [];
		});
	},
	unmounted() {
		this.socket.off('sendMessage', undefined);
		this.emitter.off('clearMessages', undefined);
	},
	template: `
		<ul class="chatMessages" ref="messageList" id="chatMessages">
			<li class="chatMsg" v-for="msg in chatMessages">
				<span class="senderName">{{msg.sender}}</span>
				<span class="message">{{msg.message}}</span>
			</li>
		</ul>
		<form autocomplete="off" id="sendMessage" v-on:submit="sendMessage()">
			<input type="text" id="messageField" v-model="messageText">
		</form>`
});
