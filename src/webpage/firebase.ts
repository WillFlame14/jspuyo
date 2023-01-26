'use strict';

import { FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { child, get, getDatabase, ref, remove, set, update } from 'firebase/database';
import firebase from 'firebase/compat/app';
import * as firebaseui from 'firebaseui';
import { firebaseConfig } from '../../config';

import { ServerToClientEvents, ClientToServerEvents } from '../@types/events';
import { UserSettings } from '../utils/Settings';

import { Socket } from 'socket.io-client';

type CSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let newUser = false;
let currentUser: User = null;
let fallbackName = '';		// Display name that is used if empty string is provided (aka the original name)

let firebaseApp: FirebaseApp;
let ui: firebaseui.auth.AuthUI;				// Firebaseui object
let socket: CSocket;	// Socket associated with the browser tab

const uiConfig = {
	callbacks: {
		signInSuccessWithAuthResult: function(authResult) {
			// Update global boolean with whether user is new or not
			// eslint-disable-next-line
			newUser = authResult.additionalUserInfo.isNewUser;

			// Do not redirect page
			return false;
		},
		uiShown: function() {
			document.getElementById('loader').style.display = 'none';
		}
	},
	credentialHelper: firebaseui.auth.CredentialHelper.NONE,
	// Will use popup for IDP Providers sign-in flow instead of the default, redirect.
	signInFlow: 'popup',
	signInOptions: [
		firebase.auth.EmailAuthProvider.PROVIDER_ID,
		firebase.auth.GoogleAuthProvider.PROVIDER_ID,
		firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
	],
	tosUrl: '/terms',
	privacyPolicyUrl: '/privacy'
};

export function basicInit() {
	firebase.initializeApp(firebaseConfig);
}

/**
 * Initialize the firebase login screen and associated UI changes,
 * as well as methods that handle game start on successful login.
 * @param {CSocket}         globalSocket    The socket used for the player
 * @param {User) => void}   loginSuccess    Callback when login succeeds
 */
export function initApp(globalSocket: CSocket, loginSuccess: (user: User) => void): void {
	// Initialize Firebase
	firebaseApp = firebase.initializeApp(firebaseConfig);
	const auth = getAuth(firebaseApp);
	ui = new firebaseui.auth.AuthUI(firebase.auth());
	ui.start('#firebaseui-auth-container', uiConfig);

	socket = globalSocket;
	initializeUI(loginSuccess);

	onAuthStateChanged(auth, user => {
		// Just logged in
		if (user) {
			document.getElementById('firebaseui-auth-container').style.display = 'none';
			document.getElementById('guestMessage').style.display = user.isAnonymous ? 'block' : 'none';

			// Open username change screen if new user
			if(newUser) {
				// Set their current name as default
				(document.getElementById('usernamePickerText') as HTMLInputElement).value = user.displayName;
				(document.getElementById('usernamePickerText') as HTMLInputElement).placeholder = user.displayName || '';
				fallbackName = user.displayName;

				document.getElementById('usernamePicker').style.display = 'block';
				currentUser = user;

				// Login will occur on username submission
			}
			else {
				document.getElementById('modal-login').style.display = 'none';
				document.getElementById('main-content').style.display = 'grid';

				// Start the actual game logic
				loginSuccess(user);
			}
		}
		// Just logged out
		else {
			document.getElementById('main-content').style.display = 'none';
			document.getElementById('modal-background').style.display = 'none';
			document.getElementById('modal-background-disable').style.display = 'none';

			document.getElementById('modal-login').style.display = 'block';
			document.getElementById('firebaseui-auth-container').style.display = 'block';
		}
	}, function(error) {
		console.log(error);
	});
}

function updateOnlineUsers() {
	socket.emit('getOnlineUsers', (numUsers: number) => {
		document.getElementById('onlineUsers').innerHTML = `Online users: ${numUsers}`;
	});
}

function initializeUI(resolve: (user: User) => void) {
	// Hackily add some messages into the FirebaseUI login screen
	const onlineUsersMessage = document.createElement('div');
	onlineUsersMessage.id = 'onlineUsers';
	document.getElementById('firebaseui-auth-container').prepend(onlineUsersMessage);

	const alphaDisclaimer = document.createElement('div');
	alphaDisclaimer.id = 'alphaDisclaimer';
	alphaDisclaimer.innerHTML = 'NOTE: jspuyo is in alpha, which means that some features may' +
								'<br>be broken and your account data may be occasionally reset.';
	document.getElementById('firebaseui-auth-container').prepend(alphaDisclaimer);

	const introMessage = document.createElement('div');
	introMessage.id = 'introMessage';
	introMessage.innerHTML = 'A multiplayer puzzle game for your browser.';
	document.getElementById('firebaseui-auth-container').prepend(introMessage);

	const welcomeMessage = document.createElement('div');
	welcomeMessage.id = 'welcomeMessage';
	welcomeMessage.innerHTML = 'Welcome to jspuyo!';
	document.getElementById('firebaseui-auth-container').prepend(welcomeMessage);

	// Send request for number of online users
	updateOnlineUsers();

	// Upon submission of the display name change
	document.getElementById('usernamePickerForm').onsubmit = function(event) {
		// Do not refresh the page
		event.preventDefault();

		// Use fallback name if there is no name in the input field
		let username = (document.getElementById('usernamePickerText') as HTMLInputElement).value || fallbackName;

		validateUsername(username).then(() => {
			// Update with new username
			updateProfile(currentUser, { displayName: username }).then(function() {
				PlayerInfo.addUser(currentUser.uid, currentUser.displayName);

				document.getElementById('usernamePickerError').style.display = 'none';
				document.getElementById('modal-login').style.display = 'none';
				document.getElementById('main-content').style.display = 'grid';

				// This is always a new user, so ask if they want to view guide first
				document.getElementById('viewGuideModal').style.display = 'block';
				document.getElementById('modal-background').style.display = 'block';

				newUser = false;

				// Start game logic
				resolve(currentUser);
			}
			).catch(function(error) {
				console.log(error);
			});
		}
		).catch((error: string) => {
			// Promise was rejected - username not valid
			document.getElementById('usernamePickerError').innerHTML = error;
			document.getElementById('usernamePickerError').style.display = 'block';
			username = (document.getElementById('usernamePickerText') as HTMLInputElement).value || fallbackName;
		});
	};
}

/**
 * Signs out the current user and opens the login screen again.
 * Used in other modules where Firebase is not accessible.
 * If the user was an anonymous user, their account is deleted to save space.
 */
export async function signOut(): Promise<void> {
	const auth = getAuth(firebaseApp);
	updateOnlineUsers();

	if(auth.currentUser && auth.currentUser.isAnonymous) {
		await PlayerInfo.deleteUser(auth.currentUser.uid);
		void auth.signOut();
	}
	else {
		void auth.signOut();
	}
	ui.start('#firebaseui-auth-container', uiConfig);
}

/**
 * Checks if a username is valid.
 */
function validateUsername(username: string): Promise<void> {
	const database = getDatabase();

	return new Promise((resolve, reject) => {
		if(!username || username.trim().length === 0) {
			reject('Please enter a username.');
		}

		if(username.length > 15) {
			reject('Your username must be under 15 characters.');
		}

		if(username.trim().length !== username.length) {
			reject('Your username may not contain leading or trailing spaces.');
		}

		// Check for duplicate username
		get(child(ref(database), 'username')).then(data => {
			if(!data.exists()) {
				resolve();
			}
			else {
				const takenUsernames: string[] = Object.values(data.val());
				if(takenUsernames.includes(username)) {
					reject('This username is already in use.');
				}
				else {
					resolve();
				}
			}
		}).catch((err: string) => {
			console.log(`There was an error checking for duplicate usernames. ${err}`);
		});
	});
}

// Properties of the firebase auth User object
const userProperties = ['username', 'email'];

export class PlayerInfo {
	/**
	 * Initializes all the user data with default values.
	 */
	static addUser(uid: string, username: string): void {
		const database = getDatabase();

		void set(ref(database, `username/${uid}`), username);
		void set(ref(database, `userSettings/${uid}`), new UserSettings());
		void set(ref(database, `rating/${uid}`), 1000);
	}

	/**
	 * Updates a specific property of the user data.
	 * @param	uid			UID of the user
	 * @param 	property	Name of the property to be updated
	 * @param	value		New value of the property be updated to
	 * @param	overwrite	Whether to overwrite the property's children. False by default.
	 */
	static updateUser(uid: string, property: string, value: unknown, overwrite = true): void {
		const database = getDatabase();
		// Update the firebase auth User object if it is one of their properties
		if(userProperties.includes(property)) {
			if(property === 'username') {
				void updateProfile(currentUser, { displayName: value as string });
			}
			else {
				void updateProfile(currentUser, { [property]: value });
			}
		}

		// Overwrite/update the database property
		if(overwrite) {
			void set(ref(database, `${property}/${uid}`), value);
		}
		else {
			void update(ref(database, `${property}/${uid}`), value as any);
		}
	}

	/**
	 * Deletes all user information stored in the database.
	 * Only called when an anonymous user logs out.
	 */
	static async deleteUser(uid: string) : Promise<unknown[]> {
		const database = getDatabase();

		const promises = [
			remove(ref(database, `username/${uid}`)),
			remove(ref(database, `userSettings/${uid}`)),
			remove(ref(database, `rating/${uid}`)),
			remove(ref(database, `stats/${uid}`)),
		];
		return Promise.all(promises);
	}

	static getUserProperty(uid: string, property: string): Promise<unknown> {
		const database = getDatabase();
		return new Promise((resolve, reject) => {
			get(child(ref(database), `${property}/${uid}`)).then(data => {
				if(!data.exists()) {
					reject(`No ${property} found for user ${uid}.`);
				}
				else {
					resolve(data.val());
				}
			}).catch((error: string) => {
				reject(`Unable to access firebase database. ${error}`);
			});
		});
	}
}
