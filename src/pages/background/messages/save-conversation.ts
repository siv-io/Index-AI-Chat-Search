import type { ChatConversation, ChatMessage } from "database/schema";
import { databaseService } from "database/service";

interface SaveConversationRequest {
  conversation: ChatConversation;
  messages?: ChatMessage[];
}

interface SaveConversationResponse {
  success: boolean;
  id?: string;
  error?: string;
}

export async function handleSaveConversation(req: any, sender: any) {
  try {
    const { conversation, messages = [] } = req.body;

    if (!conversation) {
      return {
        success: false,
        error: "Conversation data is required",
      };
    }

    const id = await databaseService.addConversation(conversation, messages);
    console.log("✅ Conversation saved:", id);

    return {
      success: true,
      id,
    };
  } catch (error: any) {
    console.error("❌ Error saving conversation:", error);
    return {
      success: false,
      error: error.message || "Failed to save conversation",
    };
  }
}
