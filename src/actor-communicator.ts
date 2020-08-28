/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: Jan Schoska
 * Content License: MIT
 * Software License: MIT
 *
 *  TODO: Let GM defined actors than be used as contacts. By world scope?
 *  TODO: Update contactableActors on actor CRUD actions.
 *  TODO: How to handle a user with multiple owned actors?
 *  TODO: use SR5Actor.setFlag / getFlag to store contacts
 *
 *  TODO: Storing list data with Entity.setFlag ONLY stores persistantly accross refreshes using JSON...
 *  TODO: How to send messages from user to user? Socket? game.socket?
 *  TODO: Use WYSIWYG Editor for chat texts
 *  TODO: BubbleMessage Support, if possible.
 *  TODO: Group Contact support with group messages.
 */

// Import TypeScript modules
import {moduleName, registerSettings} from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';
import {ActorCommunicatorApp} from "./module/communicator";


let actorCommunicatorApp: ActorCommunicatorApp;
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	console.log(`${moduleName} | Initializing actor-communicator`);

	// Assign custom classes and constants here

	// Register custom module settings
	registerSettings();

	// Preload Handlebars templates
	await preloadTemplates();

	// Register custom sheets (if any)

	actorCommunicatorApp = new ActorCommunicatorApp();
});

/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function() {
	// Do anything after initialization but before
	// ready
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function() {
	// Do anything once the module is ready
});

// Add any additional hooks if necessary
