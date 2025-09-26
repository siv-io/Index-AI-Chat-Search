import type { ChatConversation, ChatMessage } from "database/schema";
import { SearchResponse } from "../background/messages/search-prompts";

// Message handler for saving conversation data using Plasmo messaging
export async function saveConversation(
  conversation: ChatConversation,
  messages: ChatMessage[] = []
) {
  try {
    await chrome.runtime.sendMessage({
      name: "save-conversation",
      body: { conversation, messages },
    });
  } catch (error) {
    console.error("❌ Error saving conversation:", error);
    throw error;
  }
}

// Message handler for saving multiple conversations using Plasmo messaging
export async function saveConversations(
  conversationData: {
    conversation: ChatConversation;
    messages: ChatMessage[];
  }[]
) {
  try {
    const response = await chrome.runtime.sendMessage({
      name: "save-conversations",
      body: { conversationData },
    });

    if (response) {
      console.log("✅ Conversations saved successfully:", response.ids.length);
      return { ids: response.ids };
    } else {
      throw new Error(response.error || "Failed to save conversations");
    }
  } catch (error) {
    console.error("❌ Error saving conversations:", error);
    throw error;
  }
}

// Message handler for searching conversations using Plasmo messaging
export async function searchConversations(
  query: string,
  filters?: any
): Promise<SearchResponse> {
  try {
    const response = await chrome.runtime.sendMessage({
      name: "search-conversations",
      body: { query, filters },
    });

    if (response) {
      console.log("✅ Search completed:", response.results.length, "results");
      return response.results;
    } else {
      throw new Error(response || "Search failed");
    }
  } catch (error) {
    console.error("❌ Error searching conversations:", error);
    throw error;
  }
}
export async function searchPrompts(
  query: string,
  options?: { topK?: number; threshold?: number; filters?: any }
): Promise<SearchResponse> {
  try {
    const response = await chrome.runtime.sendMessage({
      name: "search-prompts",
      body: {
        query,
        topK: options?.topK || 10,
        threshold: options?.threshold || 0.1,
        filters: options?.filters,
      },
    });
    console.log("🔍 Response from search-prompts", response);

    if (response && !response.error) {
      return response;
    } else {
      throw new Error(response?.error || "Search failed");
    }
  } catch (error) {
    console.error("❌ Error searching prompts:", error);
    throw error;
  }
}

export async function searchPromptsDev(
  query: string,
  options?: { topK?: number; threshold?: number; filters?: any }
): Promise<SearchResponse> {
  try {
    const response = await chrome.runtime.sendMessage({
      name: "search-prompts-dev",
      body: {
        query,
        topK: options?.topK || 10,
        threshold: options?.threshold || 0.1,
        filters: options?.filters,
      },
    });
    console.log("🔧 DEV MODE: Response from search-prompts-dev", response);

    if (response && !response.error) {
      return response;
    } else {
      throw new Error(response?.error || "Dev search failed");
    }
  } catch (error) {
    console.error("❌ DEV MODE: Error searching prompts:", error);
    throw error;
  }
}

// Message handler for getting statistics using Plasmo messaging
export async function getStats() {
  try {
    const response = await chrome.runtime.sendMessage({
      name: "get-stats",
      body: {},
    });

    if (response) {
      console.log("✅ Stats retrieved successfully");
      return response.stats;
    } else {
      throw new Error(response.error || "Failed to get stats");
    }
  } catch (error) {
    console.error("❌ Error getting stats:", error);
    throw error;
  }
}

// Message handler for syncing database using Plasmo messaging
export async function syncDatabase(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  platform?: string;
}> {
  try {
    const response = await chrome.runtime.sendMessage({
      name: "sync-database",
      body: {},
    });

    if (response) {
      console.log("✅ Sync completed:", response);
      return response;
    } else {
      throw new Error(response?.error || "Sync failed");
    }
  } catch (error) {
    console.error("❌ Error syncing database:", error);
    throw error;
  }
}
