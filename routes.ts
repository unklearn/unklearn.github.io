// Canonical directory routes for the static build.
export const routes = {
  home: '/',
  foundations: '/foundations/',
  lastApple: '/labs/last-apple/',
} as const;

export type Route = (typeof routes)[keyof typeof routes];

export const articleIds = {
  foundations: 'what-makes-scout-an-agent',
  lastApple: 'last-apple',
} as const;

export const routeArticles = {
  [routes.home]: undefined,
  [routes.foundations]: articleIds.foundations,
  [routes.lastApple]: articleIds.lastApple,
} as const;
