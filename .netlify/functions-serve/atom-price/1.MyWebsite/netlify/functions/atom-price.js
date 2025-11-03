// ../netlify/functions/atom-price.js
function atomUrlFromDomain(domain) {
  const clean = String(domain || "").trim();
  const isCom = /\.com$/i.test(clean);
  const slug = isCom ? clean.replace(/\.com$/i, "") : clean;
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
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const raw of scripts) {
    const candidates = raw.split("</script>").map((s) => s.trim()).filter(Boolean);
    for (const c of candidates) {
      const j = safeJSONParse(c);
      if (!j) continue;
      for (const node of walk(j)) {
        if (node && node.offers && (node.offers.price || node.offers[0] && node.offers[0].price)) {
          const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          const priceRaw = String(offer.price ?? "").trim();
          if (priceRaw) {
            const price = /^\$/.test(priceRaw) ? priceRaw : `$${priceRaw}`;
            return { price, isRequest: false };
          }
        }
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
  const m = html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i);
  if (m) {
    const raw = m[1].trim();
    if (raw) return { price: /^\$/.test(raw) ? raw : `$${raw}`, isRequest: false };
  }
  return null;
}
function parseFromPriceSpan(html) {
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
  const blockMatch = html.match(/.{0,200}(price|amount|cost).{0,200}/i);
  const block = blockMatch ? blockMatch[0] : html.slice(0, 2e3);
  const m = block.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  if (m) return { price: m[0].replace(/\s+/g, ""), isRequest: false };
  return null;
}
function parseLogo(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1];
  const img = html.match(/<img[^>]+src=["']([^"']+logo-image[^"']+)["'][^>]*>/i);
  if (img) return img[1];
  return void 0;
}
function parsePrice(html) {
  if (/Price\s*Request/i.test(html) || /Request\s*Price/i.test(html)) {
    return { price: "Price Request", isRequest: true, logo: parseLogo(html) };
  }
  const j = parseFromJSONLD(html);
  if (j) return { ...j, logo: parseLogo(html) };
  const m = parseFromMeta(html);
  if (m) return { ...m, logo: parseLogo(html) };
  const s = parseFromPriceSpan(html);
  if (s) return { ...s, logo: parseLogo(html) };
  const d = parseFromDollarPattern(html);
  if (d) return { ...d, logo: parseLogo(html) };
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
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.atom.com/"
      }
    });
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ error: `Upstream ${resp.status}`, url })
      };
    }
    const html = await resp.text();
    const parsed = parsePrice(html);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=3600"
      },
      body: JSON.stringify({ domain, url, ...parsed })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fetch failed", message: String(err), url })
    };
  }
};
//# sourceMappingURL=atom-price.js.map
