/**
 * Main agent execution loop
 */

import { generateText } from '../services/gemini.js';
import { saveMemory, countMemories } from './memory.js';
import { retrieveContext } from './retrieval.js';
import {
  buildPrompt,
  buildMemoryExtractionPrompt,
  estimatePromptTokens,
  isPromptTooLarge,
  truncatePrompt,
} from './prompts.js';
import { getConfig, getLogger } from '../utils/index.js';
import {
  ConversationTurn,
  MemoryCandidate,
  Result,
  success,
  failure,
} from '../types/index.js';

const logger = getLogger();

/**
 * Agent response with metadata
 */
export interface AgentResponse {
  message: string;
  memoriesExtracted: number;
  retrievalStats: {
    memoriesFound: number;
    summaryChunksFound: number;
  };
  promptTokens: number;
}

/**
 * Agent session state (in-memory conversation history)
 */
export class AgentSession {
  private conversationHistory: ConversationTurn[] = [];
  private readonly maxHistoryTurns: number;

  constructor(maxHistoryTurns: number = 10) {
    this.maxHistoryTurns = maxHistoryTurns;
  }

  addTurn(role: 'user' | 'assistant', content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Keep only recent turns
    if (this.conversationHistory.length > this.maxHistoryTurns) {
      this.conversationHistory = this.conversationHistory.slice(
        -this.maxHistoryTurns
      );
    }
  }

  getHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  clear(): void {
    this.conversationHistory = [];
  }
}

/**
 * Main agent execution - process user input and generate response
 */
export async function processInput(
  userInput: string,
  session: AgentSession
): Promise<Result<AgentResponse, Error>> {
  try {
    const config = getConfig();

    console.log(
      '\n🔍 [AGENT] Processing user input:',
      userInput.substring(0, 50) + '...'
    );
    logger.info('Processing user input', {
      inputLength: userInput.length,
      historyTurns: session.getHistory().length,
    });

    // STEP 1: Retrieve relevant context
    console.log('📚 [RETRIEVAL] Step 1: Retrieving context...');
    logger.debug('Step 1: Retrieving context');
    const contextResult = await retrieveContext(userInput);

    if (!contextResult.ok) {
      console.log('❌ [RETRIEVAL] Failed:', contextResult.error.message);
      return failure(contextResult.error);
    }

    const context = contextResult.value;

    console.log(
      `✅ [RETRIEVAL] Found ${context.memories.length} memories, ${context.summaryChunks.length} chunks`
    );
    if (context.memories.length > 0) {
      console.log(
        '   Top memory:',
        context.memories[0].memory.content.substring(0, 60) + '...'
      );
    }
    logger.debug('Context retrieved', {
      memories: context.memories.length,
      summaryChunks: context.summaryChunks.length,
    });

    // STEP 2: Build prompt with context
    console.log('📝 [PROMPT] Step 2: Building prompt...');
    logger.debug('Step 2: Building prompt');
    let prompt = buildPrompt({
      userMessage: userInput,
      retrievedContext: context,
      conversationHistory: session.getHistory(),
      includeSystem: true,
    });

    // Check if prompt is too large
    if (isPromptTooLarge(prompt, config.memory.maxPromptTokens)) {
      console.log('⚠️  [PROMPT] Prompt too large, truncating...');
      logger.warn('Prompt too large, truncating', {
        originalTokens: estimatePromptTokens(prompt),
        maxTokens: config.memory.maxPromptTokens,
      });
      prompt = truncatePrompt(prompt, config.memory.maxPromptTokens);
    }

    const promptTokens = estimatePromptTokens(prompt);

    console.log(`✅ [PROMPT] Built: ${promptTokens} tokens`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 [PROMPT] Full prompt being sent to LLM:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(prompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    logger.debug('Prompt built', {
      length: prompt.length,
      tokens: promptTokens,
    });

    // STEP 3: Generate response from LLM
    logger.debug('Step 3: Generating response');
    const responseResult = await generateText(prompt);

    if (!responseResult.ok) {
      return failure(responseResult.error);
    }

    const assistantResponse = responseResult.value;

    logger.info('Response generated', {
      responseLength: assistantResponse.length,
    });

    // STEP 4: Extract memories from interaction
    logger.debug('Step 4: Extracting memories');
    const extractedMemories = await extractMemories(
      userInput,
      assistantResponse
    );

    logger.info('Memories extracted', {
      count: extractedMemories.length,
    });

    // STEP 5: Update conversation history
    session.addTurn('user', userInput);
    session.addTurn('assistant', assistantResponse);

    // STEP 6: Check if summarization needed (conditional maintenance)
    const memoryCountResult = await countMemories();
    if (
      memoryCountResult.ok &&
      memoryCountResult.value >= config.memory.summaryThreshold
    ) {
      logger.info('Memory threshold reached, summarization recommended', {
        currentCount: memoryCountResult.value,
        threshold: config.memory.summaryThreshold,
      });
      // Note: Summarization should be done in background or manually triggered
    }

    return success({
      message: assistantResponse,
      memoriesExtracted: extractedMemories.length,
      retrievalStats: {
        memoriesFound: context.memories.length,
        summaryChunksFound: context.summaryChunks.length,
      },
      promptTokens,
    });
  } catch (error) {
    logger.error('Agent execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Extract memories from user-assistant interaction
 */
async function extractMemories(
  userInput: string,
  assistantResponse: string
): Promise<MemoryCandidate[]> {
  try {
    // Build extraction prompt
    const extractionPrompt = buildMemoryExtractionPrompt(
      userInput,
      assistantResponse
    );

    logger.debug('Extracting memories', {
      promptLength: extractionPrompt.length,
    });

    // Ask LLM to extract memories
    const extractionResult = await generateText(extractionPrompt);

    if (!extractionResult.ok) {
      logger.warn('Memory extraction failed', {
        error: extractionResult.error.message,
      });
      return [];
    }

    // Parse JSON response
    const response = extractionResult.value;

    // Try to extract JSON from markdown code blocks if present
    let jsonText = response;
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    let parsed: { memories?: MemoryCandidate[]; reasoning?: string };
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      logger.warn('Failed to parse extraction JSON', {
        response: response.substring(0, 200),
      });
      return [];
    }

    const memories = parsed.memories || [];

    // Filter out low-confidence memories
    const filtered = memories.filter((m) => (m.confidence || 0) >= 0.7);

    // Save extracted memories (with deduplication)
    let savedCount = 0;
    let duplicateCount = 0;
    
    for (const memory of filtered) {
      const saveResult = await saveMemory(memory);
      if (!saveResult.ok) {
        // Check if it's a duplicate (not a real error)
        if (saveResult.error.message === 'Duplicate memory') {
          duplicateCount++;
        } else {
          logger.warn('Failed to save extracted memory', {
            content: memory.content.substring(0, 50),
            error: saveResult.error.message,
          });
        }
      } else {
        savedCount++;
      }
    }

    if (duplicateCount > 0) {
      console.log(
        `⏭️  [MEMORY] Skipped ${duplicateCount} duplicate(s), saved ${savedCount} new`
      );
    }
    
    logger.debug('Memories processed', {
      extracted: memories.length,
      filtered: filtered.length,
      saved: savedCount,
      duplicates: duplicateCount,
      reasoning: parsed.reasoning,
    });

    return filtered;
  } catch (error) {
    logger.error('Memory extraction error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Simple conversation interface - process multiple turns
 */
export async function chat(
  messages: string[],
  session?: AgentSession
): Promise<Result<string[], Error>> {
  const agentSession = session || new AgentSession();
  const responses: string[] = [];

  for (const message of messages) {
    const result = await processInput(message, agentSession);

    if (!result.ok) {
      return failure(result.error);
    }

    responses.push(result.value.message);
  }

  return success(responses);
}
