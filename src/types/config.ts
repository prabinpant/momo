/**
 * Application configuration
 */
export interface Config {
  // Gemini API
  gemini: {
    apiKey: string;
    model: string;
  };

  // Memory settings
  memory: {
    dbPath: string;
    topK: number;
    relevanceThreshold: number;
    decayRate: number;
    summaryThreshold: number;
  };

  // Performance
  performance: {
    maxPromptSize: number;
    embeddingCacheSize: number;
    vectorSearchBatchSize: number;
  };

  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
  };
}
