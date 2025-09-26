import Dexie, { type Table } from "dexie";

export interface ChatMessage {
  id: string;
  platform: "chatgpt" | "claude" | "perplexity";
  chatId: string;
  parentId?: string;
  content: string;
  role: "user" | "assistant" | "system" | "tool";
  model?: string;
  timestamp: number;
  createdAt: string;
  updatedAt?: string;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: Attachment[];
  metadata?: Record<string, any>;
  // Platform-specific fields
  threadNumber?: number;
  slug?: string;
  title?: string;
  summary?: string;
  embedding?: Float32Array;
  // Search and filtering
  tags?: string[];
}

export interface Attachment {
  id: string;
  type: "image" | "file" | "code" | "url" | "other";
  name: string;
  url?: string;
  content?: string;
  size?: number;
  mimeType?: string;
  metadata?: Record<string, any>;
}

export interface ChatConversation {
  platform: "chatgpt" | "claude" | "perplexity";
  // for Chatconversation chatId will be primary key
  chatId: string;
  title: string;
  summary?: string;
  firstMessage?: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  isStarred: boolean;
  isArchived: boolean;
  hasAttachments: boolean;
  model?: string;
  threadNumber?: number;
  slug?: string;
  // Search and filtering
  tags?: string[];
}

export class PromptSearchDB extends Dexie {
  conversations!: Table<ChatConversation>;
  messages!: Table<ChatMessage>;

  constructor() {
    super("PromptSearchDB");

    this.version(1).stores({
      conversations: `
        chatId, 
        platform, 
        title, 
        messageCount, 
        createdAt, 
        updatedAt, 
        isStarred, 
        isArchived, 
        hasAttachments, 
        model,
        [platform+chatId],
        [platform+title],
        [platform+createdAt],
        [platform+updatedAt],
        [platform+isStarred],
        [platform+isArchived],
        [platform+hasAttachments],
        [platform+model],
        [isStarred+createdAt],
        [hasAttachments+createdAt],
        [model+createdAt]
      `,
      messages: `
        id,
        chatId,
        platform,
        content,
        role,
        model,
        timestamp,
        createdAt,
        updatedAt,
        isStarred,
        hasAttachments,
        embedding,
        [platform+chatId],
        [chatId+role],
        [platform+role],
        [platform+timestamp],
        [isStarred+timestamp],
        [hasAttachments+timestamp],
        [model+timestamp]
      `,
    });
  }
}

export const db = new PromptSearchDB();
