// Error Solution types for local knowledge base
export interface ErrorSolution {
  id: string;
  title: string;
  errorMessage: string;
  errorType: ErrorType;
  context: string;
  rootCause: string;
  solution: string;
  codeChanges?: string;
  tags: string[];
  labels?: string[];
  cliLibraryId?: string;
  createdAt: string;
  projectPath?: string;
  environment?: Record<string, unknown>;
}

export interface SolutionSearchResult {
  id: string;
  title: string;
  errorType: string;
  tags: string[];
  createdAt: string;
  score?: number;
  similarity?: number;
  preview?: string;
}

export type ErrorType =
  | "compile"
  | "runtime"
  | "configuration"
  | "dependency"
  | "network"
  | "logic"
  | "performance"
  | "security"
  | "other";

export type SearchMode = "semantic" | "hybrid" | "sparse";

export interface SearchOptions {
  mode?: SearchMode;
  denseWeight?: number;
  sparseWeight?: number;
  coarseLimit?: number;
}

export interface Context7Query {
  libraryId: string;
  topic?: string;
  page?: number;
  forceRefresh?: boolean;
  apiKey?: string;
}
