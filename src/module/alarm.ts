import {AlarmDisplayData, ChatMessageData} from "./types";
import {ActorCommunicatorApp} from "./communicator";

export class ActorAlarmApp extends Application {
    chatMessage: ChatMessageData;
    actorCommunicatorApp: ActorCommunicatorApp;

    static options: ApplicationOptions = {
        width: "auto",
        height: "auto",
        id: "actor-communicator-alarm",
        title: "Alarm",
        classes: ['actor-communicator', 'actor-communicator-alarm'],
        template: "modules/actor-communicator/templates/actor-communicator-alarm.html"
    }

    constructor(actorCommunicatorApp: ActorCommunicatorApp) {
        super();

        this.actorCommunicatorApp = actorCommunicatorApp;
    }

    static get defaultOptions() {
        return {...super.defaultOptions, ...ActorAlarmApp.options}
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.chat-message').click(this.onOpenActorCommunicator);
    }

    onOpenActorCommunicator = () => {
        console.error('onOpenActorCommunicator');
        if (!this.chatMessage) {
            return;
        }

        const actor = game.actors.get(this.chatMessage.recipientId);
        this.actorCommunicatorApp.showForActor(actor);
    }

    getData = (): AlarmDisplayData => {
        const chatMessage = this.getChatMessage();
        console.error('getData Alarm', chatMessage);
        return {
            chatMessage
        }
    }

    getChatMessage = (): ChatMessageData => {
        const sender = game.actors.get(this.chatMessage.senderId);

        return {...this.chatMessage, sender}
    }

    showMessage = (chatMessage: ChatMessageData, hideAfterSeconds: number = 5) => {
        this.chatMessage = chatMessage;

        this.render(true);

        if (hideAfterSeconds) {
            setTimeout(() => this.close(), hideAfterSeconds * 1000);
        }
    }
}