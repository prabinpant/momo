import { config as dotenvConfig } from 'dotenv';
import { Config } from '../types/index.js';

// Load environment variables
dotenvConfig();

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): Config {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required in environment');
  }

  return {
    gemini: {
      apiKey,
      model: process.env.GEMINI_MODEL || 'gemini-3.0-pro',
    },
    memory: {
      dbPath: process.env.MEMORY_DB_PATH || './db/memory.db',
      topK: parseInt(process.env.MEMORY_TOP_K || '10', 10),
      relevanceThreshold: parseFloat(
        process.env.MEMORY_RELEVANCE_THRESHOLD || '0.50'
      ),
      decayRate: parseFloat(process.env.MEMORY_DECAY_RATE || '0.05'),
      summaryThreshold: parseInt(
        process.env.MEMORY_SUMMARY_THRESHOLD || '100',
        10
      ),
      maxPromptTokens: parseInt(process.env.MAX_PROMPT_TOKENS || '8192', 10),
    },
    performance: {
      maxPromptSize: parseInt(process.env.MAX_PROMPT_SIZE || '8192', 10),
      embeddingCacheSize: parseInt(
        process.env.EMBEDDING_CACHE_SIZE || '1000',
        10
      ),
      vectorSearchBatchSize: parseInt(
        process.env.VECTOR_SEARCH_BATCH_SIZE || '50',
        10
      ),
    },
    logging: {
      level: (process.env.LOG_LEVEL as Config['logging']['level']) || 'info',
      file: process.env.LOG_FILE || './logs/momo.log',
    },
  };
}

// Singleton config instance
let configInstance: Config | null = null;

/**
 * Get the global config instance
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
