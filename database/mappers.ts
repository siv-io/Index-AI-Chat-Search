import type { ChatNode } from "types/claude/Chat";
import type { AllPerplexityChats } from "types/perplexity/AllChats";
import type { Entry, PerplexityChat } from "types/perplexity/Chat";
import { v4 as uuidv4 } from "uuid";

import type { Attachment, ChatConversation, ChatMessage } from "./schema";
import { ChatMessage as ClaudeChatMessage } from "types/claude/Chat";

export function mapClaudeSampleToConversations(
  sampleData: any
): { conversation: ChatConversation; messages: ChatMessage[] }[] {
  const conversationData: {
    conversation: ChatConversation;
    messages: ChatMessage[];
  }[] = [];

  // Process each chat detail from the sample data
  sampleData.chatDetails.forEach((chatDetail: ChatNode) => {
    const messages: ChatMessage[] = [];
    let firstMessage = "";
    let lastMessage = "";

    // Map each chat message in the chat detail
    chatDetail.chat_messages.forEach(
      (chatMsg: ClaudeChatMessage, msgIndex: number) => {
        const message: ChatMessage = {
          id: `${chatMsg.uuid}`,
          platform: "claude",
          chatId: chatDetail.uuid,
          parentId:
            chatMsg.parent_message_uuid !==
            "00000000-0000-4000-8000-000000000000"
              ? chatMsg.parent_message_uuid
              : undefined,
          content: chatMsg.text,
          role: chatMsg.sender === "human" ? "user" : "assistant",
          model: undefined, // Not available in sample data
          timestamp: new Date(chatMsg.created_at).getTime(),
          createdAt: chatMsg.created_at,
          updatedAt: chatMsg.updated_at,
          isStarred: chatDetail.is_starred || false,
          hasAttachments: chatMsg.attachments?.length > 0,
          attachments: mapClaudeAttachments(chatMsg.attachments || []),
          // metadata: {
          //   isTemporary: chatDetail.is_temporary,
          //   settings: chatDetail.settings,
          //   index: chatMsg.index,
          //   parentMessageUuid: chatMsg.parent_message_uuid,
          //   truncated: chatMsg.truncated,
          //   stopReason: chatMsg.stop_reason,
          //   inputMode: chatMsg.input_mode,
          //   syncSources: chatMsg.sync_sources,
          //   files: chatMsg.files,
          //   filesV2: chatMsg.files_v2
          // },
          threadNumber: undefined, // Not available in sample data
          slug: undefined, // Not available in sample data
          title: chatDetail.name,
          summary: chatDetail.summary,
          tags: [],
        };

        messages.push(message);

        // Track first and last messages
        if (msgIndex === 0) {
          firstMessage = chatMsg.text;
        }
        lastMessage = chatMsg.text;
      }
    );

    // Create the conversation
    const conversation: ChatConversation = {
      platform: "claude",
      chatId: chatDetail.uuid,
      title: chatDetail.name || "Untitled Chat",
      summary: chatDetail.summary || "",
      firstMessage: firstMessage,
      lastMessage: lastMessage,
      messageCount: messages.length,
      createdAt: new Date(chatDetail.created_at).getTime(),
      updatedAt: new Date(chatDetail.updated_at).getTime(),
      isStarred: chatDetail.is_starred || false,
      isArchived: false, // Not available in sample data
      hasAttachments: messages.some((msg) => msg.hasAttachments),
      model: undefined, // Not available in sample data
      threadNumber: undefined, // Not available in sample data
      slug: undefined, // Not available in sample data
      tags: [],
    };

    conversationData.push({ conversation, messages });
  });

  return conversationData;
}

export function mapPerplexitySampleToConversations(
  sampleData: any
): { conversation: ChatConversation; messages: ChatMessage[] }[] {
  const conversationData: {
    conversation: ChatConversation;
    messages: ChatMessage[];
  }[] = [];

  // Process each chat detail from the sample data
  sampleData.chatDetails.forEach((chatDetail: PerplexityChat) => {
    if (!chatDetail.entries || chatDetail.entries.length === 0) return;

    const messages: ChatMessage[] = [];
    let firstMessage = "";
    let lastMessage = "";
    let conversationTitle = "";
    let conversationCreatedAt = "";
    let conversationUpdatedAt = "";
    let chatId = "";

    // Process each entry (conversation turn)
    chatDetail.entries.forEach((entry: Entry, entryIndex: number) => {
      // Generate UUID for user message
      const userMessageId = uuidv4();

      // Create user message from query_str using generated UUID
      const userMessage: ChatMessage = {
        id: userMessageId,
        platform: "perplexity",
        chatId: entry.context_uuid,
        parentId:
          entryIndex === 0
            ? undefined
            : `${chatDetail.entries[entryIndex - 1]?.uuid}`,
        content: entry.query_str,
        role: "user",
        model: entry.user_selected_model || entry.display_model,
        timestamp: new Date(entry.updated_datetime).getTime(),
        createdAt: entry.updated_datetime,
        updatedAt: entry.updated_datetime,
        isStarred: false,
        hasAttachments: entry.attachments?.length > 0,
        attachments: mapPerplexityAttachments(entry.attachments || []),
        metadata: {
          mode: entry.mode,
          searchFocus: entry.search_focus,
          source: entry.source,
          isProReasoningMode: entry.is_pro_reasoning_mode,
          privacyState: entry.privacy_state,
          gpt4: entry.gpt4,
          personalized: entry.personalized,
          querySource: entry.query_source,
        },
        threadNumber: undefined,
        slug: entry.thread_url_slug,
        title: entry.thread_title,
        summary: undefined,
        tags: entry.related_queries || [],
      };
      messages.push(userMessage);

      // Extract AI response from blocks
      const responseContent = extractPerplexityContent(entry.blocks);

      // Create assistant message from response using entry.uuid
      const assistantMessage: ChatMessage = {
        id: `${entry.uuid}`,
        platform: "perplexity",
        chatId: entry.context_uuid,
        parentId: userMessageId, // Assistant message points to the user query
        content: responseContent,
        role: "assistant",
        model: entry.user_selected_model || entry.display_model,
        timestamp: new Date(entry.updated_datetime).getTime(),
        createdAt: entry.updated_datetime,
        updatedAt: entry.updated_datetime,
        isStarred: false,
        hasAttachments: entry.attachments?.length > 0,
        attachments: mapPerplexityAttachments(entry.attachments || []),
        metadata: {
          mode: entry.mode,
          searchFocus: entry.search_focus,
          source: entry.source,
          isProReasoningMode: entry.is_pro_reasoning_mode,
          privacyState: entry.privacy_state,
          gpt4: entry.gpt4,
          personalized: entry.personalized,
          querySource: entry.query_source,
          sources: entry.sources,
          answerModes: entry.answer_modes,
          socialInfo: entry.social_info,
        },
        threadNumber: undefined,
        slug: entry.thread_url_slug,
        title: entry.thread_title,
        summary: undefined,
        tags: entry.related_queries || [],
      };

      messages.push(assistantMessage);

      // Track conversation metadata
      if (entryIndex === 0) {
        firstMessage = entry.query_str;
        conversationTitle = entry.thread_title || "Untitled Conversation";
        conversationCreatedAt = entry.updated_datetime;
        chatId = entry.context_uuid;
      }
      lastMessage = responseContent;
      conversationUpdatedAt = entry.updated_datetime;
    });

    // Create one conversation per chat detail (which contains multiple entries)
    const conversation: ChatConversation = {
      platform: "perplexity",
      chatId: chatId,
      title: conversationTitle,
      summary: undefined,
      firstMessage: firstMessage,
      lastMessage: lastMessage,
      messageCount: messages.length,
      createdAt: new Date(conversationCreatedAt).getTime(),
      updatedAt: new Date(conversationUpdatedAt).getTime(),
      isStarred: false,
      isArchived: false,
      hasAttachments: messages.some((msg) => msg.hasAttachments),
      model:
        chatDetail.entries[0]?.user_selected_model ||
        chatDetail.entries[0]?.display_model,
      threadNumber: undefined,
      slug: chatDetail.entries[0]?.thread_url_slug,
      tags: [],
    };

    conversationData.push({ conversation, messages });
  });

  return conversationData;
}

// ChatGPT mappers
export function mapChatGPTSampleToConversations(
  sampleData: any
): { conversation: ChatConversation; messages: ChatMessage[] }[] {
  const conversationData: {
    conversation: ChatConversation;
    messages: ChatMessage[];
  }[] = [];

  // Process each chat detail from the sample data
  sampleData.chatDetails.forEach((chatDetail: any) => {
    const messages: ChatMessage[] = [];
    let firstMessage = "";
    let lastMessage = "";

    // Find root nodes (nodes without parent)
    const rootNodes = Object.values(chatDetail.mapping).filter(
      (node: any) => node.parent === null
    );

    // Traverse from root nodes through children
    const visited = new Set<string>();
    const queue = [...rootNodes.map((node: any) => node.id)];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId) || !chatDetail.mapping[nodeId]) continue;

      visited.add(nodeId);
      const node = chatDetail.mapping[nodeId];

      // Process message if it exists and meets criteria
      if (node.message && shouldIncludeMessage(node.message)) {
        const message: ChatMessage = {
          id: node.message.id,
          platform: "chatgpt",
          chatId: chatDetail.id,
          parentId: node.parent || undefined,
          content: extractChatGPTContent(node.message.content),
          role: mapChatGPTRole(node.message.author.role),
          model: node.message.metadata?.model_slug,
          timestamp: (node.message.create_time || 0) * 1000,
          createdAt: node.message.create_time
            ? new Date(node.message.create_time * 1000).toISOString()
            : new Date().toISOString(),
          updatedAt: node.message.update_time
            ? new Date(node.message.update_time * 1000).toISOString()
            : undefined,
          isStarred: chatDetail.is_starred || false,
          hasAttachments: hasChatGPTAttachments(node.message.content),
          attachments: extractChatGPTAttachments(node.message.content),
          metadata: {
            recipient: node.message.recipient,
            status: node.message.status,
            weight: node.message.weight,
            endTurn: node.message.end_turn,
            channel: node.message.channel,
            ...node.message.metadata,
          },
          threadNumber: undefined,
          slug: undefined,
          title: undefined,
          summary: undefined,
          tags: [],
        };

        messages.push(message);

        // Track first and last messages
        if (messages.length === 1) {
          firstMessage = message.content;
        }
        lastMessage = message.content;
      }

      // Add children to queue
      queue.push(...node.children);
    }

    // Sort messages by timestamp to ensure correct order
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // Create the conversation
    const conversation: ChatConversation = {
      platform: "chatgpt",
      chatId: chatDetail.id,
      title: chatDetail.title || "Untitled Chat",
      summary: undefined,
      firstMessage: firstMessage,
      lastMessage: lastMessage,
      messageCount: messages.length,
      createdAt: chatDetail.create_time * 1000,
      updatedAt: chatDetail.update_time * 1000,
      isStarred: chatDetail.is_starred || false,
      isArchived: chatDetail.is_archived || false,
      hasAttachments: messages.some((msg) => msg.hasAttachments),
      model: undefined, // Could be extracted from messages if needed
      threadNumber: undefined,
      slug: undefined,
      tags: [],
    };

    conversationData.push({ conversation, messages });
  });

  return conversationData;
}

// Perplexity mappers
// NOT USED
// export function mapPerplexityChatToConversation(
//   chatDetails: PerplexityChat,
//   chatSummary: AllPerplexityChats[0]
// ): ChatConversation {
//   const messages: ChatMessage[] = []

//   chatDetails.entries.forEach((entry, index) => {
//     // Create a user message for the query
//     const userMessage: ChatMessage = {
//       id: `${entry.uuid}_user_${index}`,
//       platform: "perplexity",
//       chatId: chatSummary.uuid,
//       messageId: `${entry.uuid}_user`,
//       parentId: undefined, // Perplexity doesn't have explicit parent relationships
//       content: entry.query_str,
//       role: "user",
//       model: entry.user_selected_model || entry.display_model,
//       timestamp: new Date(entry.updated_datetime).getTime(),
//       createdAt: entry.updated_datetime,
//       updatedAt: entry.entry_updated_datetime,
//       isStarred: false, // TODO: Check if Perplexity has starred status
//       hasAttachments: entry.attachments?.length > 0,
//       attachments: mapPerplexityAttachments(entry.attachments || []),
//       metadata: {
//         threadNumber: chatSummary.thread_number,
//         slug: chatSummary.slug,
//         mode: entry.mode,
//         searchFocus: entry.search_focus,
//         source: entry.source,
//         isProReasoningMode: entry.is_pro_reasoning_mode,
//         stepType: entry.step_type,
//         privacyState: entry.privacy_state,
//         gpt4: entry.gpt4
//       },
//       threadNumber: chatSummary.thread_number,
//       slug: chatSummary.slug,
//       title: entry.thread_title,
//       tags: entry.related_queries || []
//     }

//     messages.push(userMessage)

//     // Create assistant message for the response
//     const assistantMessage: ChatMessage = {
//       id: `${entry.uuid}_assistant_${index}`,
//       platform: "perplexity",
//       chatId: chatSummary.uuid,
//       messageId: `${entry.uuid}_assistant`,
//       parentId: `${entry.uuid}_user_${index}`, // Assistant message replies to user message
//       content: extractPerplexityContent(entry.blocks),
//       role: "assistant",
//       model: entry.user_selected_model || entry.display_model,
//       timestamp: new Date(entry.updated_datetime).getTime(),
//       createdAt: entry.updated_datetime,
//       updatedAt: entry.entry_updated_datetime,
//       isStarred: false,
//       hasAttachments: entry.attachments?.length > 0,
//       attachments: mapPerplexityAttachments(entry.attachments || []),
//       metadata: {
//         threadNumber: chatSummary.thread_number,
//         slug: chatSummary.slug,
//         mode: entry.mode,
//         searchFocus: entry.search_focus,
//         source: entry.source,
//         isProReasoningMode: entry.is_pro_reasoning_mode,
//         stepType: entry.step_type,
//         privacyState: entry.privacy_state,
//         gpt4: entry.gpt4,
//         sources: entry.sources,
//         answerModes: entry.answer_modes,
//         classifierResults: entry.classifier_results
//       },
//       threadNumber: chatSummary.thread_number,
//       slug: chatSummary.slug,
//       title: entry.thread_title,
//       tags: entry.related_queries || []
//     }

//     messages.push(assistantMessage)
//   })

//   return {
//     id: chatSummary.uuid,
//     platform: "perplexity",
//     chatId: chatSummary.uuid,
//     title: chatSummary.title,
//     summary: chatSummary.first_answer,
//     firstMessage: chatSummary.first_answer,
//     lastMessage: chatSummary.first_answer, // TODO: Get actual last message
//     messageCount: messages.length,
//     createdAt: new Date(chatSummary.last_query_datetime).getTime(),
//     updatedAt: new Date(chatSummary.last_query_datetime).getTime(),
//     isStarred: false, // TODO: Check if Perplexity has starred status
//     isArchived: false, // TODO: Check if Perplexity has archived status
//     hasAttachments: chatSummary.featured_images?.length > 0,
//     model: chatSummary.display_model,
//     threadNumber: chatSummary.thread_number,
//     slug: chatSummary.slug,
//     messages,
//     tags: []
//   }
// }

// Helper functions
function extractContent(content: any): string {
  if (typeof content === "string") return content;
  if (content.text) return content.text;
  if (content.parts && Array.isArray(content.parts)) {
    return content.parts.join(" ");
  }
  return "";
}

function hasAttachments(content: any): boolean {
  // TODO: Implement attachment detection based on content structure
  return false;
}

function extractAttachments(content: any): Attachment[] {
  // TODO: Implement attachment extraction based on content structure
  return [];
}

// ChatGPT helper functions
function shouldIncludeMessage(message: any): boolean {
  // Don't include messages with model_editable_context content type
  if (message.content?.content_type === "model_editable_context") {
    return false;
  }

  // Don't include messages with empty parts
  if (message.content?.parts && Array.isArray(message.content.parts)) {
    const hasNonEmptyParts = message.content.parts.some(
      (part: any) => part && part.toString().trim() !== ""
    );
    if (!hasNonEmptyParts) {
      return false;
    }
  }

  // Don't include visually hidden messages
  if (message.metadata?.is_visually_hidden_from_conversation === true) {
    return false;
  }

  return true;
}

function extractChatGPTContent(content: any): string {
  if (typeof content === "string") return content;
  if (content.text) return content.text;
  if (content.parts && Array.isArray(content.parts)) {
    return content.parts
      .filter((part: any) => part && part.toString().trim() !== "")
      .join(" ");
  }
  return "";
}

function mapChatGPTRole(
  role: string
): "user" | "assistant" | "system" | "tool" {
  switch (role) {
    case "user":
      return "user";
    case "assistant":
      return "assistant";
    case "system":
      return "system";
    case "tool":
      return "tool";
    default:
      return "assistant"; // Default fallback
  }
}

function hasChatGPTAttachments(content: any): boolean {
  // Check for various attachment indicators in ChatGPT content
  if (content?.content_type === "multimodal_text" && content.parts) {
    return content.parts.some(
      (part: any) => part && typeof part === "object" && part.type
    );
  }
  return false;
}

function extractChatGPTAttachments(content: any): Attachment[] {
  const attachments: Attachment[] = [];

  if (content?.content_type === "multimodal_text" && content.parts) {
    content.parts.forEach((part: any, index: number) => {
      if (part && typeof part === "object" && part.type) {
        attachments.push({
          id: `${part.id || index}`,
          type: mapChatGPTAttachmentType(part.type),
          name: part.name || `Attachment ${index + 1}`,
          url: part.url,
          content: part.content,
          size: part.size,
          mimeType: part.mimeType,
          metadata: part,
        });
      }
    });
  }

  return attachments;
}

function mapChatGPTAttachmentType(
  type: string
): "image" | "file" | "code" | "url" | "other" {
  switch (type) {
    case "image":
      return "image";
    case "file":
      return "file";
    case "code":
      return "code";
    case "url":
      return "url";
    default:
      return "other";
  }
}

function mapClaudeAttachments(attachments: any[]): Attachment[] {
  return attachments.map((att, index) => ({
    id: att.id || `${index}`,
    type: "file" as const,
    name: att.file_name || "Unknown",
    url: undefined,
    content: att.extracted_content,
    size: att.file_size,
    mimeType: att.file_type,
    metadata: {
      createdAt: att.created_at,
      fileType: att.file_type,
    },
  }));
}

function mapPerplexityAttachments(attachments: any[]): Attachment[] {
  return attachments.map((att, index) => ({
    id: `${att.id || index}`,
    type: "other" as const,
    name: att.name || "Unknown",
    url: att.url,
    content: att.content,
    size: att.size,
    mimeType: att.mimeType,
    metadata: att,
  }));
}

// function to extract content from perplexity blocks
function extractPerplexityContent(blocks: any[]): string {
  return blocks
    .map((block) => {
      if (block.markdown_block?.answer) return block.markdown_block.answer;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}
