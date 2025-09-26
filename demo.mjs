import chatgptChats from "./types/chatgpt/sample.json" assert { type: "json" };
import fs from "fs";
import { mapChatGPTSampleToConversations } from "./database/mappers.ts";

// Extract conversationDetails and trim to 10 items
// const trimmedConversationDetails = chatgptChats.conversationDetails.slice(
//   0,
//   10
// );

// // Create new object with the trimmed array
// const trimmedData = {
//   conversationDetails: trimmedConversationDetails,
// };

// const trimmedDataString = JSON.stringify(trimmedData, null, 2);

// fs.writeFileSync("./types/chatgpt/sample.json", trimmedDataString);

// Map the sample data to conversations
const conversations = mapChatGPTSampleToConversations(chatgptChats);

fs.writeFileSync(
  "chatGptConversations.json",
  JSON.stringify(conversations, null, 2)
);
