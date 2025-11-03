// Netlify function: fetch live price/logo from Atom "name" pages with robust parsing.

function atomUrlFromDomain(domain) {
  const clean = String(domain || "").trim();
  const isCom = /\.com$/i.test(clean);
  const slug = isCom ? clean.replace(/\.com$/i, "") : clean; // ChicDrift.com -> ChicDrift
  return `https://www.atom.com/name/${encodeURIComponent(slug)}`;
}

function safeJSONParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function* walk(obj) {
  if (Array.isArray(obj)) {
    for (const v of obj) yield* walk(v);
  } else if (obj && typeof obj === "object") {
    yield obj;
    for (const k of Object.keys(obj)) yield* walk(obj[k]);
  }
}

function parseFromJSONLD(html) {
  // Grab all <script type="application/ld+json"> blocks
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]);

  for (const raw of scripts) {
    // Some sites embed multiple JSONs or HTML comments in one block
    const candidates = raw
      .split("</script>")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const c of candidates) {
      const j = safeJSONParse(c);
      if (!j) continue;

      for (const node of walk(j)) {
        // Schema.org Product -> offers.price
        if (node && node.offers && (node.offers.price || (node.offers[0] && node.offers[0].price))) {
          const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          const priceRaw = String(offer.price ?? "").trim();
          if (priceRaw) {
            const price = /^\$/.test(priceRaw) ? priceRaw : `$${priceRaw}`;
            return { price, isRequest: false };
          }
        }
        // Sometimes there's a generic "price" field
        if (node && typeof node.price !== "undefined") {
          const priceRaw = String(node.price ?? "").trim();
          if (priceRaw) {
            const price = /^\$/.test(priceRaw) ? priceRaw : `$${priceRaw}`;
            return { price, isRequest: false };
          }
        }
      }
    }
  }
  return null;
}

function parseFromMeta(html) {
  // e.g. <meta itemprop="price" content="1288">
  const m = html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i);
  if (m) {
    const raw = m[1].trim();
    if (raw) return { price: /^\$/.test(raw) ? raw : `$${raw}`, isRequest: false };
  }
  return null;
}

function parseFromPriceSpan(html) {
  // Matches <span class="price-show">…</span> and similar
  const m = html.match(/<span[^>]*class=["'][^"']*price-show[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if (m) {
    const txt = m[1].replace(/<[^>]*>/g, "").trim();
    if (/price\s*request/i.test(txt) || /request\s*price/i.test(txt)) {
      return { price: "Price Request", isRequest: true };
    }
    if (/\d/.test(txt)) return { price: txt, isRequest: false };
  }
  return null;
}

function parseFromDollarPattern(html) {
  // As a final fallback, grab the first $1,234-like pattern near “price”
  const blockMatch = html.match(/.{0,200}(price|amount|cost).{0,200}/i);
  const block = blockMatch ? blockMatch[0] : html.slice(0, 2000);
  const m = block.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  if (m) return { price: m[0].replace(/\s+/g, ""), isRequest: false };
  return null;
}

function parseLogo(html) {
  // Prefer og:image
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1];

  // Fallback to first logo-image url
  const img = html.match(/<img[^>]+src=["']([^"']+logo-image[^"']+)["'][^>]*>/i);
  if (img) return img[1];

  return undefined;
}

function parsePrice(html) {
  // 1) Explicit "Price Request"
  if (/Price\s*Request/i.test(html) || /Request\s*Price/i.test(html)) {
    return { price: "Price Request", isRequest: true, logo: parseLogo(html) };
  }

  // 2) JSON-LD (most reliable when present)
  const j = parseFromJSONLD(html);
  if (j) return { ...j, logo: parseLogo(html) };

  // 3) <meta itemprop="price" content="...">
  const m = parseFromMeta(html);
  if (m) return { ...m, logo: parseLogo(html) };

  // 4) <span class="price-show">...</span>
  const s = parseFromPriceSpan(html);
  if (s) return { ...s, logo: parseLogo(html) };

  // 5) Dollar-pattern fallback
  const d = parseFromDollarPattern(html);
  if (d) return { ...d, logo: parseLogo(html) };

  // Default
  return { price: "Price Request", isRequest: true, logo: parseLogo(html) };
}

exports.handler = async (event) => {
  const domain = (event.queryStringParameters?.domain || "").trim();
  if (!domain) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing ?domain=example.com" }) };
  }

  const url = atomUrlFromDomain(domain);

  try {
    const resp = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.atom.com/",
      },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ error: `Upstream ${resp.status}`, url }),
      };
    }

    const html = await resp.text();
    const parsed = parsePrice(html);

    // Short cache while testing (5 minutes). Raise later if you like.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
      },
      body: JSON.stringify({ domain, url, ...parsed }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fetch failed", message: String(err), url }),
    };
  }
};
