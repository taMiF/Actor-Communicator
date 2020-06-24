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

const ActorContactsFlag = ['actor-communicator', 'contactIds'];

class ActorCommunicatorAlarmApp extends Application {
    chatMessage = null;

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.width = "auto";
        options.height = "auto";
        options.id = "actor-communicator-alarm";
        options.title = "Alarm";
        options.classes = ['actor-communicator-alarm'];
        options.template = "modules/actor-communicator/templates/actor-communicator-alarm.html";
        return options;
    }

    getData() {
        const chatMessage = this.getChatMessage();
        console.error('Alarm.getdata', chatMessage)
        return {
            chatMessage
        }
    }

    getChatMessage = () => {
        console.error(this.chatMessage, this.chatMessage.senderId, game.actors.get(this.chatMessage.senderId));
        const sender = game.actors.get(this.chatMessage.senderId);
        const text = this.chatMessage.text;
        return {sender, text}
    }

    showMessage = (chatMessage) => {
        this.chatMessage = chatMessage;

        this.render(true);

        setTimeout(() => this.close(), 5000);
    }
}


class ActorCommunicatorApp extends Application {
    selectedContact = null;
    selectedActor = null;

    alarmApp = null;

    constructor(actor) {
        super();

        this.selectedActor = actor;
        this.alarmApp = new ActorCommunicatorAlarmApp();

        game.socket.on('module.actor-communicator', data => {
            console.error('socket', data);
            if (data.chatMessage) {
                this.alarmApp.showMessage(data.chatMessage);
            }
        });

    }

    activateListeners(html) {
        super.activateListeners(html);

        //html.find('input[name="contact-add"]').change(this.onContactAddChange);
        html.find('.add-contact').click(this.onAddActorAsContact);
        html.find('.remove-contact').click(this.onRemoveContact);
        html.find('.select-contact').click(this.onSelectContact);
        html.find('.add-chat-text').change(this.onAddChatText);
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.width = "auto";
        options.height = "auto";
        options.id = "actor-communicator-personal";
        options.title = "Communicator";
        options.classes = ['actor-communicator'];
        options.template = "modules/actor-communicator/templates/actor-communicator.html";
        return options;
    }

    getData = () => {
        console.error('getData', game);
        const actors = game.actors.entries ? game.actors.entries : [];

        // Use selection OR default character.
        let selectedActor = this._getUserControlledActor();
        if (!selectedActor && !game.user.isGM) {
            selectedActor = game.user.character
        }
        this.selectedActor = selectedActor;

        console.error('actor', this.selectedActor);
        console.error(this.selectedContact);
        const contacts = this._getActorContacts(selectedActor);
        const selectedContact = {
            contact: this.selectedContact,
            chatHistory: this._getContactChatHistory(this.selectedActor, this.selectedContact)
        };

        return {
            selectedActor,
            actors,
            contacts,
            selectedContact
        }
    }

    _getUserControlledActor() {
        // TODO: Do something about multi selection.
        const token = canvas.tokens.controlled ? canvas.tokens.controlled[0] : null;
        if (!token) {
            return null;
        }
        // TODO: Check what happens for Grunt token / actors. Shared chatHistory?
        return token.actor;
    }

    _actorHasContactAlready(actor, contact) {
        const contactIds = this._getActorContactIds(actor);
        return contactIds.indexOf(contact.id) !== -1;
    }

    _actorHasContactMissing(actor, contact) {
        return !this._actorHasContactAlready(actor, contact);
    }

    _getActorFlag(actor, key, defaultValue) {
        if (!actor) {
            return null;
        }
        const jsonValue = actor.getFlag('actor-communicator', key);
        if (!jsonValue) {
            return defaultValue;
        }
        if (typeof jsonValue !== 'string') {
            return jsonValue;
        }

        return JSON.parse(jsonValue);
    }

    _getActorContactIds(actor) {
        return this._getActorFlag(actor, 'contactIds', []);
    }

    _getActorContacts(actor) {
        if (!actor) {
            return null;
        }
        const contactIds = this._getActorContactIds(actor);
        return contactIds.map(id => game.actors.get(id));
    }

    async _addActorContact(actor, contact) {
        // await actor.sunetFlag('actor-communicator', 'contactIds');
        let contactIds = this._getActorContactIds(actor);

        if (this._actorHasContactMissing(actor, contact)) {
            contactIds.push(contact.id);
            await actor.setFlag('actor-communicator', 'contactIds', JSON.stringify(contactIds));
        }

        return contactIds
    }

    async _removeActorContact(actor, contact) {
        let contactIds = this._getActorContactIds(actor);
        const contactIndex = contactIds.indexOf(contact.id);
        if (contactIndex === -1) {
            return;
        }
        contactIds = contactIds.filter(contactId => contactId !== contact.id);
        console.error('remove', contactIds, contactIndex, contact.id);
        await actor.setFlag('actor-communicator', 'contactIds', JSON.stringify(contactIds));
        return contactIds;
    }

    _getContactsChatHistory(actor) {
        return this._getActorFlag(actor, 'chat-history', {});
    }

    _getContactChatHistory(actor, contact) {
        if (!contact) {
            return null;
        }
        const contactsChatHistory = this._getContactsChatHistory(actor);
        return contactsChatHistory[contact.id] ? contactsChatHistory[contact.id] : [];
    }

    // TODO: Add 'send at' o'clock data
    _newChatMessage(sender, recipient, chatText) {
        return {
            senderId: sender.id,
            recipientId: recipient.id,
            text: chatText
        }
    }

    async _appendContactChatText(actor, contact, chatText) {
        const chatMessage = this._newChatMessage(actor, contact, chatText);

        const chatHistory = this._getContactsChatHistory(actor, contact);
        chatHistory[contact.id] = chatHistory[contact.id] ? chatHistory[contact.id] : [];
        chatHistory[contact.id].push(chatMessage);
        console.error(chatHistory);
        await actor.setFlag('actor-communicator', 'chat-history', JSON.stringify(chatHistory));
        return chatMessage;
    }

    onAddActorAsContact = (event) => {
        const actor = game.user.character;
        if (!actor) {
            return;
        }

        const contactId = event.currentTarget.getAttribute('data-actor-id');
        if (!contactId) {
            return;
        }

        const contact = game.actors.get(contactId);
        this._addActorContact(actor, contact).then(contacts => {
            this.render();
        });
    }

    onRemoveContact = (event) => {
        console.error('onRemoveContact');
        const actor = game.user.character;
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

    onSelectContact = (event) => {
        console.error('onSelectContact');
        const contactId = event.currentTarget.getAttribute('data-actor-id');
        if (!contactId) {
            return;
        }

        this.selectedContact = game.actors.get(contactId);
        console.error(this.selectedContact);
        this.render();
    }

    onAddChatText = (event) => {
        console.error('onAddChatText');
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
            console.error('emit', game.socket.emit('module.actor-communicator', {
                chatMessage
            }));

            this.render();
        })
    }
}


Hooks.on('ready', () => {
    console.error('Actor Communicator', game);
    const users = game.users.entries;

    console.error(game.modules.keys());

    console.error('Get');
    Object.values(users).forEach(user => {
        console.error(user.name, user.getFlag('actor-communicator', 'data'));
    });

    // console.error('Set');
    // Object.values(users).forEach(user => {
    //     console.error(user.name, user.isGM);
    //     if (!user.isGM) {
    //         user.setFlag('actor-communicator', 'data', {test: 'Hallo'});
    //     }
    // });

    // NOTE: Just as a placeholder, should a 'call' slide in from viewportBorder.
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth ||
        document.body.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight ||
        document.body.clientHeight;
    console.error(viewportWidth, viewportHeight);

    if (game.user.character) {
        new ActorCommunicatorApp().render(true);
    }


    // actorComApp.setPosition()
});

Hooks.on('getSceneControlButtons', controls => {
    controls[0].tools.push({
        name: 'Communicator',
        title: 'Communicator',
        icon: 'fas fa-envelope',
        visible: game.user.isGM,
        onClick: () => {
            // Disable selection of SR5GroupRoll Tool.
            controls[0].activeTool = "select";
            new ActorCommunicatorApp().render(true)
        }
    })
});