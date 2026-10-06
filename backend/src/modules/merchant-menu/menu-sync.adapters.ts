export type MenuManifest = {
  snapshotId: string;
  observedAt: string;
  expectedPages: number;
  mode: "COMPLETE" | "DELTA";
};
export type MenuSyncAdapter = {
  configured: boolean;
  // Implement only after verifying the supplier's official contract and permission.
  // The job key must return the same immutable snapshot on retries and restarts.
  snapshot(supplierId: string, jobKey: string, signal: AbortSignal): Promise<MenuManifest>;
  page(
    supplierId: string,
    manifest: MenuManifest,
    page: number,
    signal: AbortSignal,
  ): Promise<unknown[]>;
};
export type MenuAdapterRegistry = ReadonlyMap<string, MenuSyncAdapter>;
// No vendor is guessed. Authorized live adapters are added after task 3.1/3.8.
export const menuAdapters: MenuAdapterRegistry = new Map();
export function menuSyncEnabled(env = process.env) {
  if (env.MENU_SYNC_WORKER_ENABLED && !["true", "false"].includes(env.MENU_SYNC_WORKER_ENABLED))
    throw new Error("Invalid MENU_SYNC_WORKER_ENABLED");
  return env.WORKER_ENABLED === "true" && env.MENU_SYNC_WORKER_ENABLED === "true";
}
