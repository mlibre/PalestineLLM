import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import readline from "readline";
import dotenv from "dotenv";
import { NewMessage } from "telegram/events/index.js";
import { NewMessageEvent } from "telegram/events/index.js";
import OllamaChat from "./ollama.js";
// import levelDatabase from "./db.js";

dotenv.config();

const chats = {};
chats.general = new OllamaChat( process.env.HOST || "http://127.0.0.1:11434", process.env.MODEL || "unsloth_model" );
chats.general.setSystemMessage( process.env.SYSTEM_MESSAGE || "" );
const debug = process.env.DEBUG;


const apiId = +process.env.APP_ID;
const apiHash = process.env.APP_HASH;
if ( !apiId )
{
	throw new Error( "API_ID not found!" );
}
const stringSession = new StringSession( process.env.SESSION ); // fill this later with the value from session.save()

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});


export default async function run ()
{
	console.log( "Loading ..." );
	const client = new TelegramClient( stringSession, apiId, apiHash, {
		connectionRetries: 5,
	});
	if ( process.env.SESSION )
	{
		console.log( "connectiong..." );
		await client.connect();
		console.log( "Connected successfully" );
		const resMe = await client.getMe();
		console.log({ firstName: resMe.firstName });
	}
	else
	{
		await client.start({
			phoneNumber: async () =>
			{
				return await new Promise( ( resolve ) =>
				{ return rl.question( "Please enter your number: ", resolve ); });
			},
			password: async () =>
			{
				return await new Promise( ( resolve ) =>
				{ return rl.question( "Please enter your password: ", resolve ); });
			},
			phoneCode: async () =>
			{
				return await new Promise( ( resolve ) =>
				{ return rl.question( "Please enter the code you received: ", resolve ); });
			},
			onError: ( err ) => { return console.log( err ); },
		});
		console.log( "You should now be connected." );
		console.log( "Save this string to avoid logging in again:" );
		console.log( client.session.save() );
		console.log( "Put this string to env.SESSION" );
		await client.sendMessage( "me", { message: "Hello!" });
	}

	const allDialogs = await client.getDialogs();
	const users = {};

	async function handler ( event )
	{
		const eventt = new NewMessageEvent( event );
		console.log( eventt.message.message.peerId.className );
		console.log( eventt.message.message.message );
		if ( eventt.message.message.peerId.className == "PeerUser" && eventt.message.message.message )
		{
			const userId = eventt.message.message.peerId.userId.value;
			if ( !users[userId] )
			{
				await client.getDialogs();
				chats[userId] = new OllamaChat( process.env.HOST || "http://127.0.0.1:11434", process.env.MODEL || "unsloth_model" );
				chats[userId].setSystemMessage( process.env.SYSTEM_MESSAGE || "" );
				users[userId] = 1;
			}
			const { message } = eventt.message.message;
			let isCommand = false;

			const modelChatId = process.env.SEPERATE_MODEL_CHATS == "true" ? userId : "general";

			if ( debug && message.startsWith( "/" ) )
			{
				isCommand = true;
				const res = await runCommand( modelChatId, message );
				await client.sendMessage( userId, { message: res || "not returned" });
			}

			if ( !isCommand )
			{
				const prompt = promptGenerator({
					userId,
					...eventt,
					message
				});
				const response = await chats[modelChatId].chatWithModel( message );
				// chat.setHistoryMessage( chatHistory ); // Is this need? chat history have system messages!
				await client.sendMessage( userId, { message: response.content });
			}
		}
	}
	client.addEventHandler( handler, new NewMessage({}) );
}

function runCommand ( userId, rawMessage )
{
	const command = rawMessage.split( " " )[0];
	const textMessage = rawMessage.replace( `${command } `, "" );
	switch ( command )
	{
	case "/setSystemMessage":
		return setSystemMessage( userId, textMessage );
	case "/reset":
		return resetMessages( userId, textMessage );
	case "/help":
		return help();
	case "/getModels":
		return getModels( userId );
	case "/setModel":
		return setModel( userId, textMessage );
	case "/getSystemMessage":
		return getSystemMessage( userId );
	default:
		return "command not found. send /help";
	}
}

function getChatHistory ()
{
	// let chatHistory = await client.getMessages( eventt.message._chatPeer, {
	// 	limit: 20, // Fetch last 20 messages
	// 	reverse: false // Oldest messages first
	// });
	// chatHistory = chatHistory.map( chat => { return { role: chat.message } || ""; });
	// if ( !users[eventt.message.message.peerId.userId.value] )
	// {
	// 	users[eventt.message.message.peerId.userId.value] = chatHistory;
	// }
	// chat.setHistoryMessage( chatHistory );
}

function help ()
{
	return `
	/reset
	to clear all messagese history and start again

	/setSystemMessage [system message]
	to set new system message + reset

	/getSystemMessage
	to get system message

	/getModels
	to get models list

	/setModel [modelName]
	to set model
	`;
}

function resetMessages ( userId )
{
	chats[userId].resetMessages();
	return "OK";
}

function getSystemMessage ( userId )
{
	return chats[userId].getSystemMessage();
}

function setSystemMessage ( userId, systemMessage )
{
	chats[userId].resetMessages();
	chats[userId].setSystemMessage( systemMessage );
	return "OK";
}

async function getModels ( userId )
{
	const models = await chats[userId].getModels();
	if ( models )
	{
		return JSON.stringify( models, null, 4 );
	}
	return "null";
}

function setModel ( userId, modelTxt )
{
	chats[userId].setModel( modelTxt );
	return "OK";
}

function promptGenerator ( data )
{
	if ( process.env.PROMPT_GENERATOR == "true" )
	{
		return JSON.stringify(
			{
				userId: data.userId,
				isChannel: data.eventt.message.message.isChannel,
				isGroup: data.eventt.message.message.isGroup,
				isPrivate: data.eventt.message.message.isPrivate,
				msgId: data.eventt.message.message.id,
				className: data.eventt.message.message.peerId.className,
				message: data.message
			},
			( key, value ) =>
			{
				return typeof value === "bigint"
					? value.toString()
					: value;
			} // return everything else unchanged
		);
	}
	else
	{
		return data.message;
	}
}

