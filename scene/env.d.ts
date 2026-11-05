/// <reference types="vite/client" />
declare module '*.mdx' {
  export const meta: import('../article-sets/scout-foundations/session.ts').StepMeta;
  export const blocks: Record<string, import('../runtime/lesson-types.ts').StoredCode>;
  const Content: import('react').ComponentType;
  export default Content;
}
