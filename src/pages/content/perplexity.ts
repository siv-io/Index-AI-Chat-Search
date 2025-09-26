import type { AllPerplexityChats } from "types/perplexity/AllChats";
import type { PerplexityChat } from "types/perplexity/Chat";

import { getStats, saveConversations } from "./dataHandler";
import { mapPerplexitySampleToConversations } from "database/mappers";

console.log("Perplexity Conversation Logger loaded!");

const API_BASE_URL = "https://www.perplexity.ai/rest";

// Generic API request function
function apiRequest<T>(
  endpoint: string,
  method: string = "GET",
  data: any = null,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Build URL with query parameters
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    xhr.open(method, url.toString());

    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (error) {
          resolve(xhr.responseText as T);
        }
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

// Get conversation history by chat ID
async function fetchChatDetails(chatId: string): Promise<PerplexityChat> {
  const queryParams = {
    with_parent_info: "true",
    with_schematized_response: "true",
    version: "2.18",
    source: "default",
    limit: "10",
    offset: "0",
    from_first: "true",
    supported_block_use_cases: [
      "answer_modes",
      "media_items",
      "knowledge_cards",
      "inline_entity_cards",
      "place_widgets",
      "finance_widgets",
      "sports_widgets",
      "shopping_widgets",
      "jobs_widgets",
      "search_result_widgets",
      "clarification_responses",
      "inline_images",
      "inline_assets",
      "inline_finance_widgets",
      "placeholder_cards",
      "diff_blocks",
      "inline_knowledge_cards",
      "entity_group_v2",
      "refinement_filters",
      "canvas_mode",
    ].join(","),
  };

  return await apiRequest<PerplexityChat>(
    `/thread/${chatId}`,
    "GET",
    null,
    {},
    queryParams
  );
}

// Helper function to fetch chats with offset and limit
async function fetchChats(
  offset = 0,
  limit = 100
): Promise<AllPerplexityChats> {
  const queryParams = {
    version: "2.18",
    source: "default",
  };

  const requestData = {
    limit: limit,
    ascending: false,
    offset: offset,
    search_term: "",
  };

  return await apiRequest<AllPerplexityChats>(
    "/thread/list_ask_threads",
    "POST",
    requestData,
    { "Content-Type": "application/json" },
    queryParams
  );
}

// Get all conversations with batching
async function fetchAllChats(): Promise<AllPerplexityChats> {
  const batchSize = 80; // Number of conversations to fetch per batch
  let offset = 0;
  let allConversations: AllPerplexityChats = [];
  let hasMorePages = true;

  console.log("Starting to fetch all conversations in batches...");

  while (hasMorePages) {
    try {
      const batchResult = await fetchChats(offset, batchSize);

      // Check if we got conversations in this batch
      if (batchResult && Array.isArray(batchResult) && batchResult.length > 0) {
        allConversations = allConversations.concat(batchResult);

        // Check if there are more pages based on the response
        // If the batch size is smaller than requested, we've reached the end
        hasMorePages = batchResult.length === batchSize;

        console.log(
          `Fetched batch ${Math.floor(offset / batchSize) + 1}: ${
            batchResult.length
          } conversations (Total: ${allConversations.length})`
        );
        console.log("batchResult", batchResult);

        // Update offset for next batch
        offset += batchSize;
      } else {
        // No more conversations
        hasMorePages = false;
        console.log("No more conversations found");
      }
    } catch (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error);
      hasMorePages = false;
    }
  }

  console.log(
    `Successfully fetched all conversations: ${allConversations.length} total`
  );
  return allConversations;
}

// Get conversations in batches until we find a specific chat ID
async function fetchChatsTillMatch(
  chatId: string
): Promise<AllPerplexityChats> {
  const newConversations: AllPerplexityChats = [];
  let offset = 0;
  const batchSize = 30;
  let hasMore = true;

  console.log(`Looking for chat ID: ${chatId}`);

  while (hasMore) {
    try {
      console.log(`Fetching conversations at offset ${offset}...`);
      const batch = await fetchChats(offset, batchSize);

      if (batch && Array.isArray(batch) && batch.length > 0) {
        const matchingIdIndex = batch.findIndex((item) => item.uuid === chatId);
        console.log(`Matching ID index in this batch: ${matchingIdIndex}`);

        if (matchingIdIndex !== -1) {
          // Found the stored chat! Add all chats before it
          newConversations.push(...batch.slice(0, matchingIdIndex));
          console.log(
            `Found stored chat at index ${matchingIdIndex}, added ${matchingIdIndex} new chats`
          );
          hasMore = false;
        } else {
          // Haven't found the stored chat yet, add all chats in this batch
          newConversations.push(...batch);
          console.log(`Added ${batch.length} chats from this batch`);

          // Check if we should continue
          if (batch.length < batchSize) {
            console.log(
              "Reached end of conversations - got fewer items than requested"
            );
            hasMore = false;
          } else {
            offset += batchSize;
          }
        }
      } else {
        console.log("No more conversations found");
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error);
      hasMore = false;
    }
  }

  console.log(`Found ${newConversations.length} new conversations till match`);
  return newConversations;
}

/**
 * Fetch and update new conversations for Perplexity
 * Finds new chats since the last stored chat and updates Chrome storage
 */
async function fetchAndUpdateNewConversations(): Promise<void> {
  try {
    console.log("Starting to fetch and update new Perplexity conversations...");

    // Get stored data
    const data = await chrome.storage.local.get(["perplexity"]);
    if (!data.perplexity) {
      console.log("No stored Perplexity data found. Running init()");
      await init();
      return;
    }

    const storedChats = data.perplexity.chats || [];
    const storedChatDetails = data.perplexity.chatDetails || [];

    // If no stored chats, run init() to fetch all chats
    if (storedChats.length === 0) {
      console.log("No stored chats found. Running init() to fetch all chats");
      await init();
      return;
    }

    // Get the most recent stored chat ID to find where new chats start
    const mostRecentStoredId = storedChats[0].uuid;
    console.log(
      `Looking for new chats after stored chat: ${mostRecentStoredId}`
    );

    const chatsToFetch = await fetchChatsTillMatch(mostRecentStoredId);

    console.log(`Found ${chatsToFetch.length} new chats to fetch details for:`);
    chatsToFetch.forEach((chat) =>
      console.log(`- ${chat.uuid}: ${chat.title}`)
    );

    // Fetch details for all new chats
    const newChatDetails: PerplexityChat[] = [];
    for (let i = 0; i < chatsToFetch.length; i++) {
      const chat = chatsToFetch[i];
      try {
        console.log(
          `Fetching details for new chat ${i + 1}/${chatsToFetch.length}: ${
            chat.uuid
          }`
        );
        const chatDetails = await fetchChatDetails(chat.slug);
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

    // TODO - this is unefficient since we're making a new array of large size - 30-50MB each time when storing
    const updatedData = {
      ...data.perplexity,
      chats: [...chatsToFetch, ...storedChats],
      chatDetails: [...newChatDetails, ...storedChatDetails],
      lastUpdated: Date.now(),
      totalChats: storedChats.length + chatsToFetch.length,
      totalDetails: storedChatDetails.length + newChatDetails.length,
    };

    await chrome.storage.local.set({ perplexity: updatedData });

    console.log("✅ Successfully updated Perplexity data with new chats!");
    console.log(
      `Added ${chatsToFetch.length} new chats and ${newChatDetails.length} chat details`
    );
  } catch (error) {
    console.error("❌ Error during fetch and update new conversations:", error);
    throw error;
  }
}

/**
 * Initialize function to fetch all Perplexity chats and save to Chrome local storage
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
    console.log("Starting Perplexity conversation initialization...");

    // Step 1: Fetch all chats
    console.log("Fetching all chats...");
    const allChats = await fetchAllChats();
    console.log(`Total chats found: ${allChats.length}`);

    // Step 2: Fetch individual chat details
    console.log("Fetching individual chat details...");
    const allChatDetails: PerplexityChat[] = [];
    storeChatFetchProgress(0, allChats.length, true, "perplexity");

    for (let i = 0; i < allChats.length; i++) {
      const chat = allChats[i];
      try {
        console.log(
          `Fetching details for chat ${i + 1}/${allChats.length}: ${chat.uuid}`
        );
        const chatDetails = await fetchChatDetails(chat.slug);
        allChatDetails.push(chatDetails);

        // Update progress
        storeChatFetchProgress(i + 1, allChats.length, true, "perplexity");
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

    await chrome.storage.local.set({
      perplexity: {
        chats: allChats,
        chatDetails: allChatDetails,
        lastUpdated: Date.now(),
        totalChats: allChats.length,
        totalDetails: allChatDetails.length,
      },
    });

    // Clear fetch progress
    storeChatFetchProgress(0, 0, false, "perplexity");

    console.log(
      "✅ Perplexity conversation initialization completed successfully!"
    );
    console.log(
      `Saved ${allChats.length} chats and ${allChatDetails.length} chat details to Chrome storage`
    );
  } catch (error) {
    console.error(
      "❌ Error during Perplexity conversation initialization:",
      error
    );
    // Clear fetch progress on error
    storeChatFetchProgress(0, 0, false, "perplexity");
    throw error;
  }
}

// Initialize Perplexity data using message handlers
async function initializePerplexityData() {
  try {
    console.log("🚀 Starting Perplexity data initialization...");

    // Map sample data to conversations
    const data = await chrome.storage.local.get("perplexity");
    const conversations = mapPerplexitySampleToConversations(data.perplexity);
    console.log("conversations", conversations);
    console.log(`Mapped ${conversations.length} conversations`);

    // Save conversations using message handler
    const result = await saveConversations(conversations);
    console.log("✅ Perplexity data saved successfully:", result.ids.length);

    // Get stats
    const stats = await getStats();
    console.log("📊 Database stats:", stats);
  } catch (error) {
    console.error("❌ Error initializing Perplexity data:", error);
  }
}
// initializePerplexityData().catch(console.error);
fetchAndUpdateNewConversations().catch(console.error);
