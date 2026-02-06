/**
 * Memory type classification
 */
export type MemoryType = 'fact' | 'decision' | 'preference' | 'observation';

/**
 * Memory metadata
 */
export interface MemoryMetadata {
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  relevanceScore: number; // 0-1, decays over time
  tags: string[];
  source: string; // conversation_id or import
}

/**
 * Long-Term Memory structure
 */
export interface Memory {
  id: string; // UUID
  type: MemoryType;
  content: string; // Natural language
  embedding: number[]; // 768-dim vector (Gemini)
  metadata: MemoryMetadata;
}

/**
 * Short-Term Memory entry (conversation turn)
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Summary Memory structure
 */
export interface SummaryMemory {
  id: string;
  timeWindow: 'daily' | 'weekly' | 'monthly';
  startDate: number;
  endDate: number;
  content: string;
  memoryCount: number; // Number of memories compressed
  createdAt: number;
}

/**
 * Memory extraction candidate from LLM
 */
export interface MemoryCandidate {
  type: MemoryType;
  content: string;
  confidence: number; // 0-1
  tags: string[];
}

/**
 * Memory extraction response from LLM
 */
export interface MemoryExtractionResult {
  memories: MemoryCandidate[];
  shouldSummarize: boolean;
  reasoning: string;
}
