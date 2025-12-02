/**
 * Embeddings module for semantic search using local transformer model
 * Uses all-MiniLM-L6-v2 for generating 384-dimensional embeddings
 */

// Dynamic import for transformers.js
type EmbeddingExtractor = (
  text: string,
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array }>;

let pipelineFactory: (typeof import("@xenova/transformers"))["pipeline"] | null = null;
let embeddingPipeline: EmbeddingExtractor | null = null;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;

/**
 * Initialize the embedding pipeline (lazy loading)
 */
async function initPipeline(): Promise<EmbeddingExtractor> {
  if (embeddingPipeline) return embeddingPipeline;

  if (!pipelineFactory) {
    const transformers = await import("@xenova/transformers");
    pipelineFactory = transformers.pipeline;
  }

  console.error("Loading embedding model (first time may take a moment)...");
  const extractor = await pipelineFactory("feature-extraction", MODEL_NAME, {
    quantized: true, // Use quantized model for faster inference
  });
  if (typeof extractor !== "function") {
    throw new Error("Transformer pipeline did not return a callable extractor");
  }
  embeddingPipeline = extractor as EmbeddingExtractor;
  console.error("Embedding model loaded successfully.");

  return embeddingPipeline;
}

/**
 * Generate embedding vector for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await initPipeline();

  // Truncate text if too long (model max is 512 tokens, ~2000 chars)
  const truncatedText = text.slice(0, 2000);

  const output = await extractor(truncatedText, {
    pooling: "mean",
    normalize: true,
  });

  // Convert to regular array
  return Array.from(output.data);
}

/**
 * Generate embedding for an error solution
 * Combines multiple fields for better semantic matching
 */
export async function generateSolutionEmbedding(solution: {
  title: string;
  errorMessage: string;
  context: string;
  rootCause: string;
  solution: string;
  tags: string[];
  environmentText?: string;
  labelsText?: string;
}): Promise<number[]> {
  // Combine fields with weights (title and error message are most important)
  const combinedText = [
    solution.title,
    solution.title, // Repeat title for emphasis
    solution.errorMessage,
    solution.context,
    solution.rootCause,
    solution.solution.slice(0, 500), // Truncate long solutions
    solution.tags.join(" "),
    solution.environmentText || "",
    solution.labelsText || "",
  ].join(" ");

  return generateEmbedding(combinedText);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Serialize embedding to Buffer for SQLite storage
 */
export function serializeEmbedding(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 4); // 4 bytes per float
  for (let i = 0; i < embedding.length; i++) {
    buffer.writeFloatLE(embedding[i], i * 4);
  }
  return buffer;
}

/**
 * Deserialize embedding from SQLite Buffer
 */
export function deserializeEmbedding(buffer: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i));
  }
  return embedding;
}

/**
 * Get embedding dimension
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIM;
}
