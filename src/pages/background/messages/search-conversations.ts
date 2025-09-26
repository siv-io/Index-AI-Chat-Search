import { databaseService } from "database/service";

interface SearchConversationsRequest {
  filters?: {
    platform?: "chatgpt" | "claude" | "perplexity";
    model?: string;
    isStarred?: boolean;
    isArchived?: boolean;
    hasAttachments?: boolean;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
    offset?: number;
  };
}

interface SearchConversationsResponse {
  success: boolean;
  results?: any[];
  error?: string;
}

export async function handleSearchConversations(req: any, sender: any) {
  try {
    const { filters } = req.body;

    const results = await databaseService.searchConversations(filters);
    console.log("✅ Search completed:", results.length, "results");

    return {
      success: true,
      results,
    };
  } catch (error: any) {
    console.error("❌ Error searching conversations:", error);
    return {
      success: false,
      error: error.message || "Search failed",
    };
  }
}
