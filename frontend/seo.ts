/**
 * What search engines and link previews see.
 *
 * The app renders in the browser, so crawlers and chat apps (WhatsApp,
 * Telegram, X) that do not run JavaScript only ever saw the generic home-page
 * tags. Here the server fills in the title, description and photo of the place
 * or governorate a link points to, makes the share image an absolute URL (a
 * relative og:image is ignored by most previewers), and serves robots.txt and a
 * sitemap of every published place.
 */
import type express from "express";

interface PreviewLocation {
  id: string;
  name: string;
  arabicName?: string | null;
  description?: string | null;
  arabicDescription?: string | null;
  coverImageUrl?: string | null;
  governorateId?: string | null;
}

interface PreviewGovernorate {
  id: string;
  name: string;
  arabicName?: string | null;
  description?: string | null;
  arabicDescription?: string | null;
}

interface Preview {
  title: string;
  description: string;
  image?: string;
}

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteUrl(req: express.Request) {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  return configured || `${req.protocol}://${req.get("host")}`;
}

export function createSeo(apiBase: string) {
  async function fetchJson<T>(path: string): Promise<T | null> {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T | null;
    let value: T | null = null;
    try {
      const response = await fetch(`${apiBase}${path}`, {
        signal: AbortSignal.timeout(4000),
        headers: { "x-hikaya-internal-token": process.env.HIKAYA_INTERNAL_TOKEN || "" },
      });
      if (response.ok) value = (await response.json()) as T;
    } catch {
      // A preview is a nicety: on any failure the generic tags are kept.
    }
    cache.set(path, { at: Date.now(), value });
    return value;
  }

  async function previewFor(pathname: string): Promise<Preview | null> {
    const place = pathname.match(/^\/locations\/([a-z0-9-]+)\/?$/i);
    if (place) {
      const location = await fetchJson<PreviewLocation>(`/locations/${place[1]}`);
      if (!location) return null;
      const arabic = location.arabicName || location.name;
      return {
        title: `${arabic} · ${location.name} | حكاية Hikaya`,
        description: location.arabicDescription || location.description || "",
        image: location.coverImageUrl || undefined,
      };
    }
    const area = pathname.match(/^\/governorates\/([a-z0-9-]+)\/?$/i);
    if (area) {
      const governorate = await fetchJson<PreviewGovernorate>(`/governorates/${area[1]}`);
      if (!governorate) return null;
      return {
        title: `${governorate.arabicName || governorate.name} · ${governorate.name} | حكاية Hikaya`,
        description: governorate.arabicDescription || governorate.description || "",
      };
    }
    return null;
  }

  /** index.html with link-preview tags for this address. */
  async function renderIndex(html: string, req: express.Request): Promise<string> {
    const site = siteUrl(req);
    let page = html.replace(/content="\/(social-card\.png)"/g, `content="${site}/$1"`);
    const canonical = `${site}${req.path === "/" ? "/" : req.path.replace(/\/+$/, "")}`;
    page = page.replace(
      "</head>",
      `    <meta property="og:url" content="${escapeHtml(canonical)}" />\n    <link rel="canonical" href="${escapeHtml(canonical)}" />\n  </head>`,
    );
    const preview = await previewFor(req.path);
    if (!preview) return page;
    const title = escapeHtml(preview.title);
    const description = escapeHtml(preview.description.slice(0, 280));
    page = page
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"/g, `$1${title}"`);
    if (description) {
      page = page.replace(
        /(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"/g,
        `$1${description}"`,
      );
    }
    if (preview.image) {
      const image = escapeHtml(preview.image);
      page = page
        .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*"/g, `$1${image}"`)
        .replace(/\s*<meta property="og:image:(?:width|height)" content="[^"]*" \/>/g, "");
    }
    return page;
  }

  function register(app: express.Express) {
    app.get("/robots.txt", (req, res) => {
      res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nDisallow: /me\n\nSitemap: ${siteUrl(req)}/sitemap.xml\n`);
    });

    app.get("/sitemap.xml", async (req, res) => {
      const site = siteUrl(req);
      const [locations, governorates] = await Promise.all([
        fetchJson<PreviewLocation[]>("/locations?scope=all"),
        fetchJson<PreviewGovernorate[]>("/governorates"),
      ]);
      const paths = [
        "/", "/jerusalem", "/palestine-map", "/map", "/palestine-connections", "/create-story", "/contribute", "/about",
        ...(governorates ?? []).map((item) => `/governorates/${item.id}`),
        ...(locations ?? []).map((item) => `/locations/${item.id}`),
      ];
      const urls = [...new Set(paths)].map((path) => `  <url><loc>${escapeHtml(site + path)}</loc></url>`).join("\n");
      res
        .type("application/xml")
        .set("Cache-Control", "public, max-age=3600")
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    });
  }

  return { register, renderIndex };
}
