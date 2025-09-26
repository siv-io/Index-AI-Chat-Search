import type {
  ApiConversationItem,
  ApiConversations,
} from "types/chatgpt/AllChats";
import type {
  ApiConversation,
  ApiConversationWithId,
} from "types/chatgpt/Chat";
import type { ApiAccountsCheck, ApiSession } from "types/chatgpt/Session";

console.log("ChatGPT Conversation Logger loaded!");

console.log("ChatGPT Conversation Logger loaded!");

function getPageAccessToken(): string | null {
  return (
    (window as any)?.__remixContext?.state?.loaderData?.root?.clientBootstrap
      ?.session?.accessToken ?? null
  );
}

// function checkIfConversationStarted(): boolean {
//   return !!document.querySelector('[data-testid^="conversation-turn-"]')
// }

function getChatIdFromUrl(): string | null {
  // /share/1e5sf-asdf-1234
  // /c/1e5sf-asdf-1234
  // /g/1e5sf-asdf-1234/c/1e5sf-asdf-1234
  const match = location.pathname.match(
    /^\/(?:share|c|g\/[a-z0-9-]+\/c)\/([a-z0-9-]+)/i
  );
  if (match) return match[1];
  return null;
}

function isSharePage(): boolean {
  return (
    location.pathname.startsWith("/share") &&
    !location.pathname.endsWith("/continue")
  );
}

function getConversationFromSharePage(): ApiConversation | null {
  const nextData = (window as any).__NEXT_DATA__?.props?.pageProps
    ?.serverResponse?.data;
  if (nextData) {
    return JSON.parse(JSON.stringify(nextData));
  }

  const remixData = (window as any).__remixContext?.state?.loaderData?.[
    "routes/share.$shareId.($action)"
  ]?.serverResponse?.data;
  if (remixData) {
    return JSON.parse(JSON.stringify(remixData));
  }

  return null;
}

// Memoization utility
function memorize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, any>();
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// API configuration
const API_MAPPING: Record<string, string> = {
  "https://chat.openai.com": "https://chat.openai.com/backend-api",
  "https://chatgpt.com": "https://chatgpt.com/backend-api",
  "https://new.oaifree.com": "https://new.oaifree.com/backend-api",
};

const baseUrl = new URL(location.href).origin;
const apiUrl = API_MAPPING[baseUrl];

// Session API
const sessionApi = `${baseUrl}/api/auth/session`;

async function _fetchSession(): Promise<ApiSession> {
  const response = await fetch(sessionApi);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}

const fetchSession = memorize(_fetchSession);

async function getAccessToken(): Promise<string> {
  const pageAccessToken = getPageAccessToken();
  if (pageAccessToken) return pageAccessToken;

  const session = await fetchSession();
  return session.accessToken;
}

async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken();
  const accountId = await getTeamAccountId();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Authorization": `Bearer ${accessToken}`,
      ...(accountId ? { "Chatgpt-Account-Id": accountId } : {}),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}

// Team account ID
const accountsCheckApi = `${apiUrl}/accounts/check/v4-2023-04-27`;

async function _fetchAccountsCheck(): Promise<ApiAccountsCheck> {
  const accessToken = await getAccessToken();

  const response = await fetch(accountsCheckApi, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Authorization": `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}

const fetchAccountsCheck = memorize(_fetchAccountsCheck);

function getCookie(key: string): string {
  const match = document.cookie.match(`(^|;)\\s*${key}\\s*=\\s*([^;]+)`);
  return match?.pop() || "";
}

async function getTeamAccountId(): Promise<string | null> {
  try {
    const accountsCheck = await fetchAccountsCheck();
    const workspaceId = getCookie("_account");
    if (workspaceId) {
      const account = accountsCheck.accounts[workspaceId];
      if (account) {
        return account.account.account_id;
      }
    }
  } catch (error) {
    console.warn("Failed to get team account ID:", error);
  }
  return null;
}

// async function getCurrentChatId(): Promise<string> {
//   if (isSharePage()) {
//     const chatId = getChatIdFromUrl()
//     if (!chatId) throw new Error("No chat ID found in share page URL")
//     return `__share__${chatId}`
//   }

//   const chatId = getChatIdFromUrl()
//   if (chatId) return chatId

//   // If no chat ID in URL, try to get the first conversation
//   try {
//     const conversations = await fetchConversations()
//     if (conversations && conversations.items.length > 0) {
//       return conversations.items[0].id
//     }
//   } catch (error) {
//     console.warn("Failed to fetch conversations:", error)
//   }

//   throw new Error("No chat id found.")
// }

async function fetchAllChats(
  offset = 0,
  limit = 20
): Promise<ApiConversations> {
  const url = `${apiUrl}/conversations?offset=${offset}&limit=${limit}`;
  return fetchApi<ApiConversations>(url);
}

async function fetchChatDetails(
  chatId: string,
  shouldReplaceAssets = false
): Promise<ApiConversationWithId> {
  if (chatId.startsWith("__share__")) {
    const id = chatId.replace("__share__", "");
    const shareConversation = getConversationFromSharePage();
    if (!shareConversation) {
      throw new Error("Could not get conversation from share page");
    }
    return {
      id,
      ...shareConversation,
    };
  }

  const url = `${apiUrl}/conversation/${chatId}`;
  const conversation = await fetchApi<ApiConversation>(url);

  return {
    id: chatId,
    ...conversation,
  };
}

/**
 * Initialize function to fetch all conversations and save to Chrome storage
 * Fetches conversations in batches of 80 until no more conversations are found
 * Then fetches individual conversation details for each conversation
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
    console.log("Starting ChatGPT conversation initialization...");

    const allConversations: ApiConversations["items"] = [];
    const allConversationDetails: ApiConversationWithId[] = [];
    let offset = 0;
    const batchSize = 80;
    let hasMoreConversations = true;

    // Step 1: Fetch conversations in batches
    console.log("Fetching conversations in batches...");

    while (hasMoreConversations) {
      try {
        console.log(`Fetching batch starting at offset ${offset}...`);
        const batch = await fetchAllChats(offset, batchSize);

        if (batch.items && batch.items.length > 0) {
          allConversations.push(...batch.items);

          console.log(
            `Fetched ${batch.items.length} conversations in this batch (total: ${allConversations.length})`
          );

          // Update progress
          storeChatFetchProgress(
            allConversations.length,
            batch.total || allConversations.length,
            true,
            "chatgpt"
          );

          // Check if we have more conversations to fetch
          if (batch.total !== null && offset + batchSize >= batch.total) {
            hasMoreConversations = false;
          } else if (batch.items.length < batchSize) {
            hasMoreConversations = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMoreConversations = false;
        }
      } catch (error) {
        console.error(`Error fetching batch at offset ${offset}:`, error);
        hasMoreConversations = false;
      }
    }

    console.log(`Total conversations found: ${allConversations.length}`);

    // Step 2: Fetch individual conversation details
    console.log("Fetching individual conversation details...");
    storeChatFetchProgress(0, allConversations.length, true, "chatgpt");

    for (let i = 0; i < allConversations.length; i++) {
      const conversation = allConversations[i];
      try {
        console.log(
          `Fetching details for conversation ${i + 1}/${
            allConversations.length
          }: ${conversation.id}`
        );
        const chatDetails = await fetchChatDetails(conversation.id);
        allConversationDetails.push(chatDetails);

        // Update progress
        storeChatFetchProgress(i + 1, allConversations.length, true, "chatgpt");
      } catch (error) {
        console.error(
          `Error fetching details for conversation ${conversation.id}:`,
          error
        );
        // Continue with other conversations even if one fails
      }
    }

    console.log(
      `Successfully fetched details for ${allConversationDetails.length} conversations`
    );

    // Step 3: Save to Chrome storage
    console.log("Saving data to Chrome storage...");
    const dataToSave = {
      conversations: allConversations,
      chatDetails: allConversationDetails,
      lastUpdated: Date.now(),
      totalConversations: allConversations.length,
      totalDetails: allConversationDetails.length,
    };

    await chrome.storage.local.set({ chatgpt: dataToSave });

    // Clear fetch progress
    storeChatFetchProgress(0, 0, false, "chatgpt");

    console.log(
      "✅ ChatGPT conversation initialization completed successfully!"
    );
    console.log(
      `Saved ${allConversations.length} conversations and ${allConversationDetails.length} conversation details to Chrome storage`
    );
  } catch (error) {
    console.error(
      "❌ Error during ChatGPT conversation initialization:",
      error
    );
    // Clear fetch progress on error
    storeChatFetchProgress(0, 0, false, "chatgpt");
    throw error;
  }
}

async function fetchChatsTillMatch(
  conversationId: string
): Promise<ApiConversationItem[]> {
  const newConversations: ApiConversationItem[] = [];
  let offset = 0;
  const batchSize = 30;
  let hasMore = true;

  console.log(`Looking for conversation ID: ${conversationId}`);

  while (hasMore) {
    try {
      console.log(`Fetching conversations at offset ${offset}...`);
      const batch = await fetchAllChats(offset, batchSize);

      if (batch.items && batch.items.length > 0) {
        const matchingIdIndex = batch.items.findIndex(
          (item) => item.id === conversationId
        );
        console.log(`Matching ID index in this batch: ${matchingIdIndex}`);

        if (matchingIdIndex !== -1) {
          // Found the stored conversation! Add all conversations before it
          newConversations.push(...batch.items.slice(0, matchingIdIndex));
          console.log(
            `Found stored conversation at index ${matchingIdIndex}, added ${matchingIdIndex} new conversations`
          );
          hasMore = false;
        } else {
          // Haven't found the stored conversation yet, add all conversations in this batch
          newConversations.push(...batch.items);
          console.log(
            `Added ${batch.items.length} conversations from this batch`
          );

          // Check if we should continue
          if (batch.items.length < batchSize) {
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

async function fetchAndUpdateNewConversations(): Promise<void> {
  try {
    console.log("Starting to fetch and update new conversations...");

    // Get stored data
    const data = await chrome.storage.local.get(["chatgpt"]);
    if (!data.chatgpt) {
      console.log("No stored ChatGPT data found. Running init()");
      init();
      return;
    }

    const storedConversations = data.chatgpt.conversations || [];
    const storedConversationDetails = data.chatgpt.chatDetails || [];

    // Check if we have any stored conversations
    if (storedConversations.length === 0) {
      console.log("No stored conversations found. Run init() first.");
      await init();
    }

    // Get the most recent stored conversation ID to find where new conversations start
    const mostRecentStoredId = storedConversations[0].id;
    console.log(
      `Looking for new conversations after stored conversation: ${mostRecentStoredId}`
    );

    const conversationsToFetch = await fetchChatsTillMatch(mostRecentStoredId);

    // Check if we found any new conversations
    if (conversationsToFetch.length === 0) {
      console.log(
        "✅ No new conversations found. All conversations are up to date."
      );
      return;
    }

    console.log(
      `Found ${conversationsToFetch.length} new conversations to fetch details for:`
    );
    conversationsToFetch.forEach((conv) =>
      console.log(`- ${conv.id}: ${conv.title}`)
    );

    // Fetch details for all new conversations
    const newConversationDetails: ApiConversationWithId[] = [];
    for (let i = 0; i < conversationsToFetch.length; i++) {
      const conversation = conversationsToFetch[i];
      try {
        console.log(
          `Fetching details for new conversation ${i + 1}/${
            conversationsToFetch.length
          }: ${conversation.id}`
        );
        const conversationDetails = await fetchChatDetails(conversation.id);
        newConversationDetails.push(conversationDetails);
      } catch (error) {
        console.error(
          `Error fetching details for conversation ${conversation.id}:`,
          error
        );
        // Continue with other conversations even if one fails
      }
    }

    console.log(
      `Successfully fetched details for ${newConversationDetails.length} new conversations`
    );

    // Update Chrome storage with new conversations
    console.log("Updating Chrome storage with new conversations...");
    const updatedData = {
      ...data.chatgpt,
      conversations: [...conversationsToFetch, ...storedConversations],
      chatDetails: [...newConversationDetails, ...storedConversationDetails],
      lastUpdated: Date.now(),
      totalConversations:
        storedConversations.length + conversationsToFetch.length,
      totalDetails:
        storedConversationDetails.length + newConversationDetails.length,
    };

    await chrome.storage.local.set({ chatgpt: updatedData });

    console.log("✅ Successfully updated ChatGPT data with new conversations!");
    console.log(
      `Added ${conversationsToFetch.length} new conversations and ${newConversationDetails.length} conversation details`
    );
  } catch (error) {
    console.error("❌ Error during fetch and update new conversations:", error);
    throw error;
  }
}

fetchAndUpdateNewConversations().catch(console.error);
