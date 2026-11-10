export const articleIds = {
  foundations: 'what-makes-scout-an-agent',
  lastApple: 'last-apple',
} as const;

interface Lab {
  path: `/labs/${string}/`;
  title: string;
  description: string;
  cover?: string;
  articleId?: string;
}

export const lastAppleLab = {
  path: '/labs/last-apple/',
  title: 'The Last Apple',
  description:
    'Can Scout pack a picnic without taking the pantry’s last apple? See what changes when you guide the model or enforce the rule.',
  cover: '/art/last-apple.svg',
  articleId: articleIds.lastApple,
} satisfies Lab;

// Add a lab here and put its entry page at the matching directory URL.
export const labs: readonly Lab[] = [lastAppleLab];

export const pages = [
  { kind: 'home', path: '/' },
  {
    kind: 'foundations',
    path: '/foundations/',
    title: 'From a Model to an AI Agent',
    description:
      'Teach an agent runtime by giving Scout, a village courier, tools and feedback.',
    articleId: articleIds.foundations,
  },
  ...labs.map((lab) => ({ ...lab, kind: 'lab' as const })),
] as const;
