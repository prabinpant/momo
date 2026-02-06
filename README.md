# MOMO

**Virtual-Unlimited-Memory AI Agent**

An intelligent AI agent with persistent, scalable memory that operates beyond traditional context window limitations.

## 🎯 What We're Building

MOMO is a local AI agent that fundamentally redefines how AI systems handle memory:

- **Persistent Memory**: Remembers facts, preferences, and decisions across sessions
- **Intelligent Retrieval**: Only retrieves relevant context, never dumps entire history
- **Scalable Architecture**: Handles thousands of memories via retrieval + summarization
- **External Storage**: Memory lives outside the LLM context window in SQLite + vector embeddings

### Core Principle

```
memory ≠ context window
memory = external store + retrieval + compaction + intelligence
```

The LLM (Gemini) is stateless. All memory is external, selective, and retrieved on-demand.

## 🏗️ Architecture

### Memory Types

1. **Short-Term Memory (STM)**
   - Recent conversation turns
   - In-memory only, session-scoped
   - Provides conversation coherence

2. **Long-Term Memory (LTM)**
   - Atomic facts, decisions, preferences, observations
   - Persisted to SQLite with vector embeddings
   - Retrieved via semantic similarity

3. **Summary Memory**
   - Compressed historical context
   - Generated periodically to prevent memory explosion
   - 10:1 compression ratio target

### Agent Execution Loop

Every interaction follows this pipeline:

1. **Receive Input** - User message/task
2. **Retrieve Memory** - Vector search for relevant context
3. **Construct Prompt** - Inject retrieved memories + summaries
4. **LLM Reasoning** - Gemini generates response
5. **Extract Memories** - Decide what's worth remembering
6. **Persist** - Store to LTM with embeddings
7. **Maintenance** - Summarize, decay, prune (conditional)

## 🛠️ Tech Stack

- **Runtime**: Node.js + TypeScript
- **LLM**: Gemini API (text generation + embeddings)
- **Database**: SQLite with vector similarity
- **Architecture**: Result types, strict typing, structured logging

## ✨ Key Features

- ✅ **Cross-Session Recall** - Restart the agent, it still remembers
- ✅ **Relevant Retrieval** - Only injects contextually relevant memories
- ✅ **Bounded Prompts** - Never exceeds 8KB regardless of memory size
- ✅ **Intelligent Filtering** - Ignores trivial information automatically
- ✅ **Memory Decay** - Old, unused memories fade over time
- ✅ **Automatic Summarization** - Compresses old memories periodically

## 🎯 Success Criteria

The agent is considered complete when:

1. Remembers facts across process restarts
2. Retrieval returns relevant context (not random)
3. Prompt size stays bounded
4. Old memories are compressed into summaries
5. Memory improves answer quality over time
6. Handles 1000+ memories without crashes
7. Maintenance runs without blocking UX

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/prabinpant/momo.git
cd momo

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# Run the agent
npm start
```

## 📖 Documentation

See [`.github/instructions/global.instructions.md`](.github/instructions/global.instructions.md) for comprehensive implementation details, code standards, and architectural decisions.

## 🔬 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test memory
npm test retrieval
npm test summarization
```

## 📊 Performance Targets

| Metric           | Target              |
| ---------------- | ------------------- |
| Query latency    | < 200ms             |
| Embedding time   | < 100ms             |
| Memory retrieval | < 50ms              |
| Prompt size      | < 4KB               |
| Database size    | < 100MB/1K memories |

## 🤝 Contributing

This is a focused implementation project. Contributions should align with the core architectural principles outlined in the instructions.

## 📝 License

MIT

---

**Built with**: Gemini API • TypeScript • SQLite • Vector Embeddings
