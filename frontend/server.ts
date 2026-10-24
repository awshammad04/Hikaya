import express from "express";
import path from "path";
import net from "net";
import dotenv from "dotenv";
import { backendUrl, installProductionControls, isProduction } from "./production";
import { registerNarration } from "./narration";

dotenv.config();

const app = express();
// 5173 by default so the frontend does not collide with the Hikaya backend,
// which serves the API on 3000.
const PORT = Number(process.env.PORT ?? 5173);
const HIKAYA_API_UPSTREAM = backendUrl();
const API_PROXY_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS || 180000);
if (!Number.isInteger(API_PROXY_TIMEOUT_MS) || API_PROXY_TIMEOUT_MS < 1000) throw new Error("Invalid API_PROXY_TIMEOUT_MS");
installProductionControls(app);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Body parser
app.use(express.json({ limit: isProduction ? "8mb" : "50mb" }));
app.use(express.urlencoded({ limit: isProduction ? "8mb" : "50mb", extended: true }));

/**
 * Same-origin API bridge.
 *
 * The browser always talks to the host that served the page (`/api/v1`). The
 * server can safely reach the Nest API over loopback, so phones never need to
 * know the computer's changing Wi-Fi address and never hit CORS restrictions.
 */
app.use("/api/v1", async (req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_PROXY_TIMEOUT_MS);

  try {
    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD" && req.body !== undefined;
    const upstream = await fetch(`${HIKAYA_API_UPSTREAM}${req.url}`, {
      method,
      signal: controller.signal,
      headers: {
        accept: req.get("accept") ?? "application/json",
        "content-type": req.get("content-type") ?? "application/json",
        "x-hikaya-internal-token": process.env.HIKAYA_INTERNAL_TOKEN || "",
        // Account sessions ride on an HttpOnly cookie set by the API; the
        // client address lets the API throttle password guessing per visitor.
        ...(req.get("cookie") ? { cookie: req.get("cookie")! } : {}),
        "x-forwarded-for": req.ip ?? "",
      },
      body: hasBody ? JSON.stringify(req.body) : undefined,
    });

    const contentType = upstream.headers.get("content-type");
    const retryAfter = upstream.headers.get("retry-after");
    const cacheControl = upstream.headers.get("cache-control");
    const setCookies = upstream.headers.getSetCookie();
    if (retryAfter) res.setHeader("Retry-After", retryAfter);
    if (contentType) res.setHeader("Content-Type", contentType);
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    const payload = Buffer.from(await upstream.arrayBuffer());
    return res.status(upstream.status).send(payload);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    console.error(
      `[Hikaya API proxy] ${timedOut ? "upstream timed out" : "upstream unavailable"}:`,
      error,
    );
    return res.status(502).json({
      message: timedOut
        ? "The Hikaya API did not respond in time."
        : "The Hikaya API is temporarily unavailable.",
    });
  } finally {
    clearTimeout(timer);
  }
});

// Natural narration (Gemini text-to-speech): see narration.ts.
registerNarration(app);

// Serve Vite build in production, or mount Vite middleware in development
const isProd = isProduction;
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
if (!isProd) {
  import("vite").then(async (viteModule) => {
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use((req, res, next) => {
    if (/\.(?:cjs|map)$/i.test(req.path)) return res.status(404).end();
    next();
  });
  app.use(express.static(distPath, { dotfiles: "deny" }));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/** Can something already be reached on this host and port? */
function isInUse(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 700 });
    const done = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

/**
 * Is this port genuinely free on every address `localhost` might resolve to?
 *
 * Checked by *connecting*, not by binding, because binding does not detect the
 * case that actually bites here. Another dev server holding `[::1]:5173` and
 * this one binding the wildcard both succeed - macOS allows a wildcard bind
 * alongside a specific-address bind - and then the more specific listener wins
 * every `localhost` request, because macOS resolves `localhost` to `::1` first.
 * The result is this server logging "running on localhost:5173" while the
 * browser is served somebody else's project entirely.
 *
 * Both loopback families are probed: whichever one `localhost` lands on has to
 * be ours, or the address printed below is a lie.
 */
async function isPortAvailable(port: number): Promise<boolean> {
  const busy = await Promise.all([
    isInUse("127.0.0.1", port),
    isInUse("::1", port),
  ]);
  return !busy.some(Boolean);
}

async function resolvePort(preferred: number, attempts = 10): Promise<number> {
  for (let candidate = preferred; candidate < preferred + attempts; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      if (candidate !== preferred) {
        console.warn(
          `[Hikaya Server] Port ${preferred} is already in use - using ${candidate} instead.`,
        );
      }
      return candidate;
    }
  }
  throw new Error(
    `Ports ${preferred}-${preferred + attempts - 1} are all in use. ` +
      `Free one, or set PORT in frontend/.env.`,
  );
}

void (async () => {
  const port = isProduction ? PORT : await resolvePort(PORT);

  // No host argument: Node binds dual-stack, so `localhost` reaches this
  // server whether it resolves to 127.0.0.1 or ::1.
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`[Hikaya Server] Running on http://localhost:${port}`);
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
})();
