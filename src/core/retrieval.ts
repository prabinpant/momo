/**
 * Memory retrieval with vector search
 */

import { generateEmbedding } from '../services/gemini.js';
import { findTopSimilar } from '../utils/vector.js';
import {
  extractKeywords,
  calculateKeywordScore,
  calculateHybridScore,
} from '../utils/keywords.js';
import { getConfig, getLogger } from '../utils/index.js';
import { getAllMemories, getAllSummaryChunks } from './memory.js';
import {
  Memory,
  SummaryChunk,
  Result,
  success,
  failure,
} from '../types/index.js';

const logger = getLogger();

/**
 * Preprocess query to extract semantic core for better embedding
 * Removes greetings, filler words, and focuses on the actual intent
 */
function preprocessQuery(query: string): string {
  // Remove common conversational prefixes that dilute embeddings
  const patterns = [
    /^(hello|hi|hey|greetings?)[,\s]+/i,
    /^(do you|can you|could you|would you)[\s]+/i,
    /^(please)[\s]+/i,
    /^(i want to|i need to|i would like to)[\s]+/i,
  ];

  let processed = query;
  for (const pattern of patterns) {
    processed = processed.replace(pattern, '');
  }

  // Convert questions to statements for better matching
  // "do you have my name?" -> "my name"
  // "what is my name?" -> "my name"
  const questionPatterns = [
    { pattern: /do you (have|know|remember)\s+(.+?)\?/i, replace: '$2' },
    { pattern: /what is\s+(.+?)\?/i, replace: '$1' },
    { pattern: /what's\s+(.+?)\?/i, replace: '$1' },
    { pattern: /where is\s+(.+?)\?/i, replace: '$1' },
    { pattern: /when is\s+(.+?)\?/i, replace: '$1' },
  ];

  for (const { pattern, replace } of questionPatterns) {
    const match = processed.match(pattern);
    if (match) {
      processed = processed.replace(pattern, replace);
      break;
    }
  }

  const trimmed = processed.trim();
  console.log(
    `🔄 [QUERY PREPROCESSING] Original: "${query}" → Focused: "${trimmed}"`
  );

  // Return original if preprocessing made it too short
  return trimmed.length >= 3 ? trimmed : query;
}

/**
 * Retrieved context from memory search
 */
export interface RetrievedContext {
  memories: Array<{ memory: Memory; similarity: number }>;
  summaryChunks: Array<{ chunk: SummaryChunk; similarity: number }>;
  query: string;
  queryEmbedding: number[];
}

/**
 * Retrieve relevant memories and summary chunks for a query
 *
 * @param query - User query or input text
 * @param options - Retrieval options
 * @returns Retrieved context with memories and summary chunks
 */
export async function retrieveContext(
  query: string,
  options?: {
    memoryTopK?: number;
    summaryTopK?: number;
    minRelevance?: number;
  }
): Promise<Result<RetrievedContext, Error>> {
  try {
    const config = getConfig();
    const memoryTopK = options?.memoryTopK ?? config.memory.topK;
    const summaryTopK = options?.summaryTopK ?? Math.ceil(memoryTopK / 2);
    const minRelevance =
      options?.minRelevance ?? config.memory.relevanceThreshold;

    logger.debug('Retrieving context', {
      query: query.substring(0, 50),
      memoryTopK,
      summaryTopK,
      minRelevance,
    });

    // Step 0.5: Preprocess query to extract semantic core
    const focusedQuery = preprocessQuery(query);

    // Step 1: Generate query embedding (use focused query for better matching)
    const embeddingResult = await generateEmbedding(focusedQuery);
    if (!embeddingResult.ok) {
      return failure(embeddingResult.error);
    }

    const queryEmbedding = embeddingResult.value;

    // Step 1.5: Extract keywords for hybrid search
    const queryKeywords = extractKeywords(query);
    console.log(`🔑 [KEYWORDS] Extracted: ${queryKeywords.join(', ')}`);

    // Step 2: Load all memories
    const memoriesResult = await getAllMemories();
    if (!memoriesResult.ok) {
      return failure(memoriesResult.error);
    }

    const allMemories = memoriesResult.value;

    // Step 3: Load all summary chunks
    const chunksResult = await getAllSummaryChunks();
    if (!chunksResult.ok) {
      return failure(chunksResult.error);
    }

    const allChunks = chunksResult.value;

    logger.debug('Loaded data for search', {
      memoriesCount: allMemories.length,
      chunksCount: allChunks.length,
    });

    // Step 4: Vector search on memories
    console.log('🔍 [RETRIEVAL] Searching memories by similarity...');
    const memoryResults =
      allMemories.length > 0
        ? findTopSimilar(
            queryEmbedding,
            allMemories.map((m) => ({
              id: m.id,
              vector: m.embedding,
              data: m,
            })),
            memoryTopK
          )
        : [];

    console.log(`   Found ${memoryResults.length} candidate memories:`);
    memoryResults.forEach((r, i) => {
      console.log(
        `      ${i + 1}. [${r.similarity.toFixed(3)}] ${(r.data as Memory).content.substring(0, 70)}...`
      );
    });

    // Step 4.5: Apply hybrid scoring (combine vector + keyword)
    console.log('🔗 [RETRIEVAL] Applying hybrid scoring (vector + keyword)...');
    const hybridResults = memoryResults.map((result) => {
      const memory = result.data as Memory;
      const keywordScore = calculateKeywordScore(queryKeywords, memory.content);
      const hybridScore = calculateHybridScore(
        result.similarity,
        keywordScore,
        0.7 // 70% vector, 30% keyword
      );

      return {
        ...result,
        keywordScore,
        hybridScore,
      };
    });

    // Re-sort by hybrid score
    hybridResults.sort((a, b) => b.hybridScore - a.hybridScore);

    console.log('   Top 5 after hybrid scoring:');
    hybridResults.slice(0, 5).forEach((r, i) => {
      console.log(
        `      ${i + 1}. [V:${r.similarity.toFixed(3)} K:${r.keywordScore.toFixed(3)} H:${r.hybridScore.toFixed(3)}] ${(r.data as Memory).content.substring(0, 50)}...`
      );
    });

    // Step 5: Vector search on summary chunks
    const chunkResults =
      allChunks.length > 0
        ? findTopSimilar(
            queryEmbedding,
            allChunks.map((c) => ({
              id: c.id,
              vector: c.embedding,
              data: c,
            })),
            summaryTopK
          )
        : [];

    // Step 6: Filter by relevance threshold
    console.log(`🎯 [RETRIEVAL] Filtering by threshold: ${minRelevance}`);
    const relevantMemories = hybridResults
      .filter((r) => r.hybridScore >= minRelevance)
      .map((r) => ({
        memory: r.data as Memory,
        similarity: r.hybridScore,
      }));

    const relevantChunks = chunkResults
      .filter((r) => r.similarity >= minRelevance)
      .map((r) => ({
        chunk: r.data as SummaryChunk,
        similarity: r.similarity,
      }));

    console.log(`✅ [RETRIEVAL] After filtering:`);
    console.log(`   Relevant memories: ${relevantMemories.length}`);
    if (relevantMemories.length > 0) {
      relevantMemories.slice(0, 3).forEach((m, i) => {
        console.log(
          `      ${i + 1}. [${m.similarity.toFixed(3)}] ${m.memory.content.substring(0, 50)}...`
        );
      });
    }
    console.log(`   Relevant chunks: ${relevantChunks.length}`);

    logger.info('Context retrieved', {
      memoriesFound: relevantMemories.length,
      chunksFound: relevantChunks.length,
      topMemorySimilarity: relevantMemories[0]?.similarity.toFixed(3),
      topChunkSimilarity: relevantChunks[0]?.similarity.toFixed(3),
    });

    return success({
      memories: relevantMemories,
      summaryChunks: relevantChunks,
      query,
      queryEmbedding,
    });
  } catch (error) {
    logger.error('Context retrieval failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get recent memories (last N days)
 */
export async function getRecentMemories(
  daysBack: number = 30
): Promise<Result<Memory[], Error>> {
  try {
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const allMemoriesResult = await getAllMemories();

    if (!allMemoriesResult.ok) {
      return failure(allMemoriesResult.error);
    }

    const recentMemories = allMemoriesResult.value.filter(
      (m) => m.metadata.createdAt >= cutoffTime
    );

    logger.debug('Filtered recent memories', {
      daysBack,
      total: allMemoriesResult.value.length,
      recent: recentMemories.length,
    });

    return success(recentMemories);
  } catch (error) {
    logger.error('Failed to get recent memories', {
      error: error instanceof Error ? error.message : String(error),
    });
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Search memories by text query with vector similarity
 *
 * @param query - Search query
 * @param topK - Number of results to return
 * @returns Top matching memories with similarity scores
 */
export async function searchMemories(
  query: string,
  topK: number = 10
): Promise<Result<Array<{ memory: Memory; similarity: number }>, Error>> {
  try {
    const contextResult = await retrieveContext(query, {
      memoryTopK: topK,
      summaryTopK: 0, // Only search memories
    });

    if (!contextResult.ok) {
      return failure(contextResult.error);
    }

    return success(contextResult.value.memories);
  } catch (error) {
    logger.error('Memory search failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}
