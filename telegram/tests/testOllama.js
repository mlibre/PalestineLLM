import dotenv from "dotenv";
import OllamaChat from "../ollama.js";

dotenv.config();

const chat = new OllamaChat(process.env.HOST || 'http://127.0.0.1:11434', process.env.MODEL || 'unsloth_model');
chat.setSystemMessage("dont assist user. just be like a human");

async function testOllama() {
	const response = await chat.chatWithModel('hi');
	console.log({OllamaResponse: response.content})
}
testOllama();