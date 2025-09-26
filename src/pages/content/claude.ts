import type { AllChats } from "types/claude/AllChats";
import type { ClaudeChat } from "types/claude/Chat";

import { getStats, saveConversations } from "./dataHandler";
import { mapClaudeSampleToConversations } from "database/mappers";

const API_BASE_URL = "https://claude.ai/api";
function apiRequest<T>(
  method: string,
  endpoint: string,
  data: any = null,
  headers: Record<string, string> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(method, `${API_BASE_URL}${endpoint}`);

    // Set headers
    xhr.setRequestHeader("Content-Type", "application/json");
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`API request failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error occurred"));
    };

    // Send the request with data if provided
    xhr.send(data ? JSON.stringify(data) : null);
  });
}

async function getOrganizationId(): Promise<string> {
  const organizations = await apiRequest<any[]>("GET", "/organizations");
  return organizations[0].uuid;
}

// Helper function to fetch chats with offset and limit
async function fetchChats(
  orgId: string,
  limit = 100,
  offset = 0
): Promise<AllChats> {
  return await apiRequest<AllChats>(
    "GET",
    `/organizations/${orgId}/chat_conversations?limit=${limit}&offset=${offset}`
  );
}

// Get all conversations with batching
async function fetchAllChats(orgId: string): Promise<AllChats> {
  const batchSize = 80; // Number of conversations to fetch per batch
  let offset = 0;
  let allChats: AllChats = [];
  let hasMorePages = true;

  console.log("Starting to fetch all Claude chats in batches...");

  while (hasMorePages) {
    try {
      const batchResult = await fetchChats(orgId, batchSize, offset);

      // Check if we got chats in this batch
      if (batchResult && Array.isArray(batchResult) && batchResult.length > 0) {
        allChats = allChats.concat(batchResult);

        // Check if there are more pages based on the response
        // If the batch size is smaller than requested, we've reached the end
        hasMorePages = batchResult.length === batchSize;

        console.log(
          `Fetched batch ${Math.floor(offset / batchSize) + 1}: ${
            batchResult.length
          } chats (Total: ${allChats.length})`
        );

        // Update offset for next batch
        offset += batchSize;
      } else {
        // No more chats
        hasMorePages = false;
        console.log("No more chats found");
      }
    } catch (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error);
      hasMorePages = false;
    }
  }

  console.log(`Successfully fetched all chats: ${allChats.length} total`);
  return allChats;
}

// Get current conversation history
async function fetchChatDetails(
  orgId: string,
  chatId: string
): Promise<ClaudeChat> {
  return await apiRequest<ClaudeChat>(
    "GET",
    `/organizations/${orgId}/chat_conversations/${chatId}`
  );
}

// Get chats in batches until we find a specific chat ID
async function fetchChatsTillMatch(
  orgId: string,
  chatId: string
): Promise<AllChats> {
  const newChats: AllChats = [];
  let offset = 0;
  const batchSize = 100;
  let hasMore = true;

  console.log(`Looking for chat ID: ${chatId}`);

  while (hasMore) {
    try {
      console.log(`Fetching chats at offset ${offset}...`);
      const batch = await fetchChats(orgId, batchSize, offset);

      if (batch && Array.isArray(batch) && batch.length > 0) {
        const matchingIdIndex = batch.findIndex((item) => item.uuid === chatId);
        console.log(`Matching ID index in this batch: ${matchingIdIndex}`);

        if (matchingIdIndex !== -1) {
          // Found the stored chat! Add all chats before it
          newChats.push(...batch.slice(0, matchingIdIndex));
          console.log(
            `Found stored chat at index ${matchingIdIndex}, added ${matchingIdIndex} new chats`
          );
          hasMore = false;
        } else {
          // Haven't found the stored chat yet, add all chats in this batch
          newChats.push(...batch);
          console.log(`Added ${batch.length} chats from this batch`);

          // Check if we should continue
          if (batch.length < batchSize) {
            console.log(
              "Reached end of chats - got fewer items than requested"
            );
            hasMore = false;
          } else {
            offset += batchSize;
          }
        }
      } else {
        console.log("No more chats found");
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error);
      hasMore = false;
    }
  }

  console.log(`Found ${newChats.length} new chats till match`);
  return newChats;
}

/**
 * Fetch and update new conversations for Claude
 * Finds new chats since the last stored chat and updates Chrome storage
 */
async function fetchAndUpdateNewConversations(): Promise<void> {
  try {
    console.log("Starting to fetch and update new Claude conversations...");

    // Get stored data
    const data = await chrome.storage.local.get(["claude"]);
    if (!data.claude) {
      console.log("No stored Claude data found. Running init()");
      await init();
      return;
    }

    const storedChats = data.claude.chats || [];
    const storedChatDetails = data.claude.chatDetails || [];

    // If no stored chats, run init() to fetch all chats
    if (storedChats.length === 0) {
      console.log("No stored chats found. Running init() to fetch all chats");
      await init();
      return;
    }

    // Get organization ID
    const orgId = await getOrganizationId();

    // Get the most recent stored chat ID to find where new chats start
    const mostRecentStoredId = storedChats[0].uuid;
    console.log(
      `Looking for new chats after stored chat: ${mostRecentStoredId}`
    );

    const chatsToFetch = await fetchChatsTillMatch(orgId, mostRecentStoredId);

    // Check if we found any new chats
    if (chatsToFetch.length === 0) {
      console.log("✅ No new chats found. All chats are up to date.");
      return;
    }

    console.log(`Found ${chatsToFetch.length} new chats to fetch details for:`);
    chatsToFetch.forEach((chat) =>
      console.log(`- ${chat.uuid}: ${chat.title}`)
    );

    // Fetch details for all new chats
    const newChatDetails: ClaudeChat[] = [];
    for (let i = 0; i < chatsToFetch.length; i++) {
      const chat = chatsToFetch[i];
      try {
        console.log(
          `Fetching details for new chat ${i + 1}/${chatsToFetch.length}: ${
            chat.uuid
          }`
        );
        const chatDetails = await fetchChatDetails(orgId, chat.uuid);
        newChatDetails.push(chatDetails);
      } catch (error) {
        console.error(`Error fetching details for chat ${chat.uuid}:`, error);
        // Continue with other chats even if one fails
      }
    }

    console.log(
      `Successfully fetched details for ${newChatDetails.length} new chats`
    );

    // Update Chrome storage with new chats
    console.log("Updating Chrome storage with new chats...");
    const updatedData = {
      ...data.claude,
      chats: [...chatsToFetch, ...storedChats],
      chatDetails: [...newChatDetails, ...storedChatDetails],
      lastUpdated: Date.now(),
      totalChats: storedChats.length + chatsToFetch.length,
      totalDetails: storedChatDetails.length + newChatDetails.length,
    };

    await chrome.storage.local.set({ claude: updatedData });

    console.log("✅ Successfully updated Claude data with new chats!");
    console.log(
      `Added ${chatsToFetch.length} new chats and ${newChatDetails.length} chat details`
    );
  } catch (error) {
    console.error("❌ Error during fetch and update new conversations:", error);
    throw error;
  }
}

/**
 * Initialize function to fetch all Claude chats and save to Chrome storage
 * Fetches all chats using fetchAllChats() then fetches individual chat details
 * Finally saves all data to chrome.storage.local
 */
// Function to store chat fetch progress
function storeChatFetchProgress(
  current: number,
  total: number,
  isActive: boolean,
  platform: string
) {
  const progress = {
    current,
    total,
    isActive,
    platform,
    lastUpdated: Date.now(),
  };
  chrome.storage.local.set({ chatFetchProgress: progress });
}

async function init(): Promise<void> {
  try {
    console.log("Starting Claude conversation initialization...");

    // Get organization ID
    const orgId = await getOrganizationId();
    console.log(`Organization ID: ${orgId}`);

    // Step 1: Fetch all chats
    console.log("Fetching all chats...");
    const allChats = await fetchAllChats(orgId);
    console.log(`Total chats found: ${allChats.length}`);

    // Step 2: Fetch individual chat details
    console.log("Fetching individual chat details...");
    const allChatDetails: ClaudeChat[] = [];``
    storeChatFetchProgress(0, allChats.length, true, "claude");

    for (let i = 0; i < allChats.length; i++) {
      const chat = allChats[i];
      try {
        console.log(
          `Fetching details for chat ${i + 1}/${allChats.length}: ${chat.uuid}`
        );
        const chatDetails = await fetchChatDetails(orgId, chat.uuid);
        allChatDetails.push(chatDetails);

        // Update progress
        storeChatFetchProgress(i + 1, allChats.length, true, "claude");
      } catch (error) {
        console.error(`Error fetching details for chat ${chat.uuid}:`, error);
        // Continue with other chats even if one fails
      }
    }

    console.log(
      `Successfully fetched details for ${allChatDetails.length} chats`
    );

    // Step 3: Save to Chrome storage
    console.log("Saving data to Chrome storage...");
    const dataToSave = {
      chats: allChats,
      chatDetails: allChatDetails,
      lastUpdated: Date.now(),
      totalChats: allChats.length,
      totalDetails: allChatDetails.length,
    };

    await chrome.storage.local.set({ claude: dataToSave });

    // Clear fetch progress
    storeChatFetchProgress(0, 0, false, "claude");

    console.log(
      "✅ Claude conversation initialization completed successfully!"
    );
    console.log(
      `Saved ${allChats.length} chats and ${allChatDetails.length} chat details to Chrome storage`
    );
  } catch (error) {
    console.error("❌ Error during Claude conversation initialization:", error);
    // Clear fetch progress on error
    storeChatFetchProgress(0, 0, false, "claude");
    throw error;
  }
}

// init().catch(console.error)

// Initialize Claude data using message handlers
async function initializeClaudeData() {
  try {
    console.log("🚀 Starting Claude data initialization...");

    // Map sample data to conversations
    const data = await chrome.storage.local.get("claude");
    console.log("claudeChats found", data.claude.chatDetails.length);
    console.log("claudeChats found", data.claude.chats);
    const conversations = mapClaudeSampleToConversations(data.claude);
    console.log("conversations", conversations);
    console.log(`Mapped ${conversations.length} conversations`);

    // Save conversations using message handler
    const result = await saveConversations(conversations);
    console.log("✅ Claude data saved successfully:", result.ids.length);

    // Get stats
    const stats = await getStats();
    console.log("📊 Database stats:", stats);
  } catch (error) {
    console.error("❌ Error initializing Claude data:", error);
  }
}
fetchAndUpdateNewConversations().catch(console.error);
// initializeClaudeData().catch(console.error);

// Initialize data when content script loads
// initializeClaudeData().catch(console.error);
