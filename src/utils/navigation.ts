import { DashboardSection } from '../types/absa';

export type AppLayer = 'welcome' | 'workspace' | 'module';

export interface RouteState {
  layer: AppLayer;
  section: DashboardSection;
}

export const MODULE_PATHS: Record<DashboardSection, string> = {
  [DashboardSection.Workbench]: '/workspace/statement-analyzer',
  [DashboardSection.BatchIngestion]: '/workspace/batch-intelligence',
  [DashboardSection.Conversation]: '/workspace/conversation-analyzer',
  [DashboardSection.Benchmarks]: '/workspace/model-comparison',
  [DashboardSection.Analytics]: '/workspace/analytics-insights',
  [DashboardSection.History]: '/workspace/analysis-history',
};

const PATH_TO_SECTION = new Map<string, DashboardSection>(
  (Object.entries(MODULE_PATHS) as Array<[DashboardSection, string]>).map(([section, path]) => [
    path,
    section,
  ])
);

export function parseRouteFromLocation(pathname: string = window.location.pathname): RouteState {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/' || normalized === '') {
    return { layer: 'welcome', section: DashboardSection.Workbench };
  }

  if (normalized === '/workspace') {
    return { layer: 'workspace', section: DashboardSection.Workbench };
  }

  const matchedSection = PATH_TO_SECTION.get(normalized);
  if (matchedSection) {
    return { layer: 'module', section: matchedSection };
  }

  // Graceful fallback to welcome page for unknown paths
  return { layer: 'welcome', section: DashboardSection.Workbench };
}

export function getPathForRoute(route: RouteState): string {
  if (route.layer === 'welcome') return '/';
  if (route.layer === 'workspace') return '/workspace';
  return MODULE_PATHS[route.section] ?? '/workspace/statement-analyzer';
}
