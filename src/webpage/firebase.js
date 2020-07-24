'use strict';

const firebase = require('firebase/app');
const firebaseui = require('firebaseui');
const { firebaseConfig } = require('../../config.js');

// Add the Firebase products that you want to use
require("firebase/auth");

let newUser = false;
let currentUser = null;
let fallbackName = '';		// Display name that is used if empty string is provided (aka the original name)

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

function initApp(callback) {
	// Initialize Firebase
	firebase.initializeApp(firebaseConfig);
	const ui = new firebaseui.auth.AuthUI(firebase.auth());
	ui.start('#firebaseui-auth-container', uiConfig);

	initializeUI(callback);

	firebase.auth().onAuthStateChanged(async function(user) {
		// Just logged in
		if (user) {
			document.getElementById('firebaseui-auth-container').style.display = 'none';

			// Open username change screen if new user
			if(newUser) {
				// Set their current name as default
				document.getElementById('usernamePickerText').value = user.displayName;
				document.getElementById('usernamePickerText').placeholder = user.displayName;
				fallbackName = user.displayName;
				document.getElementById('usernamePicker').style.display = 'block';
				currentUser = user;
			}
			else {
				document.getElementById('modal-login').style.display = 'none';
				document.getElementById('main-content').style.display = 'grid';

				if(user.isAnonymous) {
					// If anonymous, clear session once the tab is closed
					await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
				}
				else {
					// If registered, maintain session until manually logged out
					await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
				}

				// Start the actual game logic
				callback(user, user.isAnonymous);
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

function initializeUI(callback) {
	// Hackily add the welcome message into the FirebaseUI login screen
	const welcomeMessage = document.createElement('div');
	welcomeMessage.id = 'welcomeMessage';
	welcomeMessage.innerHTML = 'Welcome to jspuyo!';
	document.getElementById('firebaseui-auth-container').prepend(welcomeMessage);

	// Upon submission of the display name change
	document.getElementById('usernamePickerForm').onsubmit = function(event) {
		// Do not refresh the page
		event.preventDefault();
		let username = document.getElementById('usernamePickerText').value;

		// Use fallback name if there is no name in the input field
		if(!username) {
			username = fallbackName;
		}

		// Update with new username
		currentUser.updateProfile({ displayName: username }).then(function() {
			document.getElementById('modal-login').style.display = 'none';
			document.getElementById('main-content').style.display = 'grid';

			// Start game logic
			callback(currentUser, false);
		}).catch(function(error) {
			console.log(error);
		});
	};
}

/**
 * Signs out the current user and opens the login screen again.
 * Used in other modules where Firebase is not accessible.
 */
function signOut() {
	firebase.auth().signOut();
	document.getElementById('firebaseui-auth-container').style.display = 'block';
}

module.exports = {
	initApp,
	signOut
};
