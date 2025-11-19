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
  createdAt: string;
  projectPath?: string;
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
