/**
 * Keyword matching utilities for hybrid search
 */

/**
 * Extract keywords from text (simple tokenization)
 */
export function extractKeywords(text: string): string[] {
  // Convert to lowercase, remove punctuation, split into words
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2) // Remove short words
    .filter((word) => !STOP_WORDS.has(word)); // Remove stop words
}

/**
 * Common stop words to filter out
 */
const STOP_WORDS = new Set([
  'the',
  'is',
  'at',
  'which',
  'on',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'with',
  'to',
  'for',
  'of',
  'as',
  'by',
  'from',
  'that',
  'this',
  'these',
  'those',
  'was',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'are',
  'am',
  'it',
  'its',
  'what',
  'where',
  'when',
  'who',
  'why',
  'how',
  'you',
  'your',
  'my',
  'me',
  'i',
  'we',
  'they',
  'them',
  'their',
]);

/**
 * Calculate BM25-style keyword score between query and document
 *
 * @param queryKeywords - Keywords from the query
 * @param documentText - Text to score against
 * @returns Score between 0 and 1
 */
export function calculateKeywordScore(
  queryKeywords: string[],
  documentText: string
): number {
  if (queryKeywords.length === 0) {
    return 0;
  }

  const docKeywords = extractKeywords(documentText);
  const docKeywordSet = new Set(docKeywords);

  // Count matching keywords
  let matchCount = 0;
  const matchedKeywords = new Set<string>();

  for (const queryKeyword of queryKeywords) {
    if (docKeywordSet.has(queryKeyword)) {
      matchCount++;
      matchedKeywords.add(queryKeyword);
    }
  }

  // Calculate base score (percentage of query keywords that matched)
  const baseScore = matchCount / queryKeywords.length;

  // Boost score for exact phrase matches
  const queryText = queryKeywords.join(' ');
  const docText = documentText.toLowerCase();
  let phraseBoost = 0;

  if (docText.includes(queryText)) {
    phraseBoost = 0.3; // Significant boost for exact phrase match
  } else {
    // Check for partial phrase matches (2+ consecutive keywords)
    for (let i = 0; i < queryKeywords.length - 1; i++) {
      const phrase = queryKeywords.slice(i, i + 2).join(' ');
      if (docText.includes(phrase)) {
        phraseBoost = Math.max(phraseBoost, 0.15);
      }
    }
  }

  // Normalize score to 0-1 range
  return Math.min(1.0, baseScore + phraseBoost);
}

/**
 * Calculate TF-IDF style score (simplified)
 *
 * @param queryKeywords - Keywords from query
 * @param documentText - Text to score
 * @param allDocuments - All documents for IDF calculation (optional)
 * @returns Score between 0 and 1
 */
export function calculateTfIdfScore(
  queryKeywords: string[],
  documentText: string,
  allDocuments?: string[]
): number {
  if (queryKeywords.length === 0) {
    return 0;
  }

  const docKeywords = extractKeywords(documentText);
  const docLength = docKeywords.length;

  if (docLength === 0) {
    return 0;
  }

  // Calculate term frequency for each query keyword
  const termFrequencies = new Map<string, number>();
  for (const keyword of docKeywords) {
    termFrequencies.set(keyword, (termFrequencies.get(keyword) || 0) + 1);
  }

  let score = 0;
  for (const queryKeyword of queryKeywords) {
    const tf = (termFrequencies.get(queryKeyword) || 0) / docLength;

    // If we have all documents, calculate IDF
    let idf = 1.0;
    if (allDocuments && allDocuments.length > 0) {
      const docsWithTerm = allDocuments.filter((doc) =>
        doc.toLowerCase().includes(queryKeyword)
      ).length;
      idf = Math.log((allDocuments.length + 1) / (docsWithTerm + 1));
    }

    score += tf * idf;
  }

  // Normalize by query length
  return Math.min(1.0, score / queryKeywords.length);
}

/**
 * Hybrid score combining vector similarity and keyword matching
 *
 * @param vectorSimilarity - Cosine similarity score (0-1)
 * @param keywordScore - Keyword matching score (0-1)
 * @param vectorWeight - Weight for vector similarity (default 0.7)
 * @returns Combined score (0-1)
 */
export function calculateHybridScore(
  vectorSimilarity: number,
  keywordScore: number,
  vectorWeight: number = 0.7
): number {
  const keywordWeight = 1 - vectorWeight;
  return vectorSimilarity * vectorWeight + keywordScore * keywordWeight;
}

/**
 * Expand query with synonyms and variations for better matching
 */
export function expandQuery(query: string): string[] {
  const expansions = [query];

  // Common synonyms/variations
  const synonymMap: Record<string, string[]> = {
    name: ['name', 'called', 'known as'],
    work: ['work', 'job', 'employed', 'company'],
    like: ['like', 'prefer', 'enjoy', 'love'],
    information: ['information', 'data', 'details', 'facts', 'know'],
    remember: ['remember', 'recall', 'stored', 'saved', 'know'],
  };

  const keywords = extractKeywords(query);

  for (const keyword of keywords) {
    if (synonymMap[keyword]) {
      const baseQuery = query.toLowerCase();
      for (const synonym of synonymMap[keyword]) {
        if (synonym !== keyword) {
          expansions.push(baseQuery.replace(keyword, synonym));
        }
      }
    }
  }

  return expansions;
}
