/**
 * Prompt construction and formatting
 */

import { RetrievedContext } from './retrieval.js';
import { ConversationTurn } from '../types/index.js';

/**
 * System prompt for Momory agent
 */
export const SYSTEM_PROMPT = `You are Momory, an AI agent with persistent external memory.

CRITICAL CAPABILITIES:
- You remember facts, preferences, and decisions across sessions
- You retrieve only relevant memories, not entire history
- You distinguish between important and trivial information
- You reason with both retrieved context and current input

RESPONSE GUIDELINES:
1. Use retrieved memories naturally in your response
2. Acknowledge when you're recalling past information
3. If memories conflict, prefer recent over old
4. If no relevant memory exists, admit it
5. Be concise and helpful`;

/**
 * Format memories for prompt injection
 */
export function formatMemories(context: RetrievedContext): string {
  const sections: string[] = [];

  // Format recent memories
  if (context.memories.length > 0) {
    const memoriesText = context.memories
      .map(
        (m, i) =>
          `${i + 1}. [${m.memory.type}] ${m.memory.content} (relevance: ${m.similarity.toFixed(2)})`
      )
      .join('\n');

    sections.push(`RELEVANT MEMORIES:\n${memoriesText}`);
  }

  // Format summary chunks
  if (context.summaryChunks.length > 0) {
    const chunksText = context.summaryChunks
      .map(
        (c, i) =>
          `${i + 1}. ${c.chunk.content} (relevance: ${c.similarity.toFixed(2)})`
      )
      .join('\n\n');

    sections.push(`HISTORICAL CONTEXT (Summaries):\n${chunksText}`);
  }

  return sections.length > 0
    ? sections.join('\n\n')
    : 'No relevant memories found.';
}

/**
 * Format conversation history
 */
export function formatConversationHistory(
  turns: ConversationTurn[],
  maxTurns: number = 10
): string {
  if (turns.length === 0) {
    return '';
  }

  const recentTurns = turns.slice(-maxTurns);
  const formatted = recentTurns
    .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
    .join('\n\n');

  return `RECENT CONVERSATION:\n${formatted}`;
}

/**
 * Build complete prompt with all context
 */
export function buildPrompt(options: {
  userMessage: string;
  retrievedContext?: RetrievedContext;
  conversationHistory?: ConversationTurn[];
  includeSystem?: boolean;
}): string {
  const parts: string[] = [];

  // System prompt
  if (options.includeSystem !== false) {
    parts.push(SYSTEM_PROMPT);
  }

  // Retrieved memories and summaries
  if (options.retrievedContext) {
    parts.push(formatMemories(options.retrievedContext));
  }

  // Recent conversation
  if (options.conversationHistory && options.conversationHistory.length > 0) {
    parts.push(formatConversationHistory(options.conversationHistory));
  }

  // Current user message
  parts.push(`USER: ${options.userMessage}`);

  return parts.join('\n\n---\n\n');
}

/**
 * Build memory extraction prompt
 */
export function buildMemoryExtractionPrompt(
  userMessage: string,
  assistantResponse: string
): string {
  return `Analyze the following interaction and extract structured memories.

USER INPUT: ${userMessage}
ASSISTANT RESPONSE: ${assistantResponse}

EXTRACTION RULES:
1. Only extract objectively valuable information
2. Avoid extracting: greetings, confirmations, trivial acknowledgments
3. Prefer atomic facts over long narratives
4. Tag each memory with type: fact, decision, preference, observation

OUTPUT FORMAT (JSON):
{
  "memories": [
    {
      "type": "fact|decision|preference|observation",
      "content": "Single, clear statement",
      "confidence": 0.0-1.0,
      "tags": ["tag1", "tag2"]
    }
  ],
  "reasoning": "Brief explanation of extraction decisions"
}

EXAMPLES:
✅ GOOD: "User prefers Python for data tasks"
❌ BAD: "User said they like Python"
✅ GOOD: "Project deadline is March 15, 2026"
❌ BAD: "We talked about deadlines"

Extract memories:`;
}

/**
 * Build summarization prompt
 */
export function buildSummarizationPrompt(contents: string[]): string {
  return `Summarize the following memories into a concise overview.

MEMORIES TO SUMMARIZE (${contents.length} memories):
${contents.map((c, i) => `${i + 1}. ${c}`).join('\n')}

SUMMARIZATION RULES:
1. Organize by topic/theme (programming, preferences, work, etc.)
2. Preserve all critical facts, dates, and decisions
3. Remove redundant information
4. Use clear, atomic statements
5. Target ~500-800 words

OUTPUT:
A well-organized summary that will be chunked for embedding.
Ensure natural topic transitions for effective chunking.`;
}

/**
 * Estimate prompt size in tokens (rough estimate)
 */
export function estimatePromptTokens(prompt: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English
  return Math.ceil(prompt.length / 4);
}

/**
 * Check if prompt exceeds maximum size
 */
export function isPromptTooLarge(
  prompt: string,
  maxTokens: number = 8192
): boolean {
  return estimatePromptTokens(prompt) > maxTokens;
}

/**
 * Truncate prompt to fit within token limit
 */
export function truncatePrompt(
  prompt: string,
  maxTokens: number = 8192
): string {
  const maxChars = maxTokens * 4;
  if (prompt.length <= maxChars) {
    return prompt;
  }

  // Keep beginning and end, truncate middle
  const keepChars = Math.floor(maxChars * 0.9); // 90% of limit
  const startChars = Math.floor(keepChars * 0.7); // 70% from start
  const endChars = keepChars - startChars; // 30% from end

  const start = prompt.substring(0, startChars);
  const end = prompt.substring(prompt.length - endChars);

  return `${start}\n\n[... context truncated ...]\n\n${end}`;
}
