import {ActorCommunicatorApp} from "./communicator";


export const preloadTemplates = async function() {
	const templatePaths = [
		// Add paths to "modules/actor-communicator/templates"
		ActorCommunicatorApp.options.template
	];

	return loadTemplates(templatePaths);
}
