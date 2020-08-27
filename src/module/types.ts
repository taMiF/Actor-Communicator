export type ActorCommunicatorDisplay = {
    home: boolean,
    notHome: boolean,
    contacts: boolean,
    contact: boolean,
    actors: boolean,
    showActorsButton: boolean
}


export type ChatHistory = ChatMessageData[];

export type ContactData = {
    id: string,
    anonymous: boolean,
    hideFrom: boolean,
    chatHistory: ChatHistory
}

export type ContactsData = {
    [id: string]: ContactData
}

export type ContactDisplayData = {
    id: string,
    name: string,
    img: string,
    anonymous: boolean,
    hideFrom: boolean,
}

export type SelectedContactData = {
    contact: ContactDisplayData,
    // TODO: Add type for SelectedContactData.chatHistory
    chatHistory: ChatHistory
}

export type ChatMessageData = {
    senderId: string,
    recipientId: string,
    text: string,
    unknownSender: boolean
}