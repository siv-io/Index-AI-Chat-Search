import type { ChatConversation, ChatMessage } from "database/schema";
import { databaseService } from "database/service";

interface SaveConversationsRequest {
  conversationData: {
    conversation: ChatConversation;
    messages: ChatMessage[];
  }[];
}

interface SaveConversationsResponse {
  success: boolean;
  ids?: string[];
  error?: string;
}
// can be called from background scripts directly too
export async function handleSaveConversations(req: any, sender: any) {
  try {
    const { conversationData } = req.body;
    console.log(
      "!conversationData",
      !conversationData,
      "!isArray",
      !Array.isArray(conversationData)
    );
    if (!conversationData || !Array.isArray(conversationData)) {
      return {
        success: false,
        error: "Conversation data array is required",
      };
    }

    // Extract conversations and messages for batch processing
    const conversations = conversationData.map(
      ({ conversation }) => conversation
    );
    const allMessages = conversationData.flatMap(({ messages }) => messages);

    // Use optimized batch insert methods
    await Promise.all([
      databaseService.batchInsertConversations(conversations),
      databaseService.batchInsertMessages(allMessages),
    ]);

    const ids = conversations.map((conv) => conv.chatId);
    console.log("✅ Conversations saved:", ids.length);

    return {
      success: true,
      ids,
    };
  } catch (error: any) {
    console.error("❌ Error saving conversations:", error);
    return {
      success: false,
      error: error.message || "Failed to save conversations",
    };
  }
}
