import { Socket } from 'socket.io';
import { Socket as ClientSocket } from 'socket.io-client';

interface CpuInfo {
	client_socket: ClientSocket,
	socket: Socket,
	speed: number,
	ai: string
}

export interface ClientToServerEvents {
	getOnlineUsers: (callback: (numUsers: number) => void) => void,
	register: (gameId: string) => void,
	createRoom: (gameInfo: { gameId: string, settingsString: string, roomSize: number, roomType: string}, callback: (roomId: string) => void) => void,
	joinRoom: (gameInfo: { gameId: string, joinId?: string, roomPassword?: string }) => void,
	spectateRoom: (gameId, roomId?: string) => void,
	requestJoinLink: (gameId: string, callback: (roomId: string) => void) => void,
	freeForAll: (gameInfo: { gameId: string }) => void,
	ranked: (gameInfo: { gameId: string }) => void,
	requestCpus: (gameId: string, callback: (cpus: { speed: number, ai: string }[]) => void) => void,
	addCpu: (gameId: string, callback: (index: number) => void) => void,
	removeCpu: (gameId: string, callback: (index: number) => void) => void,
	setCpus: (gameInfo: {gameId: string, cpus: CpuInfo[]}) => void,
	cpuAssign: (gameId: string, cpuId: string, callback: () => void) => void,
	setRoomPassword: (gameId: string, password: string) => void,
	startRoom: (gameId: string) => void,
	changeSettings: (gameId: string, settingsString: string, roomSize: number) => void,
	getAllRooms: (gameId, callback: (allRoomIds: string[]) => void) => void,
	getPlayers: (roomId: string, callback: (players: string[]) => void) => void,

	// Broadcasted events
	sendState: (gameId: string, boardHash: string, currentScore: number, totalNuisance: number) => void,
	sendMessage: (gameId: string, message: string) => void,
	sendSound: (gameId: string, sfx_name: string, index?: number) => void,
	sendVoice: (gameId: string, character: string, audio_name: string, index?: number) => void,
	sendNuisance: (gameId: string, nuisance: number) => void,
	activateNuisance: (gameId: string) => void,
	gameOver: (gameId: string) => void,
	forceDisconnect: (gameId: string, roomId?: string) => void,
	focus: (gameId: string, focused: boolean) => void,
	unlinkUser: () => void
}

export interface ServerToClientEvents {
	registered: () => void,
	roomUpdate: (
		roomId: string,
		playerScores: Record<string, number>,
		roomSize: number,
		settingsString: string,
		roomType: string,
		host: boolean,
		spectating: boolean,
		quickPlayStartTime?: number
	) => void,
	start: (roomId: string, playerScores: Record<string, number>, opponentIds: string[], settingsString: string) => Promise<void>,
	spectate: (roomId: string, playerScores: Record<string, number>, allIds: string[], settingsString: string) => Promise<void>,
	joinFailure: (errorMsg: string) => void,
	requireRoomPassword: (roomId: string) => void,
	joinRoomPasswordFailure: (errorMsg: string) => void,
	spectateFailure: (errorMsg: string) => void,
	showDialog: (message: string) => void,

	// Broadcasted events
	sendState: (oppId: string, boardHash: string, score: number, nuisance: number) => void,
	sendMessage: (sender: string, message: string) => void,
	sendSound: (oppId: string, sfx_name: string, index?: number) => void,
	sendVoice: (oppId: string, character: string, audio_name: string, index?: number) => void,
	sendNuisance: (oppId: string, nuisance: number) => void,
	activateNuisance: (oppId: string) => void,
	gameOver: (oppId: string, disconnect: boolean) => void,
	winnerResult: (winnerId: string) => void,
	pause: () => void,
	play: () => void,
	timeout: () => void
}
