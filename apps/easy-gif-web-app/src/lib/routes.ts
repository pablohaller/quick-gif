// App routes
export const HOME = "/";
export const OUTPUTS = "/outputs";
export const SETTINGS = "/settings";
export const EDIT = "/edit/:name";
export const BATCH = "/batch";

// API paths
export const API_VIDEOS = "/api/videos";
export const API_MEDIA = "/api/media";
export const API_THUMB = "/api/thumb";
export const API_EXPORT = "/api/export";
export const API_ESTIMATE = "/api/estimate";
export const API_GIF = "/api/gif";
export const API_OUTPUTS = "/api/outputs";
export const API_PROBE = "/api/probe";
export const API_BROWSE = "/api/browse";
export const API_CACHE = "/api/cache";
export const API_UPLOAD = "/api/upload";

export const generateRoute = (
  route: string,
  params: Record<string, string>,
) =>
  Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(`:${key}`, encodeURIComponent(value)),
    route,
  );
