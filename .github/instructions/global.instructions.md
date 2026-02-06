---
applyTo: "**"
---

# MOMO: Virtual-Unlimited-Memory AI Agent

## 🎯 Core Mission

Build a production-grade AI agent with **persistent, scalable memory** that operates beyond traditional context window limitations.

### Fundamental Architecture Principles

```
memory ≠ context window
memory = external store + retrieval + compaction + intelligence
```

**Core Thesis**: The LLM is stateless. All memory is external, selective, and retrieved on-demand.

---

## 1. System Architecture

### 1.1 Memory Types

#### A. Short-Term Memory (STM)

- **Purpose**: Maintain conversation coherence
- **Storage**: In-memory only (RAM)
- **Lifecycle**: Session-scoped, reset on restart
- **Content**: Recent turns (last 5-10 exchanges)
- **Max Size**: 4KB per entry, ~50KB total

#### B. Long-Term Memory (LTM)

- **Purpose**: Persistent knowledge across sessions
- **Storage**: SQLite + vector embeddings
- **Lifecycle**: Permanent until explicitly pruned
- **Content**: Atomic facts, decisions, preferences, observations
- **Schema**:

```typescript
interface Memory {
  id: string; // UUID
  type: "fact" | "decision" | "preference" | "observation";
  content: string; // Natural language
  embedding: number[]; // 768-dim vector (Gemini)
  metadata: {
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
    relevanceScore: number; // 0-1, decays over time
    tags: string[];
    source: string; // conversation_id or import
  };
}
```

#### C. Summary Memory

- **Purpose**: Compressed historical context
- **Storage**: SQLite (separate table)
- **Generation**: Triggered when LTM > threshold
- **Content**: Time-windowed summaries (daily, weekly, monthly)
- **Compression Ratio**: Target 10:1 (raw memories → summary)

---

## 2. Agent Execution Loop

### Complete Pipeline (Non-Negotiable Sequence)

```typescript
async function processUserInput(input: string): Promise<string> {
  // STEP 1: Receive Input
  const userMessage = input;

  // STEP 2: Retrieve Relevant Memory
  const inputEmbedding = await embedText(input);
  const relevantMemories = await vectorSearch(inputEmbedding, (topK = 10));
  const summaryContext = await getLatestSummary();
  const recentContext = getSTM();

  // STEP 3: Construct Context-Rich Prompt
  const prompt = buildPrompt({
    system: AGENT_SYSTEM_PROMPT,
    relevantMemories,
    summaryContext,
    recentContext,
    userMessage,
  });

  // STEP 4: LLM Reasoning (Gemini)
  const response = await gemini.generate(prompt);

  // STEP 5: Extract Memory Candidates
  const memoryExtractionPrompt = buildMemoryExtractionPrompt(
    userMessage,
    response,
  );
  const memories = await gemini.generate(memoryExtractionPrompt);

  // STEP 6: Persist Valuable Memories
  const validMemories = filterNoise(memories);
  await saveToLTM(validMemories);
  await updateVectorIndex(validMemories);

  // STEP 7: Maintenance (Conditional)
  if (shouldRunMaintenance()) {
    await summarizeOldMemories();
    await decayRelevanceScores();
    await pruneStaleMemories();
  }

  // STEP 8: Update STM
  addToSTM({ role: "user", content: userMessage });
  addToSTM({ role: "assistant", content: response });

  return response;
}
```

---

## 3. Prompt Engineering (Critical)

### 3.1 System Prompt Template

```
You are MOMO, an AI agent with persistent external memory.

CRITICAL CAPABILITIES:
- You remember facts, preferences, and decisions across sessions
- You retrieve only relevant memories, not entire history
- You distinguish between important and trivial information
- You reason with both retrieved context and current input

MEMORY CONTEXT (Retrieved for this task):
{relevantMemories}

HISTORICAL SUMMARY:
{summaryContext}

RECENT CONVERSATION:
{recentContext}

CURRENT TASK:
{userMessage}

RESPONSE GUIDELINES:
1. Use retrieved memories naturally in your response
2. Acknowledge when you're recalling past information
3. If memories conflict, prefer recent over old
4. If no relevant memory exists, admit it
5. Propose new facts worth remembering
```

### 3.2 Memory Extraction Prompt

```
Analyze the following interaction and extract structured memories.

USER INPUT: {userMessage}
ASSISTANT RESPONSE: {assistantResponse}

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
  "shouldSummarize": boolean,
  "reasoning": "Brief explanation of extraction decisions"
}

EXAMPLES:
✅ GOOD: "User prefers Python for data tasks"
❌ BAD: "User said they like Python"
✅ GOOD: "Project deadline is March 15, 2026"
❌ BAD: "We talked about deadlines"
```

---

## 4. Code Quality Standards

### 4.1 TypeScript Conventions

- **Strict Mode**: Always enable `strict: true`
- **No Any**: Avoid `any`, use `unknown` or proper types
- **Explicit Returns**: Always declare return types
- **Null Safety**: Use optional chaining and nullish coalescing
- **Immutability**: Prefer `const`, use `readonly` for interfaces

### 4.2 Error Handling

```typescript
// ALWAYS use Result types, never throw in core logic
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Example
async function embedText(text: string): Promise<Result<number[]>> {
  try {
    const embedding = await gemini.embed(text);
    return { ok: true, value: embedding };
  } catch (error) {
    return { ok: false, error: new Error("Embedding failed") };
  }
}
```

### 4.3 Logging Strategy

```typescript
// Use structured logging
logger.info("Memory retrieved", {
  queryEmbeddingTime: 45,
  resultsCount: 10,
  topRelevance: 0.89,
  cacheHit: false,
});

// Never log sensitive data
logger.debug("User input received", { length: input.length }); // ✅
logger.debug("User input", { input }); // ❌
```

### 4.4 File Structure

```
momo/
├── src/
│   ├── core/
│   │   ├── agent.ts           # Main execution loop
│   │   ├── memory.ts          # Memory manager
│   │   └── prompts.ts         # Prompt templates
│   ├── services/
│   │   ├── gemini.ts          # Gemini API wrapper
│   │   ├── embeddings.ts      # Vector operations
│   │   └── storage.ts         # SQLite layer
│   ├── types/
│   │   ├── memory.ts          # Memory interfaces
│   │   └── index.ts           # Shared types
│   ├── utils/
│   │   ├── logger.ts          # Logging
│   │   └── config.ts          # Configuration
│   └── index.ts               # CLI entry point
├── db/
│   └── schema.sql             # Database schema
├── tests/
│   └── *.test.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5. Performance Targets

| Metric               | Target              | Critical Threshold |
| -------------------- | ------------------- | ------------------ |
| Query latency        | < 200ms             | < 500ms            |
| Embedding time       | < 100ms             | < 300ms            |
| Memory retrieval     | < 50ms              | < 150ms            |
| Context construction | < 10ms              | < 50ms             |
| Prompt size          | < 4KB               | < 8KB              |
| LTM database size    | < 100MB/1K memories | < 1GB              |
| Memory per session   | < 512MB             | < 1GB              |

---

## 6. Testing Requirements

### 6.1 Core Tests (Non-Negotiable)

1. **Memory Persistence**: Restart → Recall test
2. **Retrieval Accuracy**: Relevant results in top-K
3. **Noise Filtering**: Trivial input → No storage
4. **Summarization**: 100 memories → 10 summary entries
5. **Prompt Bounds**: Never exceed 8KB context
6. **Decay Logic**: Old memories decrease relevance
7. **Conflict Resolution**: Recent overrides old

### 6.2 Integration Tests

```typescript
describe("Agent Memory System", () => {
  it("should remember facts across restarts", async () => {
    await agent.process("My name is Alice");
    await agent.restart();
    const response = await agent.process("What is my name?");
    expect(response).toContain("Alice");
  });

  it("should retrieve only relevant memories", async () => {
    await agent.process("I love pizza");
    await agent.process("I hate rain");
    const memories = await agent.retrieveMemories("food preferences");
    expect(memories).toContainEqual({ content: "I love pizza" });
    expect(memories).not.toContainEqual({ content: "I hate rain" });
  });
});
```

---

## 7. Implementation Phases

### Phase 1: Foundation

- [ ] Initialize TypeScript project
- [ ] Setup Gemini API client
- [ ] Create SQLite schema
- [ ] Implement basic vector similarity

### Phase 2: Core Loop

- [ ] Build agent execution pipeline
- [ ] Implement memory retrieval
- [ ] Create prompt construction
- [ ] Connect Gemini reasoning

### Phase 3: Intelligence

- [ ] Memory extraction logic
- [ ] Noise filtering rules
- [ ] Relevance scoring
- [ ] Summarization engine

### Phase 4: Scale & Polish

- [ ] Memory maintenance
- [ ] CLI interface
- [ ] Logging & debugging
- [ ] Performance optimization

---

## 8. Success Criteria (Exit Conditions)

**You are done when ALL are true:**

1. ✅ Agent remembers facts across process restarts
2. ✅ Retrieval returns relevant context (not random)
3. ✅ Prompt size stays < 8KB regardless of memory size
4. ✅ Old memories are compressed into summaries
5. ✅ Memory improves answer quality (measurable)
6. ✅ No crashes with 1000+ memories
7. ✅ Maintenance runs without blocking UX

---

## 9. Anti-Patterns (Never Do This)

❌ **Don't dump entire conversation history into prompts**
✅ Retrieve top-K relevant memories only

❌ **Don't store everything the user says**
✅ Filter for meaningful, reusable information

❌ **Don't use LLM context as memory**
✅ Context is temporary, memory is persistent

❌ **Don't block on maintenance operations**
✅ Run cleanup in background or async

❌ **Don't ignore error handling**
✅ Use Result types, never throw in core paths

❌ **Don't hardcode prompts in logic files**
✅ Centralize in `prompts.ts` as templates

---

## 10. Configuration

### Environment Variables

```bash
# Gemini API
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash-exp  # or gemini-pro

# Memory Settings
MEMORY_DB_PATH=./db/memory.db
MEMORY_TOP_K=10
MEMORY_RELEVANCE_THRESHOLD=0.65
MEMORY_DECAY_RATE=0.05  # per week
MEMORY_SUMMARY_THRESHOLD=100  # memories

# Performance
MAX_PROMPT_SIZE=8192  # bytes
EMBEDDING_CACHE_SIZE=1000
VECTOR_SEARCH_BATCH_SIZE=50

# Logging
LOG_LEVEL=info  # debug, info, warn, error
LOG_FILE=./logs/momo.log
```

---

## 11. Development Workflow

1. **Start with tests**: Write test first, then implement
2. **Type everything**: No `any`, explicit return types
3. **Log extensively**: Structured logs for debugging
4. **Profile regularly**: Check memory/CPU usage
5. **Review prompts**: Test with real examples
6. **Validate retrieval**: Check top-K relevance
7. **Monitor maintenance**: Ensure cleanup runs

---

## 12. References

- **Manthan Gupta / OpenClaw**: Memory ≠ Context
- **Vector Similarity**: Cosine similarity for embeddings
- **SQLite**: Persistent storage with vector extension
- **Gemini API**: Text generation + embeddings
- **Result Types**: Railway-oriented programming

---

**Last Updated**: February 6, 2026
**Version**: 1.0.0
**Status**: Implementation Ready
