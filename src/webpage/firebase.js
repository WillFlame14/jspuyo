'use strict';

const firebase = require('firebase/app');
const firebaseui = require('firebaseui');
const { firebaseConfig } = require('../../config.js');
const { UserSettings } = require('../Utils.js');

// Add the Firebase products that you want to use
require("firebase/auth");
require("firebase/database");

let newUser = false;
let currentUser = null;
let fallbackName = '';		// Display name that is used if empty string is provided (aka the original name)

let ui;				// Firebaseui object
let socket;	// Socket associated with the browser tab

const uiConfig = {
	callbacks: {
		signInSuccessWithAuthResult: function(authResult) {
			// Update global boolean with whether user is new or not
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

/**
 * Initialize the firebase login screen and associated UI changes, as well as methods that handle game start on successful login.
 */
function initApp(globalSocket, loginSuccess) {
	// Initialize Firebase
	firebase.initializeApp(firebaseConfig);
	ui = new firebaseui.auth.AuthUI(firebase.auth());
	ui.start('#firebaseui-auth-container', uiConfig);

	socket = globalSocket;
	initializeUI(loginSuccess);

	firebase.auth().onAuthStateChanged(async function(user) {
		// Just logged in
		if (user) {
			document.getElementById('firebaseui-auth-container').style.display = 'none';

			if(user.isAnonymous) {
				document.getElementById('guestMessage').style.display = 'block';
			}
			else {
				document.getElementById('guestMessage').style.display = 'none';
			}

			// Open username change screen if new user
			if(newUser) {
				// Set their current name as default
				document.getElementById('usernamePickerText').value = user.displayName;
				document.getElementById('usernamePickerText').placeholder = user.displayName || '';
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

function initializeUI(loginSuccess) {
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
	socket.emit('getOnlineUsers');
	socket.on('onlineUsersCount', (numUsers) => {
		onlineUsersMessage.innerHTML = `Online users: ${numUsers}`;
	});

	// Upon submission of the display name change
	document.getElementById('usernamePickerForm').onsubmit = function(event) {
		// Do not refresh the page
		event.preventDefault();

		// Use fallback name if there is no name in the input field
		let username = document.getElementById('usernamePickerText').value || fallbackName;

		validateUsername(username).then(() => {
			// Update with new username
			currentUser.updateProfile({ displayName: username }).then(function() {
				PlayerInfo.addUser(currentUser.uid, currentUser.displayName);

				document.getElementById('usernamePickerError').style.display = 'none';
				document.getElementById('modal-login').style.display = 'none';
				document.getElementById('main-content').style.display = 'grid';

				// Start game logic
				loginSuccess(currentUser);
			}
			).catch(function(error) {
				console.log(error);
			});
		}
		).catch((error) => {
			// Promise was rejected - username not valid
			document.getElementById('usernamePickerError').innerHTML = error;
			document.getElementById('usernamePickerError').style.display = 'block';
			username = document.getElementById('usernamePickerText').value || fallbackName;
		});
	};
}

/**
 * Signs out the current user and opens the login screen again.
 * Used in other modules where Firebase is not accessible.
 * If the user was an anonymous user, their account is deleted to save space.
 */
async function signOut() {
	// Update the online users counter
	socket.emit('getOnlineUsers');

	if(firebase.auth().currentUser && firebase.auth().currentUser.isAnonymous) {
		await PlayerInfo.deleteUser(firebase.auth().currentUser.uid);
		firebase.auth().signOut();
	}
	else {
		firebase.auth().signOut();
	}
	ui.start('#firebaseui-auth-container', uiConfig);
}

/**
 * Checks if a username is valid.
 */
function validateUsername(username) {
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
		firebase.database().ref(`username`).once('value').then(data => {
			if(!data.exists()) {
				resolve();
			}
			else {
				const takenUsernames = Object.values(data.val()).map(pair => pair.username);
				if(takenUsernames.includes(username)) {
					reject('This username is already in use.');
				}
				else {
					resolve();
				}
			}
		});
	});
}

// Properties of the firebase auth User object
const userProperties = ['username', 'email'];

class PlayerInfo {
	/**
	 * Initializes all the user data with default values.
	 */
	static addUser(uid, username) {
		firebase.database().ref(`username/${uid}`).set(username);
		firebase.database().ref(`userSettings/${uid}`).set(new UserSettings());
		firebase.database().ref(`rating/${uid}`).set(1000);
	}

	/**
	 * Updates a specific property of the user data.
	 */
	static updateUser(uid, property, value, overwrite = true) {
		// Update the firebase auth User object if it is one of their properties
		if(userProperties.includes(property)) {
			if(property === 'username') {
				firebase.auth().currentUser.updateProfile({ displayName: value });
			}
			else {
				firebase.auth().currentUser.updateProfile({ [property]: value });
			}
		}

		// Overwrite/update the database property
		if(overwrite) {
			firebase.database().ref(`${property}/${uid}`).set(value);
		}
		else {
			firebase.database().ref(`${property}/${uid}`).update(value);
		}
	}

	/**
	 * Deletes all user information stored in the database.
	 * Only called when an anonymous user logs out.
	 */
	static async deleteUser(uid) {
		const promises = [
			firebase.database().ref(`username/${uid}`).remove(),
			firebase.database().ref(`userSettings/${uid}`).remove(),
			firebase.database().ref(`rating/${uid}`).remove(),
			firebase.database().ref(`stats/${uid}`).remove()
		];
		return Promise.all(promises);
	}

	static getUserProperty(uid, property) {
		return new Promise((resolve, reject) => {
			firebase.database().ref(`${property}/${uid}`).once('value').then(data => {
				if(!data.exists()) {
					reject(`No ${property} found for user ${uid}.`);
				}
				else {
					resolve(data.val());
				}
			});
		});
	}
}

module.exports = {
	PlayerInfo,
	initApp,
	signOut
};
