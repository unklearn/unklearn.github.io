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

export function routeArticle(route: Route, mode: string) {
  return route === routes.lastApple ||
    (route === routes.home && mode === 'release')
    ? articleIds.lastApple
    : articleIds.foundations;
}
