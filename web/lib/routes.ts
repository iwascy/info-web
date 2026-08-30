export function syncTaskHref(taskId: string) {
  return `/sync/${encodeURIComponent(taskId)}`;
}

export function serviceHref(serviceKey: string) {
  return `/services/${encodeURIComponent(serviceKey)}`;
}
