import handleRequest from "../server/index.js";

export default function handler(req, res) {
  // Vercel's splat rewrite exposes the original path segments on req.query.path
  // and changes req.url to the function route. Restore the app's /api/... path
  // before passing it to the shared API router.
  const routePath = req.query?.path;
  if (routePath) {
    const segments = (Array.isArray(routePath) ? routePath : String(routePath).split("/"))
      .filter(Boolean)
      .map((segment) => encodeURIComponent(String(segment)));
    const currentUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    currentUrl.searchParams.delete("path");
    currentUrl.searchParams.delete("path[]");
    const query = currentUrl.searchParams.toString();
    req.url = `/api/${segments.join("/")}${query ? `?${query}` : ""}`;
  }

  return handleRequest(req, res);
}
