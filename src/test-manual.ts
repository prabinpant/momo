/**
 * Manual testing playground for Momory
 * Run: npm run test:manual
 */

import { initializeStorage } from './services/index.js';
import {
  saveMemory,
  getAllMemories,
  countMemories,
  saveSummary,
  getAllSummaryChunks,
} from './core/memory.js';
import { generateText, generateEmbedding } from './services/gemini.js';
import { cosineSimilarity } from './utils/vector.js';
import { chunkText } from './utils/chunking.js';

async function testGeminiAPI() {
  console.log('\n=== TEST 1: Gemini API ===');

  const textResult = await generateText('Say hello in one word');
  if (textResult.ok) {
    console.log('✅ Text generation works:', textResult.value);
  } else {
    console.log('❌ Text generation failed:', textResult.error.message);
  }

  const embeddingResult = await generateEmbedding('test text');
  if (embeddingResult.ok) {
    console.log(
      '✅ Embedding works. Dimensions:',
      embeddingResult.value.length
    );
  } else {
    console.log('❌ Embedding failed:', embeddingResult.error.message);
  }
}

async function testMemoryStorage() {
  console.log('\n=== TEST 2: Memory Storage ===');

  // Save a test memory
  const memoryResult = await saveMemory({
    type: 'preference',
    content: 'User prefers Python for data science',
    confidence: 0.95,
    tags: ['programming', 'python'],
  });

  if (memoryResult.ok) {
    console.log('✅ Memory saved:', memoryResult.value.id);
    console.log('   Content:', memoryResult.value.content);
    console.log(
      '   Embedding dimensions:',
      memoryResult.value.embedding.length
    );
  } else {
    console.log('❌ Memory save failed:', memoryResult.error.message);
  }

  // Count memories
  const countResult = await countMemories();
  if (countResult.ok) {
    console.log('✅ Total memories:', countResult.value);
  }

  // Get all memories
  const allResult = await getAllMemories();
  if (allResult.ok) {
    console.log('✅ Retrieved memories:', allResult.value.length);
    allResult.value.forEach((m, i) => {
      console.log(`   ${i + 1}. [${m.type}] ${m.content.substring(0, 50)}...`);
    });
  }
}

async function testVectorSimilarity() {
  console.log('\n=== TEST 3: Vector Similarity ===');

  const text1 = 'User prefers Python programming';
  const text2 = 'User likes Python for coding';
  const text3 = 'User loves pizza and pasta';

  const emb1Result = await generateEmbedding(text1);
  const emb2Result = await generateEmbedding(text2);
  const emb3Result = await generateEmbedding(text3);

  if (emb1Result.ok && emb2Result.ok && emb3Result.ok) {
    const sim12 = cosineSimilarity(emb1Result.value, emb2Result.value);
    const sim13 = cosineSimilarity(emb1Result.value, emb3Result.value);

    console.log('✅ Similarity tests:');
    console.log(`   "${text1}" vs "${text2}": ${sim12.toFixed(3)}`);
    console.log(`   "${text1}" vs "${text3}": ${sim13.toFixed(3)}`);
    console.log('   (Higher = more similar)');
  }
}

async function testChunking() {
  console.log('\n=== TEST 4: Chunking ===');

  const longText = `
Programming Background:
User is a senior Python developer with 10 years of experience.
Specializes in data science and machine learning projects.
Currently building a recommendation system using TensorFlow.
Prefers PostgreSQL for database work due to analytics capabilities.

Food Preferences:
User has strong preferences for Italian cuisine.
Loves pizza with mushrooms and olives but dislikes pineapple.
Favorite restaurant is Luigi's downtown.
Also enjoys pasta carbonara and tiramisu.

Travel History:
User traveled to Japan in March 2025.
Particularly loved Kyoto's temples and gardens.
Plans to visit Iceland next summer.
Enjoys hiking and landscape photography during trips.
`.trim();

  const chunks = chunkText(longText, { maxChars: 200, overlapChars: 40 });

  console.log('✅ Chunking works:');
  console.log(`   Original length: ${longText.length} chars`);
  console.log(`   Number of chunks: ${chunks.length}`);
  chunks.forEach((chunk, i) => {
    console.log(
      `\n   Chunk ${i + 1} (lines ${chunk.startLine}-${chunk.endLine}):`
    );
    console.log(`   "${chunk.text.substring(0, 80)}..."`);
  });
}

async function testSummarySaving() {
  console.log('\n=== TEST 5: Summary with Chunks ===');

  const summaryText = `
User Profile Summary:
- Senior Python developer (10 years experience)
- Data science specialist
- Currently working on ML recommendation system
- Prefers PostgreSQL for analytics
- Favorite food: Italian (pizza, pasta)
- Recent travel: Japan (March 2025)
- Hobbies: hiking, photography
`.trim();

  const summaryResult = await saveSummary(
    {
      timeWindow: 'monthly',
      startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endDate: Date.now(),
      memoryCount: 10,
      createdAt: Date.now(),
    },
    summaryText
  );

  if (summaryResult.ok) {
    console.log('✅ Summary saved:', summaryResult.value.id);
    console.log('   Memory count:', summaryResult.value.memoryCount);

    // Get chunks
    const chunksResult = await getAllSummaryChunks();
    if (chunksResult.ok) {
      console.log('✅ Summary chunks:', chunksResult.value.length);
      chunksResult.value.forEach((chunk, i) => {
        console.log(`\n   Chunk ${i + 1}:`);
        console.log(`   Content: "${chunk.content.substring(0, 60)}..."`);
        console.log(`   Lines: ${chunk.startLine}-${chunk.endLine}`);
        console.log(`   Embedding dims: ${chunk.embedding.length}`);
      });
    }
  } else {
    console.log('❌ Summary save failed:', summaryResult.error.message);
  }
}

async function showDatabaseState() {
  console.log('\n=== DATABASE STATE ===');

  const memoryCount = await countMemories();
  const allMemories = await getAllMemories();
  const allChunks = await getAllSummaryChunks();

  console.log('\nMemories Table:');
  console.log(`  Total: ${memoryCount.ok ? memoryCount.value : 'error'}`);

  if (allMemories.ok && allMemories.value.length > 0) {
    console.log('\n  Recent memories:');
    allMemories.value.slice(0, 5).forEach((m, i) => {
      console.log(`    ${i + 1}. [${m.type}] ${m.content}`);
      console.log(`       Tags: ${m.metadata.tags.join(', ')}`);
      console.log(`       Relevance: ${m.metadata.relevanceScore}`);
    });
  }

  console.log('\nSummary Chunks Table:');
  console.log(
    `  Total chunks: ${allChunks.ok ? allChunks.value.length : 'error'}`
  );

  if (allChunks.ok && allChunks.value.length > 0) {
    console.log('\n  Chunks:');
    allChunks.value.forEach((c, i) => {
      console.log(`    ${i + 1}. Summary: ${c.summaryId}`);
      console.log(`       Preview: "${c.content.substring(0, 60)}..."`);
    });
  }
}

async function main() {
  try {
    console.log('🚀 Momory Manual Testing Playground\n');
    console.log('This will test all components built so far.\n');

    // Initialize storage
    initializeStorage();
    console.log('✅ Database initialized\n');

    // Run tests
    await testGeminiAPI();
    await testMemoryStorage();
    await testVectorSimilarity();
    await testChunking();
    await testSummarySaving();
    await showDatabaseState();

    console.log('\n✅ All tests complete!');
    console.log('\nYou can now:');
    console.log('  1. Check ./db/memory.db with SQLite browser');
    console.log('  2. Run this script multiple times to add more data');
    console.log('  3. Modify tests to try different inputs\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
