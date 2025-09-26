// import { env, pipeline } from "@huggingface/transformers";
import { ChatMessage, db } from "database/schema";
// import OpenAI from "openai";

// Import handler functions from message files
import { handleSearchPrompts } from "./messages/search-prompts";
import { handleSaveConversation } from "./messages/save-conversation";
import { handleSaveConversations } from "./messages/save-conversations";
import { handleGetStats } from "./messages/get-stats";
import { handleSearchConversations } from "./messages/search-conversations";
import { databaseService } from "database/service";
import {
  mapClaudeSampleToConversations,
  mapPerplexitySampleToConversations,
  mapChatGPTSampleToConversations,
} from "database/mappers";
import { pipeline, env } from "@huggingface/transformers";

env.backends.onnx.wasm!.wasmPaths = "";

// Initialize database on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed/updated:", details.reason);

  try {
    // Initialize the database
    await db.open();
    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
  }
});

// Initialize database on startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    await db.open();
    console.log("✅ Database opened on startup");
  } catch (error) {
    console.error("❌ Failed to open database on startup:", error);
  }
});

// Initialize database when service worker activates
chrome.runtime.onSuspend.addListener(async () => {
  console.log("🔧 Service worker suspending...");
});

// Ensure database is ready when service worker starts
(async () => {
  try {
    await db.open();
    console.log("✅ Database opened on service worker start");
  } catch (error) {
    console.error("❌ Failed to open database on service worker start:", error);
  }
})();

// Central message handler that routes to specific handlers
chrome.runtime.onMessage.addListener((req, sender, res) => {
  console.log("🔍 Central message handler received:", req.name);

  // Update last activity time
  lastActivityTime = Date.now();

  // Check if embeddings are being generated - if so, don't respond to certain messages
  if (currentProgressState.isActive) {
    console.log("🔄 Embeddings being generated, ignoring message:", req.name);
    // Don't respond to search or sync messages during embedding generation
    if (
      req.name === "search-prompts" ||
      req.name === "search-conversations" ||
      req.name === "sync-database"
    ) {
      res({
        error: "Embeddings are being generated. Please wait and try again.",
        success: false,
      });
      return true;
    }
  }

  // Handle the message asynchronously
  (async () => {
    try {
      let response;
      switch (req.name) {
        case "search-prompts":
          response = await handleSearchPrompts(req, sender);
          break;
        // case "search-prompts-dev":
        //   response = await handleSearchPromptsDev(req, sender);
        //   break;
        case "save-conversation":
          response = await handleSaveConversation(req, sender);
          break;
        case "save-conversations":
          response = await handleSaveConversations(req, sender);
          break;
        case "get-stats":
          response = await handleGetStats(req, sender);
          break;
        case "search-conversations":
          response = await handleSearchConversations(req, sender);
          break;
        case "sync-database":
          response = await handleSyncDatabase(req, sender);
          break;
        default:
          console.warn("❌ Unknown message type:", req.name);
          response = {
            error: `Unknown message type: ${req.name}`,
            success: false,
          };
          break;
      }

      console.log("📤 Sending response:", response);
      res(response);
    } catch (error) {
      console.error("❌ Error in central message handler:", error);
      res({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        success: false,
      });
    }
  })();

  return true; // Indicate that the response will be sent asynchronously
});

// Chrome storage listener to monitor for new chats and save them to IndexedDB
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace !== "local") return;
  else if (currentProgressState.isActive) {
    console.warn("🔄 Embeddings being generated, ignoring storage changes");
    return;
  }

  console.log("🔍 Storage changed, checking for new chats...");

  // Update last activity time
  lastActivityTime = Date.now();

  try {
    // Check for Claude data changes
    if (changes.claude) {
      await processNewChats(changes.claude.newValue, "claude");
    }

    // Check for Perplexity data changes
    if (changes.perplexity) {
      await processNewChats(changes.perplexity.newValue, "perplexity");
    }
    if (changes.chatgpt) {
      await processNewChats(changes.chatgpt.newValue, "chatgpt");
    }

    // Skip ChatGPT for now as requested
  } catch (error) {
    console.error("❌ Error processing storage changes:", error);
  }
});

// Helper function to process new chats for any platform
async function processNewChats(
  platformData: any,
  platform: "claude" | "perplexity" | "chatgpt"
) {
  if (!platformData?.chatDetails) {
    console.log(`No ${platform} chat details found in storage`);
    return;
  }

  try {
    // Get the latest chat ID from IndexedDB using optimized service method
    const latestStoredChatId = await databaseService.getLatestChatIdByPlatform(
      platform
    );
    console.log(
      `Latest ${platform} chat ID in IndexedDB: ${latestStoredChatId}`
    );

    // Get all chat details from storage
    const allChatDetails = platformData.chatDetails || [];
    console.log(
      `Total ${platform} chat details in storage: ${allChatDetails.length}`
    );

    // Find new chats (those not in IndexedDB)
    let newChatDetails = allChatDetails;
    if (latestStoredChatId) {
      const latestStoredIndex = allChatDetails.findIndex((chat: any) => {
        // Different platforms use different fields for chat ID
        if (platform === "claude") {
          return chat.uuid === latestStoredChatId;
        } else if (platform === "perplexity") {
          return chat.entries?.[0]?.context_uuid === latestStoredChatId;
        } else if (platform === "chatgpt") {
          return chat.id === latestStoredChatId;
        }
        return false;
      });

      if (latestStoredIndex !== -1) {
        newChatDetails = allChatDetails.slice(0, latestStoredIndex);
      }
    }

    if (newChatDetails.length === 0) {
      console.log(`✅ No new ${platform} chats found`);
      return;
    }

    console.log(
      `Found ${newChatDetails.length} new ${platform} chats to process`
    );

    // Map new chats using the appropriate mapper function
    const data = { chatDetails: newChatDetails };
    const mappedConversations =
      platform === "claude"
        ? mapClaudeSampleToConversations(data)
        : platform === "perplexity"
        ? mapPerplexitySampleToConversations(data)
        : mapChatGPTSampleToConversations(data);

    console.log(
      `Mapped ${mappedConversations.length} new ${platform} conversations`
    );

    // Create a mapping system to ensure reliability
    const messageEmbeddingPairs: Array<{
      message: any;
      content: string;
      index: number;
    }> = [];
    let globalIndex = 0;

    mappedConversations.forEach((c) => {
      c.messages.forEach((m) => {
        messageEmbeddingPairs.push({
          message: m,
          content: m.content,
          index: globalIndex,
        });
        globalIndex++;
      });
    });

    // Extract contents in the same order
    const contents = messageEmbeddingPairs.map((pair) => pair.content);
    const embeddings = await getEmbeddingsFromHuggingFace(contents);

    // Validate we have the right number of embeddings
    if (embeddings.length !== messageEmbeddingPairs.length) {
      throw new Error(
        `Embedding count mismatch: expected ${messageEmbeddingPairs.length}, got ${embeddings.length}`
      );
    }

    // Assign embeddings using the reliable mapping
    messageEmbeddingPairs.forEach((pair, index) => {
      pair.message.embedding = new Float32Array(embeddings[index]);
    });

    // Save to IndexedDB using the existing handler
    const saveResult = await handleSaveConversations(
      {
        name: "save-conversations",
        body: { conversationData: mappedConversations },
      },
      null
    );

    console.log(
      `✅ Successfully saved ${
        JSON.stringify(saveResult) || 0
      } new ${platform} conversations to IndexedDB`
    );
  } catch (error) {
    console.error(`❌ Error processing new ${platform} chats:`, error);
  }
}

/**
 * Handle sync database request from popup
 */
async function handleSyncDatabase(req: any, sender: any) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab?.url) {
      return {
        success: false,
        error: "Could not determine current site",
      };
    }
    const url = currentTab.url;
    let platform: "claude" | "perplexity" | "chatgpt" | null = null;

    // Determine platform based on URL
    if (url.includes("claude.ai")) {
      platform = "claude";
    } else if (url.includes("perplexity.ai")) {
      platform = "perplexity";
    } else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
      platform = "chatgpt";
    } else {
      return {
        success: false,
        error:
          "Current site is not supported for sync. Please visit Claude.ai or Perplexity.ai",
      };
    }

    console.log(`🔄 Syncing ${platform} data...`);

    // Get data from Chrome storage
    const storageData = await chrome.storage.local.get([platform]);
    const platformData = storageData[platform];

    if (!platformData) {
      return {
        success: false,
        error: `No ${platform} data found in storage`,
      };
    }

    // Process the platform data using the merged function
    await processNewChats(platformData, platform);

    return {
      success: true,
      message: `Successfully synced ${platform} data to database`,
      platform,
    };
  } catch (error) {
    console.error("❌ Error in sync database handler:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
/**
 * Get embeddings from Hugging Face using the all-MiniLM-L6-v2 model
 * @param texts - Array of strings or single string to get embeddings for
 * @returns Promise<number[][]> - Array of embedding vectors
 */
export async function getEmbeddingsFromHuggingFace(texts: string[] | string) {
  // Convert single string to array for consistent processing
  const textArray = Array.isArray(texts) ? texts : [texts];

  // Initialize the Hugging Face pipeline
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    {
      progress_callback: () => {},
    }
  );

  if (!extractor) {
    throw new Error("Failed to initialize Hugging Face pipeline");
  }

  // Process texts in batches to avoid memory issues
  const batchSize = 60; // Smaller batch size for Hugging Face to avoid memory issues
  const batches = createBatches(textArray, batchSize);
  const allEmbeddings: number[][] = [];

  storeEmbeddingProgress(batches.length, "totalBatches");
  console.log(
    `Processing ${textArray.length} texts in ${batches.length} batches...`
  );

  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length}...`);

    try {
      // Process each batch
      const batchEmbeddings = await Promise.all(
        batches[i].map(async (text) => {
          const result = await extractor(text, {
            pooling: "mean",
            normalize: true,
          });
          return Array.from(result.data);
        })
      );

      allEmbeddings.push(...batchEmbeddings);

      // Send batch completion message
      storeEmbeddingProgress(i + 1, "batchComplete");

      // Add a small delay between batches to prevent overwhelming the system
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);
      throw error;
    }
  }

  console.log(`Successfully processed ${allEmbeddings.length} embeddings`);

  // Send completion message
  storeEmbeddingProgress(null, "embeddingComplete");

  return allEmbeddings;
}

/**
 * Creates batches from an array for processing in chunks
 * @param array - The array to split into batches
 * @param batchSize - The size of each batch
 * @returns Array of batches
 */
export function createBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// In-memory progress state for tracking across messages
let currentProgressState = {
  currentBatch: 0,
  totalBatches: 0,
  isActive: false,
  lastUpdated: Date.now(),
};

// Keep background script alive with alarms
let lastActivityTime = Date.now();

// Set up periodic alarm to keep background script alive
chrome.alarms.create("keepAlive", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    const timeSinceLastActivity = Date.now() - lastActivityTime;

    // If no activity for 25+ seconds, do a small storage operation to keep script alive
    if (timeSinceLastActivity > 25000) {
      chrome.storage.local.set({
        lastKeepAlive: Date.now(),
        backgroundActive: true,
      });
      console.log("🔄 Background script keep-alive triggered");
    }
  }
});

function storeEmbeddingProgress(
  message: any,
  name: "totalBatches" | "batchComplete" | "embeddingComplete"
) {
  // Update in-memory state
  if (name === "totalBatches") {
    currentProgressState.totalBatches = message;
    currentProgressState.currentBatch = 0;
    currentProgressState.isActive = true;
  } else if (name === "batchComplete") {
    currentProgressState.currentBatch = message;
  } else if (name === "embeddingComplete") {
    currentProgressState.isActive = false;
    currentProgressState.currentBatch = 0;
    currentProgressState.totalBatches = 0;
  }

  currentProgressState.lastUpdated = Date.now();

  // Write progress data to storage (keeps service worker alive)
  chrome.storage.local.set({ embeddingProgress: currentProgressState });
}
