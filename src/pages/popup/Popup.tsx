import { useState, useEffect } from "react";
import "public/contentStyle.css";
import {
  searchConversations,
  searchPrompts,
  searchPromptsDev,
  syncDatabase,
} from "../content/dataHandler";
import type {
  SearchResponse,
  SearchResult,
} from "../background/messages/search-prompts";
import { FilterButtons, type FilterOptions } from "./FilterButtons";
import { RefreshCw, ExternalLink } from "lucide-react";

// Function to generate platform-specific URLs
function getLinkFromMessage(message: SearchResult["message"]): string {
  switch (message.platform) {
    case "claude":
      return `https://claude.ai/chat/${message.chatId}`;
    case "perplexity":
      return `https://www.perplexity.ai/search/${
        message.slug || message.chatId
      }`;
    case "chatgpt":
      // ChatGPT doesn't have a direct chat URL pattern, return a placeholder
      return `https://chat.openai.com/`;
    default:
      return "#";
  }
}

// Function to calculate relative date
function getRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffInMs = now - timestamp;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return "today";
  } else if (diffInDays === 1) {
    return "1 day ago";
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  } else {
    const years = Math.floor(diffInDays / 365);
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
}

// Function to truncate text to approximately 50 lines
function truncateText(
  text: string | undefined,
  maxLines: number = 50
): { truncated: string; isTruncated: boolean } {
  // Handle undefined or null text
  if (!text) {
    return { truncated: "", isTruncated: false };
  }

  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return { truncated: text, isTruncated: false };
  }

  const truncatedLines = lines.slice(0, maxLines);
  return {
    truncated: truncatedLines.join("\n"),
    isTruncated: true,
  };
}

// Function to toggle expanded state
function toggleExpanded(
  index: number,
  expandedResults: Set<number>,
  setExpandedResults: React.Dispatch<React.SetStateAction<Set<number>>>
) {
  const newExpanded = new Set(expandedResults);
  if (newExpanded.has(index)) {
    newExpanded.delete(index);
  } else {
    newExpanded.add(index);
  }
  setExpandedResults(newExpanded);
}

function IndexPopup() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: "last30days",
  });
  const [embeddingProgress, setEmbeddingProgress] = useState({
    currentBatch: 0,
    totalBatches: 0,
    isActive: false,
  });
  const [chatFetchProgress, setChatFetchProgress] = useState({
    current: 0,
    total: 0,
    isActive: false,
    platform: "",
  });
  const [expandedResults, setExpandedResults] = useState<Set<number>>(
    new Set()
  );

  // Listen for storage changes for progress updates
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace === "local") {
        if (changes.embeddingProgress) {
          const progress = changes.embeddingProgress.newValue;
          if (progress) {
            setEmbeddingProgress({
              currentBatch: progress.currentBatch || 0,
              totalBatches: progress.totalBatches || 0,
              isActive: progress.isActive || false,
            });
          }
        }
        if (changes.chatFetchProgress) {
          const progress = changes.chatFetchProgress.newValue;
          if (progress) {
            setChatFetchProgress({
              current: progress.current || 0,
              total: progress.total || 0,
              isActive: progress.isActive || false,
              platform: progress.platform || "",
            });
          }
        }
      }
    };

    // Get initial progress state
    chrome.storage.local.get(
      ["embeddingProgress", "chatFetchProgress"],
      (result) => {
        if (result.embeddingProgress) {
          const progress = result.embeddingProgress;
          setEmbeddingProgress({
            currentBatch: progress.currentBatch || 0,
            totalBatches: progress.totalBatches || 0,
            isActive: progress.isActive || false,
          });
        }
        if (result.chatFetchProgress) {
          const progress = result.chatFetchProgress;
          setChatFetchProgress({
            current: progress.current || 0,
            total: progress.total || 0,
            isActive: progress.isActive || false,
            platform: progress.platform || "",
          });
        }
      }
    );

    // Add storage change listener
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Cleanup listener on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Message listener (kept for service worker communication but not used for progress)
  useEffect(() => {
    const handleMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      console.log("📨 Message received in popup:", message);
      // Messages are sent to keep service worker alive, but progress comes from storage
    };

    // Add message listener
    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleSearch = async () => {
    console.log("🔍 Handling search", query);
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchTime(null);

    // Start timing
    const startTime = performance.now();
    const searchQuery = query.trim();

    try {
      // Use dev search for debugging
      const response = (await searchPrompts(searchQuery, {
        topK: 20,
        threshold: 0.1,
        filters: filters,
      })) as SearchResponse;
      console.log("🔍 Search response:", response);
      // End timing
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      if (response.error) {
        setError(response.error);
        setResults([]);
        setSearchTime(totalTime);
        setLastSearchQuery(searchQuery);
      } else {
        setResults(response.results);
        setError(null);
        setSearchTime(totalTime);
        setLastSearchQuery(searchQuery);
      }

      // Log detailed timing info to console
      console.log(`🕐 Search Performance for "${searchQuery}":`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Results found: ${response.results?.length || 0}`);
      console.log(`  Threshold used: ${response.threshold}`);
    } catch (err) {
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      setError("Failed to search prompts. Please try again.");
      setResults([]);
      setSearchTime(totalTime);
      setLastSearchQuery(searchQuery);
      console.error("Search error:", err);
      console.log(`🕐 Search failed after: ${totalTime.toFixed(2)}ms`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // if (e.key === "Enter") {
    //   handleSearch();
    // }
  };

  const handleSync = async () => {
    console.log("🔄 Starting database sync...");
    setIsSyncing(true);
    setSyncMessage(null);
    setError(null);

    try {
      const response = await syncDatabase();

      if (response.success) {
        setSyncMessage(response.message || "Database synced successfully!");
        console.log("✅ Sync successful:", response);
      } else {
        setError(response.error || "Sync failed");
        console.error("❌ Sync failed:", response.error);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(`Sync failed: ${errorMessage}`);
      console.error("❌ Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Show full-screen loading during chat fetching or embedding generation
  if (chatFetchProgress.isActive || embeddingProgress.isActive) {
    const isFetching = chatFetchProgress.isActive;
    const current = isFetching
      ? chatFetchProgress.current
      : embeddingProgress.currentBatch;
    const total = isFetching
      ? chatFetchProgress.total
      : embeddingProgress.totalBatches;
    const progressText = isFetching
      ? `FETCHING ${chatFetchProgress.platform.toUpperCase()} CHATS`
      : "GENERATING VECTOR EMBEDDINGS";

    return (
      <div
        className="w-[420px] h-full bg-white border-4 border-black relative flex flex-col items-center justify-center p-6"
        style={{
          fontFamily: 'monospace, "Courier New", monospace',
        }}
      >
        {/* Progress Bar */}
        <div
          className="w-full max-w-sm p-4 bg-red-100 border-2 border-black"
          style={{
            fontFamily: 'monospace, "Courier New", monospace',
            boxShadow: "4px 4px 0px #000000",
          }}
        >
          <div className="text-sm font-bold text-black mb-3 uppercase tracking-wider">
            {progressText}: {current}/{total}
          </div>
          <div className="w-full bg-white border-2 border-black h-6">
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{
                width: `${total > 0 ? (current / total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        {/* Main Message */}
        <div
          className="text-center p-4 bg-yellow-100 border-2 border-black"
          style={{
            fontFamily: 'monospace, "Courier New", monospace',
            boxShadow: "4px 4px 0px #000000",
          }}
        >
          <div className="text-sm font-bold text-black uppercase">
            [ THIS STEP TAKES TIME, YOU CAN KEEP WORKING BUT PLEASE KEEP CHROME
            OPEN ]
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-[400px] h-full p-6 bg-white border-4 border-black relative"
      style={{
        fontFamily: 'monospace, "Courier New", monospace',
      }}
    >
      {/* Sync Icon - Top Right */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="absolute top-4 right-4 w-8 h-8 text-black border-2 border-black hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:cursor-not-allowed flex items-center justify-center"
        style={{
          fontFamily: 'monospace, "Courier New", monospace',
          boxShadow: "3px 3px 0px #000000",
          transition: "all 0.1s ease",
        }}
        title={isSyncing ? "Syncing..." : "Sync Database"}
      >
        <RefreshCw
          size={16}
          strokeWidth={3}
          className={isSyncing ? "animate-spin" : ""}
        />
      </button>

      <div className="mb-6">
        <h1
          className="text-xl font-bold text-black mb-4 uppercase tracking-wider"
          style={{ fontFamily: 'monospace, "Courier New", monospace' }}
        >
          [ PROMPT SEARCH ]
        </h1>

        {/* Performance Timing Display */}
        {searchTime !== null && lastSearchQuery && (
          <div
            className="mb-4 p-3 bg-yellow-100 border-2 border-black"
            style={{
              fontFamily: 'monospace, "Courier New", monospace',
              boxShadow: "4px 4px 0px #000000",
            }}
          >
            <div className="text-xs font-bold text-black mt-1 uppercase">
              QUERY: "{lastSearchQuery.toUpperCase()}"
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <FilterButtons filters={filters} onFiltersChange={setFilters} />

        <div className="mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="SEARCH FOR PROMPTS..."
            className="w-full px-4 py-6 border-2 border-black bg-white text-black font-bold uppercase tracking-wider focus:outline-none focus:bg-yellow-100 mb-3"
            style={{
              fontFamily: 'monospace, "Courier New", monospace',
              boxShadow: "4px 4px 0px #000000",
              fontSize: "16px",
              resize: "vertical",
              minHeight: "60px",
            }}
            disabled={isLoading}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="w-full px-6 py-3 bg-red-500 text-white font-bold uppercase tracking-wider border-2 border-black hover:bg-red-600 hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:bg-gray-400 disabled:cursor-not-allowed"
            style={{
              fontFamily: 'monospace, "Courier New", monospace',
              boxShadow: "4px 4px 0px #000000",
              transition: "all 0.1s ease",
              fontSize: "16px",
            }}
          >
            {isLoading ? "..." : "[ SEARCH ]"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 p-4 bg-red-100 border-2 border-black"
          style={{
            fontFamily: 'monospace, "Courier New", monospace',
            boxShadow: "4px 4px 0px #000000",
          }}
        >
          <div className="font-bold text-black uppercase tracking-wider">
            [ ERROR ]
          </div>
          <div className="text-sm font-bold text-black mt-1">
            {error.toUpperCase()}
          </div>
        </div>
      )}

      {syncMessage && (
        <div
          className="mb-4 p-4 bg-green-100 border-2 border-black"
          style={{
            fontFamily: 'monospace, "Courier New", monospace',
            boxShadow: "4px 4px 0px #000000",
          }}
        >
          <div className="font-bold text-black uppercase tracking-wider">
            [ SUCCESS ]
          </div>
          <div className="text-sm font-bold text-black mt-1">
            {syncMessage.toUpperCase()}
          </div>
        </div>
      )}

      <div className="flex-1">
        {results && results.length > 0 && (
          <div
            className="mb-3 text-sm font-bold text-black flex justify-between items-center uppercase tracking-wider"
            style={{ fontFamily: 'monospace, "Courier New", monospace' }}
          >
            <span>FOUND {results.length} RESULTS</span>
            {searchTime !== null && (
              <span
                className="text-xs font-bold bg-green-500 text-white px-2 py-1 border border-black"
                style={{
                  fontFamily: 'monospace, "Courier New", monospace',
                  boxShadow: "2px 2px 0px #000000",
                }}
              >
                {searchTime < 100 ? "🚀" : searchTime < 500 ? "⚡" : "⏱️"}{" "}
                {searchTime.toFixed(0)}MS
              </span>
            )}
          </div>
        )}

        {results &&
          !!results.length &&
          results.map((result, index) => {
            const link = getLinkFromMessage(result.message);
            const relativeDate = getRelativeDate(result.message.timestamp);
            const isExpanded = expandedResults.has(index);
            const { truncated: displayText, isTruncated } = truncateText(
              result.message.content
            );
            const shouldShowReadMore = isTruncated && !isExpanded;

            return (
              <div
                key={index}
                className="p-4 mb-3 bg-yellow-50 border-2 border-black hover:bg-yellow-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                style={{
                  fontFamily: 'monospace, "Courier New", monospace',
                  boxShadow: "4px 4px 0px #000000",
                  transition: "all 0.1s ease",
                }}
              >
                {/* Chat Title */}
                {result.message.title && (
                  <div
                    className="text-xs text-gray-300 mb-2"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      fontWeight: "normal",
                    }}
                  >
                    {result.message.title.toUpperCase()}
                  </div>
                )}

                {/* Prompt Content */}
                <div
                  className="text-sm font-bold text-black leading-relaxed mb-3"
                  style={{
                    fontFamily: 'monospace, "Courier New", monospace',
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {isExpanded
                    ? (result.message.content || "").toUpperCase()
                    : displayText.toUpperCase()}
                </div>

                {/* Read More Button */}
                {shouldShowReadMore && (
                  <button
                    onClick={() =>
                      toggleExpanded(index, expandedResults, setExpandedResults)
                    }
                    className="text-xs text-blue-600 underline hover:text-blue-800 mb-3 cursor-pointer"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      fontWeight: "normal",
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      padding: 0,
                    }}
                  >
                    read more
                  </button>
                )}

                {/* Show Less Button */}
                {isExpanded && isTruncated && (
                  <button
                    onClick={() =>
                      toggleExpanded(index, expandedResults, setExpandedResults)
                    }
                    className="text-xs text-blue-600 underline hover:text-blue-800 mb-3 cursor-pointer"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      fontWeight: "normal",
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      padding: 0,
                    }}
                  >
                    show less
                  </button>
                )}

                <div className="flex flex-wrap gap-2 items-center">
                  <div
                    className="text-xs font-bold bg-red-500 text-white px-2 py-1 border border-black"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      boxShadow: "2px 2px 0px #000000",
                    }}
                  >
                    SIMILARITY: {(result.similarity * 100).toFixed(1)}%
                  </div>

                  <div
                    className="text-xs font-bold bg-blue-500 text-white px-2 py-1 border border-black"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      boxShadow: "2px 2px 0px #000000",
                    }}
                  >
                    {result.message.platform.toUpperCase()}
                  </div>

                  <div
                    className="text-xs font-bold bg-green-500 text-white px-2 py-1 border border-black"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      boxShadow: "2px 2px 0px #000000",
                    }}
                  >
                    {relativeDate.toUpperCase()}
                  </div>

                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500 text-white px-2 py-1 border border-black hover:bg-purple-600 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      boxShadow: "2px 2px 0px #000000",
                      transition: "all 0.1s ease",
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={12} />
                    OPEN
                  </a>
                </div>
              </div>
            );
          })}

        {!isLoading && (
          <div
            className="text-center text-black py-8 font-bold uppercase tracking-wider"
            style={{ fontFamily: 'monospace, "Courier New", monospace' }}
          >
            {query
              ? `[ SEARCHING FOR: "${query.toUpperCase()}" ]`
              : "[ ENTER SEARCH QUERY ]"}
            <br />
            {/* <span className="text-sm bg-blue-500 text-white px-2 py-1 mt-2 inline-block border border-black">
              TO FIND PROMPTS
            </span> */}
          </div>
        )}
      </div>
    </div>
  );
}

export default IndexPopup;
