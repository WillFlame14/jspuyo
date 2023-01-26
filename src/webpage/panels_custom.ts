'use strict';

import mitt from 'mitt';
import { Socket } from 'socket.io-client';

export const puyoImgs: string[] = ['red', 'blue', 'green', 'yellow', 'purple', 'teal'];

export function initCustomPanels(
	emitter: ReturnType<typeof mitt>,
	clearModal: () => void,
	stopCurrentSession: () => Promise<void>,
	socket: Socket
): void {
	// Receiving the id of the newly created room
	socket.on('giveRoomId', (roomId: string) => {
		emitter.emit('setActiveModal', { name: 'JoinIdModal', props: { roomId } });
	});

	// Received when room cannot be joined
	socket.on('joinFailure', (errorMsg: string) => {
		// Display modal elements if they are not already being displayed (e.g. arrived from direct join link)
		emitter.emit('setActiveModal', { name:'JoinRoomModal', props: { errorMsg } });
	});

	// Event received when attempting to join a password-protected room
	socket.on('requireRoomPassword', (roomId: string) => {
		emitter.emit('setActiveModal', { name:'JoinRoomPasswordModal', props: { roomId } });
	});

	// Event received when entering the wrong password to a password-protected room
	socket.on('joinRoomPasswordFailure', (errorMsg: string) => {
		emitter.emit('setActiveModal', { name: 'JoinRoomPasswordModal', props: { errorMsg } });
	});

	// Received when attempting to spectate an invalid room
	socket.on('spectateFailure', (errorMsg: string) => {
		emitter.emit('setActiveModal', { name:'SpectateRoomModal', props: { errorMsg } });
	});
}
