/** Main entry point for the module.
 *
 *  @author Jan Schoska
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
 *
 */

class ActorCommunicatorAlarmApp extends Application {
    chatMessage = null;

    activateListeners(html) {
        super.activateListeners(html);

        //html.find('input[name="contact-add"]').change(this.onContactAddChange);
        html.find('.chat-message').click(this.onOpenActorCommunicator);
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.width = "auto";
        options.height = "auto";
        options.id = "actor-communicator-alarm";
        options.title = "Alarm";
        options.classes = ['actor-communicator', 'actor-communicator-alarm'];
        options.template = "modules/actor-communicator/templates/actor-communicator-alarm.html";
        return options;
    }

    getData() {
        const chatMessage = this.getChatMessage();
        return {
            chatMessage
        }
    }

    getChatMessage = () => {
        const sender = game.actors.get(this.chatMessage.senderId);

        return {...this.chatMessage, sender}
    }

    onOpenActorCommunicator = () => {
        console.error('onOpenActorCommunicator');
        if (!this.chatMessage) {
            return;
        }

        const actor = game.actors.get(this.chatMessage.recipientId);
        actorCommunicatorApp.showForActor(actor);
    }


    showMessage = (chatMessage, hideAfterSeconds = 5) => {
        this.chatMessage = chatMessage;

        this.render(true);

        if (hideAfterSeconds) {
            setTimeout(() => this.close(), hideAfterSeconds * 1000);
        }
    }
}


class ActorCommunicatorApp extends Application {
    static module = 'actor-communicator';
    static moduleSocket = 'module.actor-communicator';
    static contacts = 'contacts';
    static chatHistory = 'chat-history';

    selectedContact = null;
    selectedActor = null;

    alarmApp = null;

    display = {
        home: true,
        notHome: false,
        contacts: false,
        contact: false,
        actors: false,
        showActorsButton: game.user.isGM
    }

    constructor(actor) {
        super();

        this.selectedActor = actor;
        this.alarmApp = new ActorCommunicatorAlarmApp();

        game.socket.on(ActorCommunicatorApp.moduleSocket, data => {
            console.error('socket', data);
            if (data.chatMessage) {
                if (this._messageIsForActor(this.selectedActor, data.chatMessage)) {
                    // TODO: remove null for timeout.
                    this.alarmApp.showMessage(data.chatMessage, null);

                    const actor = game.actors.get(data.chatMessage.recipientId);
                    const contact = game.actors.get(data.chatMessage.senderId);
                    if (this._actorHasContactMissing(actor, contact)) {
                        console.error('Adding message contact');
                        this._addActorContact(actor, contact, data.chatMessage.unkownSender);
                        this.render();
                    }
                }
            }
        });

        Hooks.on('controlToken', (token, controlled) => {
            if (controlled) {
                this.selectActor(token.actor);
                this.render();
            }
        });
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.add-contact').click(this.onAddActorAsContact);
        html.find('.remove-contact').click(this.onRemoveContact);
        html.find('.add-chat-text').change(this.onSendChatText);
        html.find('.screen-contacts-button').click(this.onScreenOpenContacts);
        html.find('.screen-actors-button').click(this.onScreenOpenActors);
        html.find('.screen-home-button').click(this.onScreenOpenHome);
        html.find('.screen-contact-button').click(this.onScreenOpenContact);
        html.find('.reset-all-contacts').click(this.onResetAllActors);
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.width = 240;
        options.height = "auto";
        options.id = "actor-communicator-personal";
        options.title = "Communicator";
        options.classes = ['actor-communicator'];
        options.template = "modules/actor-communicator/templates/actor-communicator.html";
        return options;
    }

    selectActor = (actor) => {
        this.selectedActor = game.actors.get(actor.id);
        this.selectedContact = null;
        this._setDisplayTo('home');
    }

    showForActor = (actor) => {
        this.selectActor(actor);
        this.render(true);
    }

    getData = () => {
        console.error('getData', game);
        const actors = game.actors.entries ? game.actors.entries : [];

        // Use selection OR default character.
        let selectedActor = this._getUserControlledActor();
        if (!selectedActor && !game.user.isGM) {
            selectedActor = game.user.character
        }
        if (this.selectedActor !== selectedActor) {
            this.selectActor(selectedActor)
        }

        // TODO: Bug. Fay has Boss Human has Contact?
        const contacts = this._getActorContacts(selectedActor);
        let selectedContact = {};

        if (this.selectedContact) {
            selectedContact.contact = this._getActorContact(this.selectedContact);
            selectedContact.chatHistory = this._getContactChatHistory(this.selectedActor, this.selectedContact);
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

    _messageIsForActor(actor, chatMessage) {
        return actor.id === chatMessage.recipientId
    }

    _messageIsForOtherActor(chatMessage) {
        return chatMessage.senderId !== chatMessage.recipientId;
    }

    _messageIsForPlayerActor(chatMessage) {
        const messageIsForPlayerActor = game.users.entries.some(user => user.character?.id === chatMessage.recipientId);
        return this._messageIsForOtherActor(chatMessage) && messageIsForPlayerActor;
    }

    _actorHasContact(actor, possibleContact) {
        if (!possibleContact || !actor) {
            return false;
        }
        const contactIds = this._getActorContactIds(actor);
        return contactIds.some(contactId => contactId === possibleContact.id);
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

    _actorHasContactAlready(actor, contact) {
        const contactIds = this._getActorContactIds(actor);
        return contactIds.indexOf(contact.id) !== -1;
    }

    _actorHasContactMissing(actor, contact) {
        return !this._actorHasContactAlready(actor, contact);
    }

    _currentUserHasCharacter() {
        return game.user.character !== null;
    }

    _getActorFlag(actor, key, defaultValue) {
        if (!actor) {
            return null;
        }
        const jsonValue = actor.getFlag(ActorCommunicatorApp.module, key);
        if (!jsonValue) {
            return defaultValue;
        }
        if (typeof jsonValue !== 'string') {
            return jsonValue;
        }

        return JSON.parse(jsonValue);
    }

    _getActorContactIds(actor) {
        return this._getActorFlag(actor, ActorCommunicatorApp.contacts, []);
    }

    _getActorContact({id, anonymous}) {
        const actor = game.actors.get(id);
        return {
            id: actor.id,
            name: actor.name,
            img: actor.img,
            anonymous: anonymous
        }
    }

    _getActorContacts(actor) {
        if (!actor) {
            return null;
        }
        const contacts = this._getActorContactIds(actor);
        return contacts.map(contact => this._getActorContact(contact));
    }

    async _addActorContact(actor, contact, anonymous = false) {
        // await actor.sunetFlag(ActorCommunicatorApp.module, ActorCommunicatorApp.contacts);
        let contacts = this._getActorContactIds(actor);

        if (this._actorHasContactMissing(actor, contact)) {
            contacts.push({id: contact.id, anonymous});
            await actor.setFlag(ActorCommunicatorApp.module, ActorCommunicatorApp.contacts, JSON.stringify(contacts));
        }

        return contacts
    }

    async _removeActorContact(actor, contact) {
        let contactIds = this._getActorContactIds(actor);
        const contactIndex = contactIds.indexOf(contact.id);
        if (contactIndex === -1) {
            return;
        }
        contactIds = contactIds.filter(contactId => contactId !== contact.id);
        await actor.setFlag(ActorCommunicatorApp.module, ActorCommunicatorApp.contacts, JSON.stringify(contactIds));
        return contactIds;
    }

    async _removeActorContacts(actor) {

    }

    _getContactsChatHistory(actor) {
        return this._getActorFlag(actor, ActorCommunicatorApp.chatHistory, {});
    }

    _getContactChatHistory(actor, contact) {
        if (!contact) {
            return null;
        }
        const contactsChatHistory = this._getContactsChatHistory(actor);
        return contactsChatHistory[contact.id] ? contactsChatHistory[contact.id] : [];
    }

    // TODO: Add 'send at' o'clock data
    _newChatMessage(sender, recipient, chatText, unkownSender) {
        return {
            senderId: sender.id,
            recipientId: recipient.id,
            text: chatText,
            unkownSender
        }
    }

    async _appendContactChatText(actor, contact, chatText) {
        const unkownSender = this._actorHasContactMissing(contact, actor);
        const chatMessage = this._newChatMessage(actor, contact, chatText, unkownSender);

        const chatHistory = this._getContactsChatHistory(actor, contact);
        chatHistory[contact.id] = chatHistory[contact.id] ? chatHistory[contact.id] : [];
        chatHistory[contact.id].push(chatMessage);
        await actor.setFlag(ActorCommunicatorApp.module, ActorCommunicatorApp.chatHistory, JSON.stringify(chatHistory));
        return chatMessage;
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
        this._addActorContact(actor, contact).then(contacts => {
            this.render();
        });
    }

    onRemoveContact = (event) => {
        console.error('onRemoveContact');
        const actor = this.selectedActor;
        if (!actor) {
            return;
        }

        const contactId = event.currentTarget.getAttribute('data-actor-id');
        if (!contactId) {
            return;
        }

        const contact = game.actors.get(contactId);
        this._removeActorContact(actor, contact).then(contactIds => {
            this.render();
        });
    }

    onSendChatText = (event) => {
        console.error('onSendChatText');
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
            if (this._messageIsForPlayerActor(chatMessage)) {
                console.error('emitPlayerMessage', game.socket.emit('module.actor-communicator', {
                    chatMessage
                }));
            }

            this.render();
        })
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

    onScreenOpenContacts = (event) => {
        this._setDisplayTo('contacts');
        this.render();
    }

    onScreenOpenActors = (event) => {
        this._setDisplayTo('actors');
        this.render();
    }

    onScreenOpenContact = (event) => {
        this._setDisplayTo('contact');

        const contactId = event.currentTarget.getAttribute('data-contact-id');
        const contacts = this._getActorContactIds(this.selectedActor);
        const contact = contacts.find(contact => contact.id === contactId);
        if (!contact || this.selectedActor.id === contactId) {
            return;
        }
        this.selectedContact = contact;
        this.render();
    }

    onResetAllActors = (event) => {
        game.actors.entries.forEach(actor => {
            console.error('Resetting communicator data for actor', actor.id);
            actor.unsetFlag(ActorCommunicatorApp.module, ActorCommunicatorApp.contacts);
            actor.unsetFlag(ActorCommunicatorApp.module, ActorCommunicatorApp.chatHistory);
        });
        this.render();
    }

    onScreenOpenHome = (event) => {
        this._setDisplayTo('home');
        this.render();
    }
}


let actorCommunicatorApp = null;

Hooks.on('ready', () => {
    console.error('Actor Communicator', game);
    actorCommunicatorApp = new ActorCommunicatorApp();

    // NOTE: Just as a placeholder, should a 'call' slide in from viewportBorder.
    // const viewportWidth = window.innerWidth || document.documentElement.clientWidth ||
    //     document.body.clientWidth;
    // const viewportHeight = window.innerHeight || document.documentElement.clientHeight ||
    //     document.body.clientHeight;
    // console.error(viewportWidth, viewportHeight);

    if (actorCommunicatorApp._currentUserHasCharacter()) {
        actorCommunicatorApp.render(true);
    }
    // actorComApp.setPosition()
});

Hooks.on('getSceneControlButtons', controls => {
    controls[0].tools.push({
        name: 'Communicator',
        title: 'Communicator',
        icon: 'fas fa-envelope',
        visible: true,
        onClick: () => {
            // Disable selection of SR5GroupRoll Tool.
            controls[0].activeTool = "select";
            actorCommunicatorApp.render(true)
        }
    })
});