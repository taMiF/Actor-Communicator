import {ActorAlarmApp} from "./alarm";
import {moduleName, moduleSocket} from "./settings";
import {
    ActorCommunicatorDisplay,
    ChatMessageData,
    ContactData,
    ContactDisplayData,
    ContactsData,
    SelectedContactData,
    SocketMessage, SocketMessageData, SocketMessageType
} from "./types";

console.error('IT WORKED');

export class ActorCommunicatorApp extends Application {
    static contacts: string = 'contacts';
    static chatHistory: string = 'chat-history';

    selectedActor: Actor;
    selectedContact: Actor;

    display: ActorCommunicatorDisplay;

    alarmApp: ActorAlarmApp;

    static options: ApplicationOptions = {
        width: 240,
        height: "auto",
        id: "actor-communicator-personal",
        title: "Communicator",
        classes: ['actor-communicator'],
        template: "modules/actor-communicator/templates/actor-communicator.html"
    }

    constructor(actor?: Actor) {
        super();

        this.selectedActor = actor;
        this._setupDisplay();
        this.setupHooks();
        this.setupSocketHooks();

        this.alarmApp = new ActorAlarmApp(this);
    }

    static get defaultOptions() {
        return {...super.defaultOptions, ...ActorCommunicatorApp.options}
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.add-contact').click(this.onAddActorAsContact);
        html.find('.add-chat-text').change(this.onSendChatText);
        html.find('.screen-contacts-button').click(this.onScreenOpenContacts);
        html.find('.screen-actors-button').click(this.onScreenOpenActors);
        html.find('.screen-home-button').click(this.onScreenOpenHome);
        html.find('.screen-contact-button').click(this.onScreenOpenContact);
        html.find('.reset-all-contacts').click(this.onResetAllActors);
    }

    getData = () => {
        const actors = game.actors.entries ? game.actors.entries : [];

        // Use selection OR default character.
        let selectedActor = this._getUserControlledActor();
        if (!selectedActor && !game.user.isGM) {
            selectedActor = game.user.character
        }
        if (selectedActor && this.selectedActor !== selectedActor) {
            this.selectActor(selectedActor)
        }

        const contacts = this._getActorContacts(selectedActor);
        let selectedContact: SelectedContactData = {
            contact: null,
            chatHistory: null
        };

        if (this.selectedContact) {
            const contactsData = this._getActorContactsFlag(this.selectedActor);
            const contactData = contactsData[this.selectedContact.id];
            selectedContact.contact = this._getActorFromContactData(contactData);
            selectedContact.chatHistory = contactData.chatHistory;
        }


        const display = this.display;

        return {
            selectedActor,
            actors,
            contacts,
            selectedContact,
            display,
            isGM: game.user.isGM
        }
    }

    onAddActorAsContact = (event) => {
        const actor = this.selectedActor;
        if (!actor) {
            return;
        }

        const contactId = event.currentTarget.getAttribute('data-actor-id');
        if (!contactId || actor.id === contactId) {
            return;
        }

        const contact = game.actors.get(contactId);
        this._addActorContact(actor, contact).then(() => {
            this.render();
        });
    }

    // TODO: Does onSendChatText need to be async?
    onSendChatText = (event) => {
        const chatText = event.currentTarget.value;
        if (!chatText || !chatText.length || chatText.length === 0) {
            return;
        }

        if (this.selectedActor === null) {
            return;
        }

        if (this.selectedContact === null) {
            return;
        }

        this._appendContactChatText(this.selectedActor, this.selectedContact, chatText).then(chatMessage => {
            // TODO: This will prohibit alarms for gm controlled tokens.
            console.error('onSendChatText', chatMessage, this._messageIsForPlayerActor(chatMessage));

            if (this._messageIsForPlayerActor(chatMessage)) {
                const socketMessage = this._createSocketMessage('ChatMessage', chatMessage);
                console.error('emitPlayerMessage', game.socket.emit(moduleSocket, socketMessage));
            }

            this.render();
        })
    }

    onScreenOpenContacts = () => {
        this._setDisplayTo('contacts');
        this.render();
    }

    onScreenOpenActors = () => {
        this._setDisplayTo('actors');
        this.render();
    }

    onScreenOpenContact = (event) => {
        this._setDisplayTo('contact');

        const contactId = event.currentTarget.getAttribute('data-contact-id');
        if (!contactId) {
            return;
        }
        this.selectedContact = game.actors.get(contactId);
        this.render();
    }

    onResetAllActors = () => {
        //@ts-ignore
        game.actors.entries.forEach(actor => {
            console.error('Resetting communicator data for actor', actor.id);
            // TODO: Implement async function for public release.
            actor.unsetFlag(moduleName, ActorCommunicatorApp.contacts);
            actor.unsetFlag(moduleName, ActorCommunicatorApp.chatHistory);

            this.onScreenOpenHome();
        });
        this.render();
    }

    onScreenOpenHome = () => {
        this._setDisplayTo('home');
        this.render();
    }

    selectActor = (actor) => {
        if (actor) {
            this.selectedActor = game.actors.get(actor.id);
            this.selectedContact = null;
            this._setDisplayTo('home');
        }
    }

    showForActor = (actor: Actor) => {
        this.selectActor(actor);
        this.render(true);
    }

    _createSocketMessage(type: SocketMessageType, data: SocketMessageData): SocketMessage {
        return {type, data};
    }

    _setupDisplay() {
        this.display = {
            home: true,
            notHome: false,
            contacts: false,
            contact: false,
            actors: false,
            showActorsButton: game.user?.isGM
        }
    }

    _setDisplayTo(key) {
        if (!this.display.hasOwnProperty(key)) {
            return;
        }
        Object.keys(this.display).forEach(key => this.display[key] = false);
        this.display[key] = true;
        this.display.notHome = !this.display.home;
        this.display.showActorsButton = game.user.isGM;
    }

    _messageIsForOtherActor(chatMessage) {
        return chatMessage.senderId !== chatMessage.recipientId;
    }

    _messageIsForPlayerActor(chatMessage) {
        //@ts-ignore
        const messageIsForPlayerActor = game.users.entries.some(user => user.character?.id === chatMessage.recipientId);
        return messageIsForPlayerActor && this._messageIsForOtherActor(chatMessage);
    }

    _newChatMessage(sender: Actor, recipient: Actor, chatText: string, unknownSender: boolean): ChatMessageData {
        return {
            senderId: sender.id,
            recipientId: recipient.id,
            text: chatText,
            unknownSender
        }
    }

    async _appendContactChatText(actor, contact, chatText) {
        const unknownSender = this._actorHasContactMissing(contact, actor);
        const chatMessage = this._newChatMessage(actor, contact, chatText, unknownSender);

        const contactsData = this._getActorContactsFlag(actor);
        contactsData[contact.id].chatHistory.push(chatMessage);
        await actor.setFlag(moduleName, ActorCommunicatorApp.contacts, JSON.stringify(contactsData));
        return chatMessage;
    }

    async _addActorContact(actor: Actor, contact: Actor, anonymous: boolean = false) {
        // await actor.unsetFlag(moduleName, ActorCommunicatorApp.contacts);
        let contactsData = this._getActorContactsFlag(actor);

        if (this._actorHasContactMissing(actor, contact)) {
            contactsData[contact.id] = {
                id: contact.id,
                anonymous,
                chatHistory: [],
                hideFrom: false // TODO: Implement contact hideFrom
            };
            await actor.setFlag(moduleName, ActorCommunicatorApp.contacts, JSON.stringify(contactsData));
        }

        return contactsData
    }

    _actorHasContact(actor, contact) {
        if (!actor || !contact) {
            return false;
        }
        const contactsData = this._getActorContactsFlag(actor);
        return contactsData.hasOwnProperty(contact.id);
    }

    _actorHasContactMissing(actor, contact) {
        return !this._actorHasContact(actor, contact);
    }

    _getUserControlledActor() {
        // TODO: Do something about multi selection.
        const token = canvas.tokens.controlled ? canvas.tokens.controlled[0] : null;
        if (!token) {
            return null;
        }
        // TODO: Check what happens for Grunt token / actors. Shared chatHistory?
        return game.actors.get(token.actor.id)
    }

    _getActorContacts(actor) {
        if (!actor) {
            return null;
        }
        const contactsData = this._getActorContactsFlag(actor);
        console.error('_getActorContacts', contactsData);
        return Object.values(contactsData).map((contactData: ContactData) => this._getActorFromContactData(contactData));
    }

    // TODO: Remove this function and let template use 'contacts' structure directly.
    _getActorFromContactData({id, anonymous, hideFrom}: ContactData): ContactDisplayData {
        const actor = game.actors.get(id);
        return {
            id: actor.id,
            name: actor.name,
            img: actor.img,
            anonymous: anonymous,
            hideFrom
        }
    }

    _getActorFlag(actor: Actor, key: string, defaultValue: any): any {
        if (!actor) {
            return null;
        }
        console.error('getActorFlag', actor, key);
        const jsonValue = actor.getFlag(moduleName, key);
        if (!jsonValue) {
            return defaultValue;
        }
        if (typeof jsonValue !== 'string') {
            return jsonValue;
        }

        return JSON.parse(jsonValue);
    }

    _getActorContactsFlag(actor: Actor): ContactsData {
        return this._getActorFlag(actor, ActorCommunicatorApp.contacts, {});
    }

    _messageIsForActor(actor: Actor, chatMessage: ChatMessageData) {
        return actor.id === chatMessage.recipientId;
    }

    setupHooks() {
        console.log(`${moduleName} | setupHooks`);

        // Integrate into foundry actors toolbar.
        Hooks.on('getSceneControlButtons', controls => {
            const actorControls = controls[0];
            actorControls.tools.push({
                name: 'Communicator',
                title: 'Communicator',
                icon: 'fas fa-envelope',
                visible: true,
                onClick: () => {
                    actorControls.activeTool = "select";
                    this.render(true)
                }
            })
        });

        // Switch tokens on selection.
        Hooks.on('controlToken', (token, controlled) => {
            if (controlled) {
                this.selectActor(token.actor);
                this.render();
            }
        });
    }

    setupSocketHooks() {
        console.log(`${moduleName} | setupSocketHooks`);

        game.socket.on(moduleSocket, async (messageData: SocketMessage) => {
            console.error(`${moduleName} - socket:${moduleSocket} | `, messageData);

            switch (messageData.type) {
                case 'ChatMessage': {
                    if (messageData.data && this._messageIsForActor(this.selectedActor, messageData.data)) {
                        // TODO: remove null for timeout.
                        this.alarmApp.showMessage(messageData.data, null);

                        const actor: Actor = game.actors.get(messageData.data.recipientId);
                        const contact: Actor = game.actors.get(messageData.data.senderId);
                        if (this._actorHasContactMissing(actor, contact)) {
                            console.error(`${moduleName} | Adding message contact`);
                            await this._addActorContact(actor, contact, messageData.data.unknownSender);
                            this.render();
                        }
                    }
                    break;
                }
                default: {
                    console.error(`${moduleName} | Unknown SocketMessageData type submitted`, messageData);
                }
            }

        });
    }
}