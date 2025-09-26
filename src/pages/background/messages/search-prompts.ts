import { getEmbeddingsFromHuggingFace } from "../index";
import { databaseService } from "database/service";
import type { ChatMessage } from "database/schema";

export interface PromptEmbedding {
  prompt: string;
  embedding: Float32Array;
  message: ChatMessage;
}

export interface SearchResult {
  embedding: Float32Array;
  index: number;
  similarity: number;
  message: ChatMessage;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalFound: number;
  threshold: number;
  error?: string;
}

// Cache for embeddings to avoid repeated storage reads
let embeddingsCache: PromptEmbedding[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple LRU cache for query results
interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  topK: number;
  threshold: number;
}

const queryCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 50;
const QUERY_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Simple spatial hashing for approximate nearest neighbor search
interface HashBucket {
  indices: number[];
  centroid?: Float32Array;
}

let spatialHashMap: Map<string, HashBucket> | null = null;
const HASH_GRID_SIZE = 0.2; // Increased for better recall
let hashMapEmbeddingsLength = 0; // Track if we need to rebuild the hash map

// Debug flag - set to true to disable optimizations and use original search
const DEBUG_MODE = true;

// Optimized dot product similarity calculation with SIMD-friendly operations
function dotProductSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

// Build spatial hash index for faster approximate search
function buildSpatialHashIndex(
  embeddings: PromptEmbedding[]
): Map<string, HashBucket> {
  const hashMap = new Map<string, HashBucket>();

  for (let i = 0; i < embeddings.length; i++) {
    const embedding = embeddings[i].embedding;

    // Create hash key based on quantized embedding values
    // Use only first few dimensions for hashing to balance speed vs accuracy
    const hashDims = Math.min(16, embedding.length);
    const hashKey = Array.from(embedding.slice(0, hashDims))
      .map((val) => Math.floor(val / HASH_GRID_SIZE) * HASH_GRID_SIZE)
      .join(",");

    if (!hashMap.has(hashKey)) {
      hashMap.set(hashKey, { indices: [] });
    }

    hashMap.get(hashKey)!.indices.push(i);
  }

  return hashMap;
}

// Get candidate indices using spatial hashing
function getCandidateIndices(
  queryEmbedding: Float32Array,
  hashMap: Map<string, HashBucket>,
  maxCandidates: number = 2000
): number[] {
  const hashDims = Math.min(16, queryEmbedding.length);
  const baseHashKey = Array.from(queryEmbedding.slice(0, hashDims))
    .map((val) => Math.floor(val / HASH_GRID_SIZE) * HASH_GRID_SIZE)
    .join(",");

  const candidates = new Set<number>();

  // Check exact hash bucket
  const exactBucket = hashMap.get(baseHashKey);
  if (exactBucket) {
    exactBucket.indices.forEach((idx) => candidates.add(idx));
  }

  // Check neighboring buckets if we need more candidates
  if (candidates.size < maxCandidates) {
    const baseCoords = baseHashKey.split(",").map(Number);

    // Check 3^n neighboring buckets (limited to avoid explosion)
    for (
      let offset = -HASH_GRID_SIZE;
      offset <= HASH_GRID_SIZE && candidates.size < maxCandidates;
      offset += HASH_GRID_SIZE
    ) {
      for (
        let dim = 0;
        dim < Math.min(4, hashDims) && candidates.size < maxCandidates;
        dim++
      ) {
        const neighborCoords = [...baseCoords];
        neighborCoords[dim] += offset;
        const neighborKey = neighborCoords.join(",");

        const neighborBucket = hashMap.get(neighborKey);
        if (neighborBucket) {
          neighborBucket.indices.forEach((idx) => {
            if (candidates.size < maxCandidates) {
              candidates.add(idx);
            }
          });
        }
      }
    }
  }

  return Array.from(candidates);
}

// Optimized similarity search with spatial hashing and early termination
async function performSimilaritySearch(
  query: string,
  embeddings: PromptEmbedding[],
  topK: number = 10,
  threshold: number = 0.1
): Promise<SearchResult[]> {
  const searchStartTime = performance.now();

  try {
    // Generate embedding for the query
    const embeddingStartTime = performance.now();
    const queryEmbeddings = await getEmbeddingsFromHuggingFace(query);
    const queryEmbedding = queryEmbeddings[0];
    const embeddingEndTime = performance.now();

    // Query embedding is already normalized by Xenova extractor with normalize: true
    const normalizedQueryEmbedding = new Float32Array(queryEmbedding);
    console.log("🔍 normalizedQueryEmbedding", normalizedQueryEmbedding);

    console.log(
      `🔍 Embedding generation: ${(
        embeddingEndTime - embeddingStartTime
      ).toFixed(2)}ms`
    );

    // Build or use cached spatial hash index for large datasets
    const indexingStartTime = performance.now();
    let candidateIndices: number[];
    const useSpatialHashing = !DEBUG_MODE && embeddings.length > 2000; // Increased threshold for spatial hashing

    if (useSpatialHashing) {
      // Rebuild hash map if embeddings changed
      if (!spatialHashMap || hashMapEmbeddingsLength !== embeddings.length) {
        console.log("Building spatial hash index...");
        spatialHashMap = buildSpatialHashIndex(embeddings);
        hashMapEmbeddingsLength = embeddings.length;
      }

      candidateIndices = getCandidateIndices(
        normalizedQueryEmbedding,
        spatialHashMap,
        Math.max(1000, Math.floor(embeddings.length * 0.3)) // At least 30% of embeddings as candidates
      );

      console.log(
        `Using spatial hashing: ${candidateIndices.length} candidates from ${embeddings.length} total`
      );

      // Fallback to full search if we get too few candidates
      if (candidateIndices.length < Math.min(500, embeddings.length * 0.1)) {
        console.log(
          "Too few candidates from spatial hashing, falling back to full search"
        );
        candidateIndices = Array.from(
          { length: embeddings.length },
          (_, i) => i
        );
      }
    } else {
      // For smaller datasets, search all
      candidateIndices = Array.from({ length: embeddings.length }, (_, i) => i);
    }

    const indexingEndTime = performance.now();
    console.log(
      `📊 Candidate selection: ${(indexingEndTime - indexingStartTime).toFixed(
        2
      )}ms`
    );

    // Process all candidates without batching
    const results: SearchResult[] = [];
    const minSimilarity = threshold;

    const similarityStartTime = performance.now();

    for (let j = 0; j < candidateIndices.length; j++) {
      const i = candidateIndices[j];
      const item = embeddings[i];

      // Ensure embedding is Float32Array
      const embeddingVector =
        item.embedding instanceof Float32Array
          ? item.embedding
          : new Float32Array(item.embedding);

      const similarity = dotProductSimilarity(
        normalizedQueryEmbedding,
        embeddingVector
      );

      if (similarity >= minSimilarity) {
        results.push({
          embedding: embeddingVector,
          index: i,
          similarity,
          message: item.message,
        });
      }
    }

    // Sort by similarity (highest first) and take topK
    const similarityEndTime = performance.now();
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, topK);

    const totalSearchTime = performance.now() - searchStartTime;
    console.log(
      `⚡ Similarity calculation: ${(
        similarityEndTime - similarityStartTime
      ).toFixed(2)}ms`
    );
    console.log(`🎯 Total search time: ${totalSearchTime.toFixed(2)}ms`);
    console.log(
      `Found ${topResults.length} similar prompts above threshold ${threshold}`
    );
    return topResults;
  } catch (error) {
    console.error("Error in similarity search:", error);
    return [];
  }
}

// Helper function to get embeddings with caching and filters
async function getCachedEmbeddings(filters?: {
  platform?: "chatgpt" | "claude" | "perplexity";
  role?: "user" | "assistant" | "system" | "tool";
  hasAttachments?: boolean;
  isStarred?: boolean;
  dateRange?: "last7days" | "last30days" | "last90days" | "all";
}): Promise<PromptEmbedding[] | null> {
  const now = Date.now();
  const filterKey = JSON.stringify(filters || {});
  console.log("🔍 filterKey", filterKey);
  console.log("🔍 embeddingsCache", embeddingsCache);
  console.log("🔍 cacheTimestamp", cacheTimestamp);
  console.log("🔍 lastUsedFilters", lastUsedFilters);

  // Return cached embeddings if still valid and filters match
  if (
    embeddingsCache &&
    now - cacheTimestamp < CACHE_DURATION &&
    JSON.stringify(lastUsedFilters) === filterKey
  ) {
    return embeddingsCache;
  }

  // Clear old cache and spatial hash map when getting fresh embeddings
  embeddingsCache = null;
  spatialHashMap = null;
  hashMapEmbeddingsLength = 0;
  lastUsedFilters = filters || {};

  try {
    // Get filtered messages with embeddings from IndexedDB
    const messages = await databaseService.getFilteredMessagesWithEmbeddings(
      filters
    );

    if (messages && messages.length > 0) {
      // Convert messages to PromptEmbedding format
      const embeddings: PromptEmbedding[] = messages.map((msg) => ({
        prompt: msg.content,
        embedding: msg.embedding!, // We know these have embeddings due to the filter
        message: msg, // Pass the entire ChatMessage object
      }));
      embeddingsCache = embeddings;
      cacheTimestamp = now;
      return embeddings;
    }

    return null;
  } catch (error) {
    console.error("Error loading embeddings from IndexedDB:", error);
    return null;
  }
}

// Track last used filters for cache validation
let lastUsedFilters: any = {};

/**
 * Check if all embeddings in the array are normalized (unit vectors)
 * @param embeddings - Array of PromptEmbedding objects to check
 * @returns boolean - true if all embeddings are normalized, false otherwise
 */
function areEmbeddingsNormalized(embeddings: PromptEmbedding[]): boolean {
  if (!embeddings || embeddings.length === 0) {
    return true; // Empty array is considered normalized
  }

  const tolerance = 1e-6; // Small tolerance for floating point precision

  for (let i = 0; i < embeddings.length; i++) {
    const embedding = embeddings[i].embedding;

    // Calculate the magnitude (L2 norm) of the embedding vector
    let magnitude = 0;
    for (let j = 0; j < embedding.length; j++) {
      magnitude += embedding[j] * embedding[j];
    }
    magnitude = Math.sqrt(magnitude);

    // Check if the magnitude is close to 1.0 (normalized)
    if (Math.abs(magnitude - 1.0) > tolerance) {
      console.warn(
        `⚠️ Embedding ${i} is not normalized. Magnitude: ${magnitude.toFixed(
          6
        )}`
      );
      return false;
    }
  }

  console.log(`✅ All ${embeddings.length} embeddings are properly normalized`);
  return true;
}

// Helper function to manage query cache
function getCachedResults(
  query: string,
  topK: number,
  threshold: number,
  filters?: any
): SearchResult[] | null {
  const filterKey = JSON.stringify(filters || {});
  const cacheKey = `${query}:${topK}:${threshold}:${filterKey}`;
  const cached = queryCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_DURATION) {
    return cached.results;
  }

  return null;
}

function setCachedQuery(
  query: string,
  topK: number,
  threshold: number,
  results: SearchResult[],
  filters?: any
) {
  const filterKey = JSON.stringify(filters || {});
  const cacheKey = `${query}:${topK}:${threshold}:${filterKey}`;

  // Remove oldest entries if cache is full
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }

  queryCache.set(cacheKey, {
    results: results.map((r) => ({ ...r, embedding: new Float32Array() })), // Don't cache embeddings to save memory
    timestamp: Date.now(),
    topK,
    threshold,
  });
}

/**
 * Simple development version of handleSearchPrompts - bypasses all optimizations
 * for debugging purposes. Does a straightforward similarity search through all embeddings.
 */
export async function handleSearchPromptsDev(
  req: any,
  sender: any
): Promise<SearchResponse> {
  console.log("🔧 DEV MODE: Processing search-prompts message", req.body);
  const { query, topK = 10, threshold = 0.4, filters } = req.body;

  if (!query || query.trim() === "") {
    console.log("❌ Query is required, returning");
    return {
      error: "Query is required",
      results: [],
      query: "",
      totalFound: 0,
      threshold,
    };
  }

  try {
    // Get embeddings with caching and filters (skip query cache)
    const storageStartTime = performance.now();
    let embeddings = await getCachedEmbeddings(filters);
    const storageEndTime = performance.now();
    console.log(
      `💾 IndexedDB retrieval: ${(storageEndTime - storageStartTime).toFixed(
        2
      )}ms`
    );

    if (!embeddings || embeddings.length === 0) {
      console.log("❌ No embeddings found, returning");
      return {
        error: "No embeddings found. Please process prompts first.",
        results: [],
        query,
        totalFound: 0,
        threshold,
      };
    }

    console.log(
      `🔍 DEV MODE: Found ${embeddings.length} embeddings to search through`
    );

    // Check if embeddings are normalized
    const normalizationStartTime = performance.now();
    const areNormalized = areEmbeddingsNormalized(embeddings);
    if (!areNormalized) {
      console.log("⚠️ DEV MODE: Some embeddings are not normalized");
    }
    const normalizationEndTime = performance.now();
    console.log(
      `🔧 Normalization check: ${(
        normalizationEndTime - normalizationStartTime
      ).toFixed(2)}ms`
    );

    // Generate query embedding
    const queryStartTime = performance.now();
    const queryEmbeddings = await getEmbeddingsFromHuggingFace(query);
    const queryEmbedding = queryEmbeddings[0];
    const normalizedQueryEmbedding = new Float32Array(queryEmbedding);
    const queryEndTime = performance.now();
    console.log(
      `🔍 Query embedding generation: ${(queryEndTime - queryStartTime).toFixed(
        2
      )}ms`
    );

    console.log(`🔍 DEV MODE: Using threshold: ${threshold}, topK: ${topK}`);

    // SIMPLE SIMILARITY SEARCH - iterate through ALL embeddings
    const searchStartTime = performance.now();
    const results: SearchResult[] = [];

    console.log(
      `🔧 DEV MODE: Starting simple similarity search through ${embeddings.length} embeddings...`
    );

    for (let i = 0; i < embeddings.length; i++) {
      const item = embeddings[i];

      // Ensure embedding is Float32Array
      const embeddingVector =
        item.embedding instanceof Float32Array
          ? item.embedding
          : new Float32Array(item.embedding);

      // Calculate similarity
      const similarity = dotProductSimilarity(
        normalizedQueryEmbedding,
        embeddingVector
      );

      // Add to results if above threshold
      if (similarity >= threshold) {
        results.push({
          embedding: embeddingVector,
          index: i,
          similarity,
          message: item.message,
        });
      }

      // Log progress for every 1000 embeddings
      if ((i + 1) % 1000 === 0) {
        console.log(
          `🔧 DEV MODE: Processed ${i + 1}/${embeddings.length} embeddings...`
        );
      }
    }

    // Sort by similarity (highest first) and take topK
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, topK);

    const searchEndTime = performance.now();
    console.log(
      `🔧 DEV MODE: Simple search completed in ${(
        searchEndTime - searchStartTime
      ).toFixed(2)}ms`
    );

    console.log(
      `✅ DEV MODE: Found ${topResults.length} results above threshold ${threshold}`
    );

    // Debug logging for similarity scores
    if (topResults.length > 0) {
      console.log(
        "🔍 DEV MODE: Top similarity scores:",
        topResults.slice(0, 5).map((r) => ({
          message: r.message.content,
          similarity: r.similarity.toFixed(4),
          index: r.index,
        }))
      );
    }

    return {
      results: topResults,
      query,
      totalFound: topResults.length,
      threshold,
    };
  } catch (error: any) {
    console.error("❌ DEV MODE: Error in search-prompts handler:", error);
    return {
      error: error.message || "An error occurred during search",
      results: [],
      query,
      totalFound: 0,
      threshold,
    };
  }
}

export async function handleSearchPrompts(
  req: any,
  sender: any
): Promise<SearchResponse> {
  console.log("✅ Processing search-prompts message", req.body);
  const { query, topK = 10, threshold = 0.1, filters } = req.body;

  if (!query || query.trim() === "") {
    console.log("❌ Query is required, returning");
    return {
      error: "Query is required",
      results: [],
      query: "",
      totalFound: 0,
      threshold,
    };
  }

  try {
    // Check query cache first (skip in debug mode)
    if (!DEBUG_MODE) {
      const cachedResults = getCachedResults(query, topK, threshold, filters);
      if (cachedResults) {
        return {
          results: cachedResults,
          query,
          totalFound: cachedResults.length,
          threshold,
        };
      }
    }

    // Get embeddings with caching and filters
    const storageStartTime = performance.now();
    let embeddings = await getCachedEmbeddings(filters);
    const storageEndTime = performance.now();
    console.log(
      `💾 IndexedDB retrieval: ${(storageEndTime - storageStartTime).toFixed(
        2
      )}ms`
    );

    if (!embeddings || embeddings.length === 0) {
      console.log("❌ No embeddings found, returning");
      return {
        error: "No embeddings found. Please process prompts first.",
        results: [],
        query,
        totalFound: 0,
        threshold,
      };
    }

    console.log(`🔍 Found ${embeddings.length} embeddings to search through`);

    // Check if embeddings are normalized and fix if needed
    const normalizationStartTime = performance.now();
    const areNormalized = areEmbeddingsNormalized(embeddings);
    if (!areNormalized) {
      console.log("unnormalized embeddings", areNormalized);
    }
    const normalizationEndTime = performance.now();
    console.log(
      `🔧 Normalization check: ${(
        normalizationEndTime - normalizationStartTime
      ).toFixed(2)}ms`
    );

    console.log(`🔍 Using threshold: ${threshold}, topK: ${topK}`);

    // Perform similarity search with threshold
    const results = await performSimilaritySearch(
      query,
      embeddings || [],
      topK,
      threshold
    );

    // Cache the results (skip in debug mode)
    if (!DEBUG_MODE) {
      setCachedQuery(query, topK, threshold, results, filters);
    }

    console.log(
      `✅ Sending successful response with ${results.length} results`
    );

    // Debug logging for similarity scores
    // if (results.length > 0) {
    //   console.log(
    //     "🔍 Top similarity scores:",
    //     results.slice(0, 5).map((r) => ({
    //       prompt: r.prompt.substring(0, 50) + "...",
    //       similarity: r.similarity.toFixed(4),
    //     }))
    //   );
    // }

    return {
      results: results,
      query,
      totalFound: results.length,
      threshold,
    };
  } catch (error: any) {
    console.error("Error in search-prompts handler:", error);
    return {
      error: error.message || "An error occurred during search",
      results: [],
      query,
      totalFound: 0,
      threshold,
    };
  }
}
