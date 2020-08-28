import {ActorCommunicatorApp} from "./communicator";
import {ActorAlarmApp} from "./alarm";


export const preloadTemplates = async function() {
	const templatePaths = [
		ActorCommunicatorApp.options.template,
		ActorAlarmApp.options.template
	];

	return loadTemplates(templatePaths);
}
