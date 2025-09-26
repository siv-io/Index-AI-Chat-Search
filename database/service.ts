import Dexie from "dexie";
import {
  db,
  type Attachment,
  type ChatConversation,
  type ChatMessage,
} from "./schema";

export class DatabaseService {
  // Conversation operations
  async addConversation(
    conversation: ChatConversation,
    messages: ChatMessage[] = []
  ): Promise<string> {
    const chatId = conversation.chatId;

    // Add conversation
    await db.conversations.add(conversation);

    // Add messages if provided
    if (messages.length > 0) {
      await db.messages.bulkAdd(messages);
    }

    return chatId;
  }

  async addConversations(
    conversationData: {
      conversation: ChatConversation;
      messages: ChatMessage[];
    }[]
  ): Promise<string[]> {
    const conversations = conversationData.map(
      ({ conversation }) => conversation
    );
    const allMessages = conversationData.flatMap(({ messages }) => messages);

    // Add conversations
    await db.conversations.bulkAdd(conversations);

    // Add messages
    if (allMessages.length > 0) {
      await db.messages.bulkAdd(allMessages);
    }

    return conversations.map((conv) => conv.chatId);
  }

  async updateConversation(
    chatId: string,
    updates: Partial<ChatConversation>
  ): Promise<void> {
    await db.conversations.update(chatId, updates);
  }

  async deleteConversation(chatId: string): Promise<void> {
    // Delete conversation and all its messages
    await db.transaction("rw", [db.conversations, db.messages], async () => {
      await db.conversations.delete(chatId);
      await db.messages.where("chatId").equals(chatId).delete();
    });
  }

  async getConversation(chatId: string): Promise<ChatConversation | undefined> {
    return await db.conversations.get(chatId);
  }

  // Search operations
  async searchConversations(
    // query: string,
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
    }
  ): Promise<ChatConversation[]> {
    let collection = db.conversations.orderBy("updatedAt").reverse();

    // Apply filters
    if (filters?.platform) {
      collection = collection.filter(
        (conv) => conv.platform === filters.platform
      );
    }
    if (filters?.model) {
      collection = collection.filter((conv) => conv.model === filters.model);
    }
    if (filters?.isStarred !== undefined) {
      collection = collection.filter(
        (conv) => conv.isStarred === filters.isStarred
      );
    }
    if (filters?.isArchived !== undefined) {
      collection = collection.filter(
        (conv) => conv.isArchived === filters.isArchived
      );
    }
    if (filters?.hasAttachments !== undefined) {
      collection = collection.filter(
        (conv) => conv.hasAttachments === filters.hasAttachments
      );
    }
    if (filters?.dateFrom) {
      collection = collection.filter(
        (conv) => conv.createdAt >= filters.dateFrom!
      );
    }
    if (filters?.dateTo) {
      collection = collection.filter(
        (conv) => conv.createdAt <= filters.dateTo!
      );
    }

    // Apply pagination
    if (filters?.offset) {
      collection = collection.offset(filters.offset);
    }
    if (filters?.limit) {
      collection = collection.limit(filters.limit);
    }

    return await collection.toArray();
  }

  // Get messages from a specific conversation
  async getConversationMessages(chatId: string): Promise<ChatMessage[]> {
    return await db.messages.where("chatId").equals(chatId).toArray();
  }

  // Get starred conversations
  async getStarredConversations(
    platform?: "chatgpt" | "claude" | "perplexity"
  ): Promise<ChatConversation[]> {
    let conversations: ChatConversation[];

    if (platform) {
      conversations = await db.conversations
        .where("[platform+isStarred]")
        .equals([platform, 1])
        .toArray();
    } else {
      conversations = await db.conversations
        .where("isStarred")
        .equals(1)
        .toArray();
    }

    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Get conversations with attachments
  async getConversationsWithAttachments(
    platform?: "chatgpt" | "claude" | "perplexity"
  ): Promise<ChatConversation[]> {
    let conversations: ChatConversation[];

    if (platform) {
      conversations = await db.conversations
        .where("[platform+hasAttachments]")
        .equals([platform, 1])
        .toArray();
    } else {
      conversations = await db.conversations
        .where("hasAttachments")
        .equals(1)
        .toArray();
    }

    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Get recent conversations
  async getRecentConversations(
    limit: number = 20,
    platform?: "chatgpt" | "claude" | "perplexity"
  ): Promise<ChatConversation[]> {
    let conversations: ChatConversation[];

    if (platform) {
      conversations = await db.conversations
        .where("platform")
        .equals(platform)
        .toArray();
    } else {
      conversations = await db.conversations.toArray();
    }

    return conversations
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  // Search messages across all conversations
  async searchMessages(
    query: string,
    filters?: {
      platform?: "chatgpt" | "claude" | "perplexity";
      role?: "user" | "assistant" | "system" | "tool";
      model?: string;
      isStarred?: boolean;
      hasAttachments?: boolean;
      dateFrom?: number;
      dateTo?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<ChatMessage[]> {
    let collection = db.messages.orderBy("timestamp").reverse();

    // Apply filters
    if (filters?.platform) {
      collection = collection.filter(
        (msg) => msg.platform === filters.platform
      );
    }
    if (filters?.role) {
      collection = collection.filter((msg) => msg.role === filters.role);
    }
    if (filters?.model) {
      collection = collection.filter((msg) => msg.model === filters.model);
    }
    if (filters?.isStarred !== undefined) {
      collection = collection.filter(
        (msg) => msg.isStarred === filters.isStarred
      );
    }
    if (filters?.hasAttachments !== undefined) {
      collection = collection.filter(
        (msg) => msg.hasAttachments === filters.hasAttachments
      );
    }
    if (filters?.dateFrom) {
      collection = collection.filter(
        (msg) => msg.timestamp >= filters.dateFrom!
      );
    }
    if (filters?.dateTo) {
      collection = collection.filter((msg) => msg.timestamp <= filters.dateTo!);
    }

    // Apply search query
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      collection = collection.filter(
        (msg) =>
          msg.content.toLowerCase().includes(searchTerm) ||
          (msg.title?.toLowerCase().includes(searchTerm) ?? false) ||
          (msg.summary?.toLowerCase().includes(searchTerm) ?? false)
      );
    }

    // Apply pagination
    if (filters?.offset) {
      collection = collection.offset(filters.offset);
    }
    if (filters?.limit) {
      collection = collection.limit(filters.limit);
    }

    return await collection.toArray();
  }

  // Statistics
  async getStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    conversationsByPlatform: Record<string, number>;
    messagesByPlatform: Record<string, number>;
    starredConversations: number;
    conversationsWithAttachments: number;
  }> {
    const [conversations, messages] = await Promise.all([
      db.conversations.toArray(),
      db.messages.toArray(),
    ]);

    const conversationsByPlatform = conversations.reduce((acc, conv) => {
      acc[conv.platform] = (acc[conv.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const messagesByPlatform = messages.reduce((acc, msg) => {
      acc[msg.platform] = (acc[msg.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalConversations: conversations.length,
      totalMessages: messages.length,
      conversationsByPlatform,
      messagesByPlatform,
      starredConversations: conversations.filter((conv) => conv.isStarred)
        .length,
      conversationsWithAttachments: conversations.filter(
        (conv) => conv.hasAttachments
      ).length,
    };
  }

  // Clear all data
  async clearAll(): Promise<void> {
    await db.transaction("rw", [db.conversations, db.messages], async () => {
      await db.conversations.clear();
      await db.messages.clear();
    });
  }

  // Clear data for specific platform
  async clearPlatform(
    platform: "chatgpt" | "claude" | "perplexity"
  ): Promise<void> {
    await db.transaction("rw", [db.conversations, db.messages], async () => {
      await db.conversations.where("platform").equals(platform).delete();
      await db.messages.where("platform").equals(platform).delete();
    });
  }

  // Get all embeddings from messages
  /**
   * Get all messages with non-null embeddings.
   * If limit and offset are provided, batch the results.
   */
  async getAllMessageEmbeddings(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ChatMessage[]> {
    const { limit, offset } = params || {};
    let collection = db.messages.filter((msg) => msg.embedding !== undefined);

    if (typeof offset === "number" && typeof limit === "number") {
      return await collection.offset(offset).limit(limit).toArray();
    } else if (typeof limit === "number") {
      return await collection.limit(limit).toArray();
    } else if (typeof offset === "number") {
      // Dexie does not support offset without limit, so we fetch all and slice
      const all = await collection.toArray();
      return all.slice(offset);
    } else {
      return await collection.toArray();
    }
  }

  /**
   * Get all messages with null embeddings.
   * If limit and offset are provided, batch the results.
   */
  async getAllMessageWithoutEmbeddings(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ChatMessage[]> {
    const { limit, offset } = params || {};
    // Use filter to get messages without embedding
    let collection = db.messages.filter((msg) => !msg.embedding);
    // console.log(await db.messages.toArray());

    if (typeof offset === "number" && typeof limit === "number") {
      return await collection.offset(offset).limit(limit).toArray();
    } else if (typeof limit === "number") {
      return await collection.limit(limit).toArray();
    } else if (typeof offset === "number") {
      // Dexie does not support offset without limit, so we fetch all and slice
      const all = await collection.toArray();
      return all.slice(offset);
    } else {
      return await collection.toArray();
    }
  }

  /**
   * Get messages with embeddings based on filters.
   * Returns messages that have embeddings and match the filter criteria.
   */
  async getFilteredMessagesWithEmbeddings(filters?: {
    platform?: "chatgpt" | "claude" | "perplexity";
    role?: "user" | "assistant" | "system" | "tool";
    hasAttachments?: boolean;
    isStarred?: boolean;
    dateRange?: "last7days" | "last30days" | "last90days" | "all";
    limit?: number;
    offset?: number;
  }): Promise<ChatMessage[]> {
    let collection = db.messages.filter((msg) => msg.embedding !== undefined);

    // Apply filters
    if (filters?.platform) {
      collection = collection.filter(
        (msg) => msg.platform === filters.platform
      );
    }
    if (filters?.role) {
      collection = collection.filter((msg) => msg.role === filters.role);
    }
    if (filters?.hasAttachments !== undefined) {
      collection = collection.filter(
        (msg) => msg.hasAttachments === filters.hasAttachments
      );
    }
    if (filters?.isStarred !== undefined) {
      collection = collection.filter(
        (msg) => msg.isStarred === filters.isStarred
      );
    }
    if (filters?.dateRange && filters.dateRange !== "all") {
      const now = Date.now();
      let daysAgo: number;

      switch (filters.dateRange) {
        case "last7days":
          daysAgo = 7 * 24 * 60 * 60 * 1000;
          break;
        case "last30days":
          daysAgo = 30 * 24 * 60 * 60 * 1000;
          break;
        case "last90days":
          daysAgo = 90 * 24 * 60 * 60 * 1000;
          break;
        default:
          daysAgo = 0;
      }

      if (daysAgo > 0) {
        const cutoffTime = now - daysAgo;
        collection = collection.filter((msg) => msg.timestamp >= cutoffTime);
      }
    }

    // Apply pagination
    if (filters?.offset) {
      collection = collection.offset(filters.offset);
    }
    if (filters?.limit) {
      collection = collection.limit(filters.limit);
    }

    return await collection.toArray();
  }

  /**
   * Get the latest message for a specific platform by timestamp.
   * Optimized for large datasets by only fetching the most recent record.
   */
  async getLatestMessageByPlatform(
    platform: "chatgpt" | "claude" | "perplexity"
  ): Promise<ChatMessage | undefined> {
    // Use the compound index [platform+timestamp] for efficient querying
    // Order by timestamp descending to get the latest message
    const messages = await db.messages
      .where("[platform+timestamp]")
      .between([platform, Dexie.minKey], [platform, Dexie.maxKey])
      .reverse()
      .first();

    return messages;
  }

  /**
   * Get the latest chat ID for a specific platform.
   * More efficient than getting the full message object.
   */
  async getLatestChatIdByPlatform(
    platform: "chatgpt" | "claude" | "perplexity"
  ): Promise<string | undefined> {
    const latestMessage = await this.getLatestMessageByPlatform(platform);
    return latestMessage?.chatId;
  }

  /**
   * Get message count for a specific platform.
   * Efficient count query without fetching all data.
   */
  async getMessageCountByPlatform(
    platform: "chatgpt" | "claude" | "perplexity"
  ): Promise<number> {
    return await db.messages.where("platform").equals(platform).count();
  }

  /**
   * Get conversation count for a specific platform.
   * Efficient count query without fetching all data.
   */
  async getConversationCountByPlatform(
    platform: "chatgpt" | "claude" | "perplexity"
  ): Promise<number> {
    return await db.conversations.where("platform").equals(platform).count();
  }

  /**
   * Check if a specific chat ID exists in the database.
   * Efficient existence check without fetching full data.
   */
  async chatIdExists(chatId: string): Promise<boolean> {
    const count = await db.messages.where("chatId").equals(chatId).count();
    return count > 0;
  }

  /**
   * Get all unique chat IDs for a specific platform.
   * Optimized to only fetch chat IDs, not full message objects.
   */
  async getChatIdsByPlatform(
    platform: "chatgpt" | "claude" | "perplexity"
  ): Promise<string[]> {
    const messages = await db.messages
      .where("platform")
      .equals(platform)
      .toArray();

    // Extract unique chat IDs
    const uniqueChatIds = new Set(messages.map((msg) => msg.chatId));
    return Array.from(uniqueChatIds);
  }

  /**
   * Get messages for specific chat IDs only.
   * More efficient than filtering after fetching all messages.
   */
  async getMessagesByChatIds(chatIds: string[]): Promise<ChatMessage[]> {
    if (chatIds.length === 0) return [];

    // Use 'anyOf' for efficient querying of multiple chat IDs
    return await db.messages.where("chatId").anyOf(chatIds).toArray();
  }

  /**
   * Get the latest N messages for a platform, ordered by timestamp.
   * Optimized for getting recent messages without loading everything.
   */
  async getLatestMessagesByPlatform(
    platform: "chatgpt" | "claude" | "perplexity",
    limit: number = 100
  ): Promise<ChatMessage[]> {
    return await db.messages
      .where("[platform+timestamp]")
      .between([platform, Dexie.minKey], [platform, Dexie.maxKey])
      .reverse()
      .limit(limit)
      .toArray();
  }

  /**
   * Batch insert messages with conflict resolution.
   * More efficient than individual inserts for large datasets.
   */
  async batchInsertMessages(messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;

    // Debug logging to check what we're about to insert
    console.log("🔍 About to insert messages to database:");
    messages.forEach((msg, index) => {
      console.log(
        `Message ${index}: id="${msg.id}", role="${msg.role}", platform="${msg.platform}"`
      );
    });

    try {
      // Use bulkAdd to avoid overwrites - will fail on duplicates
      await db.messages.bulkAdd(messages);
      console.log("✅ Successfully inserted all messages with bulkAdd");
    } catch (error) {
      // console.error("Error in batch insert messages:", error);
      throw error;
    }
  }

  /**
   * Batch insert conversations with conflict resolution.
   * More efficient than individual inserts for large datasets.
   */
  async batchInsertConversations(
    conversations: ChatConversation[]
  ): Promise<void> {
    if (conversations.length === 0) return;

    try {
      // Use bulkPut to handle conflicts automatically
      await db.conversations.bulkAdd(conversations);
    } catch (error) {
      console.error("Error in batch insert conversations:", error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService();
