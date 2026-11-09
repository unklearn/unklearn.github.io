// Canonical directory routes. Vite builds every entry into the same dist folder.
export const routes = {
  foundations: '/',
  lastApple: '/labs/last-apple/',
} as const;

type Route = (typeof routes)[keyof typeof routes];

// Relative links also work when dist is published beneath a site subdirectory.
export function routeLink(from: Route, to: Route) {
  const depth = from.split('/').filter(Boolean).length;
  return '../'.repeat(depth) + to.slice(1) || './';
}
