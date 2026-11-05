// Ordinary authored source: a frontier model can generate these from a brief and catalogue.
export interface TeachingStage {
  id: string; tools: readonly string[]; actions: readonly string[]; instruction: string;
}
export interface TeachingStep {
  id: string; title: string; checkpoint: string; experiment: string;
  stages: readonly TeachingStage[]; markdown: string; excerpts: readonly string[];
  context?: string; actionLabels?: Record<string, string>;
  terminalDialogue?: string; narration?: { audio?: string; transcript: string };
}

export interface TeachingAction { label: string; whileBusy?: boolean }
export interface ArticleDefinition {
  id: string; setId: string; title: string; directory: string;
  createSteps(content: Record<string, string>): TeachingStep[];
  actions: Readonly<Record<string, TeachingAction>>;
  sourceFiles: readonly string[];
  replayStepId: string;
  legacyStepIds?: readonly string[];
  stepAliases?: Readonly<Record<string, string>>;
}
export interface TeachingArticle extends ArticleDefinition { steps: TeachingStep[] }
