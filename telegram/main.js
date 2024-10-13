import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import readline from "readline";
import dotenv from "dotenv";
import { NewMessage } from "telegram/events/index.js";
import { NewMessageEvent } from "telegram/events/index.js";
import OllamaChat from "./ollama.js";

dotenv.config();

const chats = {};
chats.general = new OllamaChat(process.env.HOST || 'http://127.0.0.1:11434', process.env.MODEL || 'unsloth_model');
chats.general.setSystemMessage(process.env.SYSTEM_MESSAGE || "");
const debug = process.env.DEBUG;


const apiId = +process.env.APP_ID;
const apiHash = process.env.APP_HASH;
if(!apiId){
	throw new Error('API_ID not found!');
}
const stringSession = new StringSession(process.env.SESSION); // fill this later with the value from session.save()

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});



export default async function run() {
	console.log("Loading interactive example...");
	const client = new TelegramClient(stringSession, apiId, apiHash, {
		connectionRetries: 5,
	});
	if (process.env.SESSION) {
		console.log("connectiong...");
		await client.connect();
		console.log("Connected successfully");
		let resMe = await client.getMe();
		console.log({ firstName: resMe.firstName });
	}
	else {
		await client.start({
			phoneNumber: async () =>
				new Promise((resolve) =>
					rl.question("Please enter your number: ", resolve)
				),
			password: async () =>
				new Promise((resolve) =>
					rl.question("Please enter your password: ", resolve)
				),
			phoneCode: async () =>
				new Promise((resolve) =>
					rl.question("Please enter the code you received: ", resolve)
				),
			onError: (err) => console.log(err),
		});
		console.log("You should now be connected.");
		console.log("Save this string to avoid logging in again:");
		console.log(client.session.save());
		console.log("Put this string to env.SESSION");
		await client.sendMessage("me", { message: "Hello!" });
	}

	let users = {};

	async function handler(event) {
		const eventt = new NewMessageEvent(event);
		console.log(eventt.message.message.peerId.className)
		console.log(eventt.message.message.message)
		if (eventt.message.message.peerId.className == 'PeerUser' && eventt.message.message.message) {
			let userId = eventt.message.message.peerId.userId.value;
			if (!users[userId]) {
				await client.getDialogs();
				chats[userId] = new OllamaChat(process.env.HOST || 'http://127.0.0.1:11434', process.env.MODEL || 'unsloth_model');
				chats[userId].setSystemMessage(process.env.SYSTEM_MESSAGE || "");
				users[userId] = 1;
			}
			let message = eventt.message.message.message;
			let isCommand = false;

			let modelChatId = process.env.SEPERATE_MODEL_CHATS == 'true' ? userId : 'general';

			if(debug && message.startsWith('/')){
				isCommand = true;
				let res = await runCommand(modelChatId, message);
				await client.sendMessage(userId, { message: res || 'not returned' });
			}

			if(!isCommand){
				const response = await chats[modelChatId].chatWithModel(JSON.stringify({
					userId,
					isChannel: eventt.message.message.isChannel,
					isGroup: eventt.message.message.isGroup,
					isPrivate: eventt.message.message.isPrivate,
					msgId: eventt.message.message.id,
					className: eventt.message.message.peerId.className,
					message
				}, (key, value) =>
					typeof value === 'bigint'
						? value.toString()
						: value // return everything else unchanged
				));  // Send the user's message to the model

				// Send the response back to the user	
				await client.sendMessage(userId, { message: response.content });
			}
		}
	}
	client.addEventHandler(handler, new NewMessage({}));
};

async function runCommand(userId, rawMessage) {
	let command = rawMessage.split(' ')[0];
	let textMessage = rawMessage.replace(command + ' ', '');
	switch(command){
		case '/setPrompt':
			return setPrompt(userId, textMessage);
		case '/reset':
			return resetMessages(userId, textMessage);
		case '/help':
			return help();
		case '/getModels':
			return getModels(userId);
		case '/setModel':
			return setModel(userId, textMessage);
		case '/getPrompt':
			return getPrompt(userId);
		default:
			return 'command not found. send /help'
	}
}

function help() {
	return `
	/reset
	to clear all messagese history and start again

	/setPrompt [prompt]
	to set new prompt + reset

	/getPrompt
	to get prompt

	/getModels
	to get models list

	/setModel [modelName]
	to set model
	`;
}

async function resetMessages(userId) {
	chats[userId].resetMessages();
	return 'OK';
}
async function setPrompt(userId, prompt) {
	chats[userId].resetMessages();
	chats[userId].setSystemMessage(prompt);	
	return 'OK';
}
async function getModels(userId) {
	let models = await chats[userId].getModels();	
	if(models){
		return JSON.stringify(models, null, 4);
	}
	return 'null';
}
async function setModel(userId, modelTxt) {
	chats[userId].setModel(modelTxt);	
	return 'OK';
}
async function getPrompt(userId) {
	return chats[userId].getSystemMessage();	
}