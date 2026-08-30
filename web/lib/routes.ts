export const PIKPAK_MIGRATION_TASK_ID = "pikpak-to-115-migration";
export const PIKPAK_MIGRATION_SERVICE_KEY = "pikpak-to-115";
export const PIKPAK_MIGRATION_HREF = "/migration/pikpak-115";

export function syncTaskHref(taskId: string) {
  return taskId === PIKPAK_MIGRATION_TASK_ID ? PIKPAK_MIGRATION_HREF : `/sync/${taskId}`;
}

export function serviceHref(serviceKey: string) {
  return serviceKey === PIKPAK_MIGRATION_SERVICE_KEY ? PIKPAK_MIGRATION_HREF : `/services/${serviceKey}`;
}
