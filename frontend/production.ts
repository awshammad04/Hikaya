import type { Express, RequestHandler } from "express";

export const isProduction = process.env.NODE_ENV === "production";

export function backendUrl() {
  const value = process.env.HIKAYA_API_BASE_URL ||
    (process.env.HIKAYA_API_HOSTPORT ? `http://${process.env.HIKAYA_API_HOSTPORT}/api/v1` : "");
  if (isProduction && !value) throw new Error("HIKAYA_API_BASE_URL or HIKAYA_API_HOSTPORT is required.");
  return (value || "http://127.0.0.1:3000/api/v1").replace(/\/+$/, "");
}

/** Limits are per process. Keep one frontend instance; provider budgets remain essential. */
export function installProductionControls(app: Express) {
  app.disable("x-powered-by");
  if (!isProduction) return;
  if (!process.env.HIKAYA_INTERNAL_TOKEN || !process.env.APP_URL) {
    throw new Error("APP_URL and HIKAYA_INTERNAL_TOKEN are required in production.");
  }
  // Render terminates TLS at one trusted ingress hop. Never trust arbitrary XFF chains.
  app.set("trust proxy", 1);
  const origins = new Set([process.env.APP_URL, process.env.RENDER_EXTERNAL_URL].filter(Boolean));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") && !origins.has(req.get("origin"))) {
      return res.status(403).json({ message: "Request origin is not allowed." });
    }
    next();
  });
  app.use("/api", requestLimit(300, 600, 60_000, false));
  const aiLimit = requestLimit(20, Number(process.env.AI_REQUESTS_PER_HOUR || 200), 3_600_000, true);
  const videoLimit = requestLimit(3, Number(process.env.VIDEO_REQUESTS_PER_HOUR || 10), 3_600_000, true);
  const contributionLimit = requestLimit(10, 100, 3_600_000, false);
  app.use((req, res, next) => {
    if (req.method !== "POST") return next();
    if (req.path === "/api/generate-video") return videoLimit(req, res, next);
    if (/^\/api\/(tts(?:-stream)?|generate-story|v1\/(ai\/.*|journeys))$/.test(req.path)) return aiLimit(req, res, next);
    if (["/api/contribute", "/api/v1/contributions"].includes(req.path)) return contributionLimit(req, res, next);
    next();
  });
}

function requestLimit(perIp: number, globalLimit: number, windowMs: number, boundConcurrency: boolean): RequestHandler {
  if (!Number.isInteger(globalLimit) || globalLimit < 1) throw new Error("Invalid request budget.");
  let expires = 0;
  let total = 0;
  let active = 0;
  const clients = new Map<string, number>();
  return (req, res, next) => {
    if (Date.now() >= expires) {
      expires = Date.now() + windowMs;
      total = 0;
      clients.clear();
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const count = clients.get(ip) || 0;
    if (count >= perIp || total >= globalLimit || (boundConcurrency && active >= 3)) {
      res.setHeader("Retry-After", String(boundConcurrency && active >= 3 ? 30 : Math.ceil((expires - Date.now()) / 1000)));
      return res.status(429).json({ message: "Usage limit reached. Please try again later." });
    }
    clients.set(ip, count + 1);
    total += 1;
    if (boundConcurrency) {
      active += 1;
      let released = false;
      const release = () => { if (!released) { released = true; active -= 1; } };
      res.once("finish", release);
      res.once("close", release);
    }
    next();
  };
}
