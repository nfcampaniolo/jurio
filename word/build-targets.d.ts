export interface BuildTarget {
  url: string;
  envFile: ".env.development" | ".env.production";
  manifestId: string;
  displayName: string;
  webAppUrl: string;
  appCheckDebugToken: boolean;
}

export type TargetName = "development" | "staging" | "production";

export const TARGETS: Record<TargetName, BuildTarget>;
export const SOURCE: BuildTarget;
export function resolveTarget(env?: { target?: string }, mode?: string): BuildTarget & { name: TargetName };
export function transformManifest(xml: string, target: BuildTarget): string;
