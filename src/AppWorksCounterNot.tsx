import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, Menu, X, ExternalLink } from "lucide-react";

/******************************
 * SIMPLE CONFIG
 ******************************/
const SETTINGS = {
  discountDurationDays: 7, // fallback if discounts.json has no endAt
};

/******************************
 * TYPES
 ******************************/
type PriceType = number | "REQUEST";

type PortfolioItem = {
  name: string;
  type?: string;
  price: PriceType;
  logo?: string;
};

type DiscountConfig = {
  name: string;
  percentOff?: number;
  amountOff?: number;
  overrideLogo?: string;
};

type DiscountsSettings = {
  endAt?: string;
  durationDays?: number;
  version?: number;
};

type DiscountsFile = { items: DiscountConfig[]; settings?: DiscountsSettings };

/******************************
 * HELPERS
 ******************************/
const formatPrice = (p: PriceType) =>
  p === "REQUEST" ? "Request Price" : `$${p.toLocaleString()}`;
const isRequestPrice = (p?: PriceType) => p === "REQUEST";
const roundCurrency = (n: number) => Math.round(n);

const UTM = {
  source: "lindabout.com",
  medium: "portfolio",
  campaign: "outbound",
};

/******************************
 * GLOBAL VISITOR COUNTER
 ******************************/
const COUNTAPI_URL = "https://api.counterapi.dev/v1";
const COUNTAPI_NS = "lindabout.com";
const COUNTAPI_KEY = "visits";

async function getGlobalVisitorCount(): Promise<number> {
  try {
    const res = await fetch(`${COUNTAPI_URL}/${COUNTAPI_NS}/${COUNTAPI_KEY}/incr`);
    if (!res.ok) throw new Error("Request failed");
    const json = await res.json();
    if (typeof json?.count === "number") return json.count;

    // fallback: read without increment
    const res2 = await fetch(`${COUNTAPI_URL}/${COUNTAPI_NS}/${COUNTAPI_KEY}`);
    const json2 = await res2.json();
    if (typeof json2?.count === "number") return json2.count;
    return 0;
  } catch (e) {
    console.warn("Visitor counter error:", e);
    return 0;
  }
}

/******************************
 * LINKS
 ******************************/
const gdLink = (domain: string) => {
  const base = "https://www.godaddy.com/domainsearch/find";
  const params = new URLSearchParams({
    checkAvail: "1",
    domainToCheck: domain,
    utm_source: UTM.source,
    utm_medium: UTM.medium,
    utm_campaign: UTM.campaign,
  });
  return `${base}?${params.toString()}`;
};

const atomLink = (domain: string) => {
  const clean = domain.trim();
  const isCom = /\.com$/i.test(clean);
  const slug = isCom ? clean.replace(/\.com$/i, "") : clean;
  const params = new URLSearchParams(UTM);
  return `https://www.atom.com/name/${encodeURIComponent(slug)}?${params.toString()}`;
};

/******************************
 * JSON LOADER
 ******************************/
async function safeJsonFetch<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      const cleaned = txt.replace(/,\s*(?=[}\]])/g, "");
      return JSON.parse(cleaned);
    }
  } catch (e) {
    console.error("Failed to fetch or parse JSON:", url, e);
    return null;
  }
}

/******************************
 * MAIN APP
 ******************************/
export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    getGlobalVisitorCount().then(setVisitorCount);
  }, []);

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig[]>([]);
  const [discountSettings, setDiscountSettings] = useState<DiscountsSettings | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const raw = await safeJsonFetch<any[]>("/atom-portfolio.json");
      if (!raw) return;
      setPortfolio(
        raw.map((r) => ({
          name: r.domain_name,
          logo: r.logo_url,
          price: parseAtomPrice(r.price),
          type: "Atom Portfolio",
        }))
      );
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const data = await safeJsonFetch<DiscountsFile>("/discounts.json");
      if (!data) return;
      setDiscountConfig(data.items || []);
      setDiscountSettings(data.settings);
    })();
  }, []);

  // Exit popup
  useEffect(() => {
    const onMouseOut = (e: MouseEvent) => e.clientY <= 0 && setShowExit(true);
    window.addEventListener("mouseout", onMouseOut);
    return () => window.removeEventListener("mouseout", onMouseOut);
  }, []);

  // Countdown logic
  const deadline = useMemo<number>(() => {
    const endAtStr = discountSettings?.endAt;
    if (endAtStr) {
      const t = Date.parse(endAtStr);
      if (!Number.isNaN(t)) return t;
    }
    const days = discountSettings?.durationDays || SETTINGS.discountDurationDays;
    if (!days) return 0;
    const version = discountSettings?.version ?? 1;
    const key = `discountDeadline_v${version}_${days}`;
    const now = Date.now();
    const stored = Number(localStorage.getItem(key) || 0);
    if (stored && stored > now) return stored;
    const next = now + days * 86400000;
    localStorage.setItem(key, String(next));
    return next;
  }, [discountSettings]);

  const [remaining, setRemaining] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      setRemaining({
        d: Math.floor(ms / 86400000),
        h: Math.floor((ms % 86400000) / 3600000),
        m: Math.floor((ms % 3600000) / 60000),
        s: Math.floor((ms % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  // Portfolio filtering
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const filtered = useMemo(
    () => portfolio.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [query, portfolio]
  );

  const discountItems = useMemo(() => {
    return discountConfig
      .map((cfg) => {
        const base = portfolio.find((p) => p.name === cfg.name);
        if (!base) return null;
        if (base.price === "REQUEST")
          return { ...cfg, was: "REQUEST", now: "REQUEST", logo: cfg.overrideLogo || base.logo };
        const basePrice = base.price as number;
        const now =
          cfg.amountOff && cfg.amountOff > 0
            ? Math.max(1, basePrice - cfg.amountOff)
            : cfg.percentOff && cfg.percentOff > 0
            ? Math.max(1, roundCurrency(basePrice * (1 - cfg.percentOff / 100)))
            : basePrice;
        return { ...cfg, was: basePrice, now, logo: cfg.overrideLogo || base.logo };
      })
      .filter(Boolean) as any[];
  }, [discountConfig, portfolio]);

  /******************************
   * RENDER
   ******************************/
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <a href="#home" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" />
            <span className="font-semibold">Linda Bout · Domain Consultant</span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#about">About</a>
            <a href="#portfolio">Portfolio</a>
            <a href="#discounts">Discounts</a>
            <a href="#services">Services</a>
            <a href="#contact">Contact</a>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <header id="home" className="relative mx-auto max-w-7xl px-4 pt-16 pb-24 text-center">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
          I help businesses win more leads with the right domain.
        </h1>
        <p className="mt-4 text-lg text-neutral-700 max-w-2xl mx-auto">
          I’m Linda — a domain consultant specializing in exact-match and brandable names that boost trust, SEO, and paid performance.
        </p>
        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-sm shadow-sm">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
            {visitorCount === null
              ? "Loading visitors..."
              : `Visitors: ${visitorCount.toLocaleString()}`}
          </span>
        </div>
      </header>
      {/* ABOUT */}
      <section id="about" className="py-16 px-4 bg-neutral-50 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-6 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
            About Me
          </h2>
          <p className="text-lg text-neutral-700">
            I blend marketing insight, data-driven research, and brand intuition to source domains that make an immediate and lasting impact.
            I help entrepreneurs, law firms, and service providers secure names that increase visibility and lift conversion rates.
          </p>
        </div>
      </section>

      {/* PORTFOLIO */}
      <section id="portfolio" className="py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold mb-10 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
            Portfolio
          </h2>
          <Input
            placeholder="Search domains..."
            className="w-full md:w-1/3 mx-auto mb-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.slice(0, visibleCount).map((item) => (
              <Card key={item.name} className="shadow-xl backdrop-blur-xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10">
                <CardHeader className="p-0">
                  <div className="aspect-[16/9] bg-neutral-100 flex items-center justify-center rounded-t-lg">
                    {item.logo ? (
                      <img src={item.logo} alt={item.name} className="object-cover w-full h-full rounded-t-lg" />
                    ) : (
                      <span className="text-lg font-semibold">{item.name}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="font-bold text-xl">{formatPrice(item.price)}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button asChild variant="secondary" className="rounded-full">
                      <a href={atomLink(item.name)} target="_blank" rel="noreferrer">
                        Atom <ExternalLink className="ml-1 h-4 w-4" />
                      </a>
                    </Button>
                    <Button asChild className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white">
                      <a href={gdLink(item.name)} target="_blank" rel="noreferrer">
                        GoDaddy <ExternalLink className="ml-1 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* See more / less buttons */}
          <div className="mt-10 flex justify-center gap-3">
            {visibleCount < filtered.length && (
              <Button
                onClick={() => setVisibleCount((c) => c + 3)}
                className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
              >
                See more
              </Button>
            )}
            {visibleCount > 6 && (
              <Button
                onClick={() => setVisibleCount(6)}
                variant="outline"
                className="rounded-full border-violet-300 text-violet-700"
              >
                See less
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* DISCOUNTS */}
      <section id="discounts" className="py-16 px-4 bg-neutral-50 text-center">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-6 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
            Current Discounts
          </h2>
          {deadline > Date.now() ? (
            <div className="text-sm text-neutral-700 mb-8">
              Ends in: {remaining.d}d {remaining.h}h {remaining.m}m {remaining.s}s
            </div>
          ) : (
            <p>Offer ended — new deals soon</p>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {discountItems.map((d) => (
              <Card key={d.name} className="shadow-xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10">
                <CardHeader className="p-0">
                  <div className="aspect-[16/9]">
                    {d.logo ? (
                      <img src={d.logo} alt={d.name} className="object-cover w-full h-full rounded-t-lg" />
                    ) : (
                      <DiscountThumb label={d.name} />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!isRequestPrice(d.was) && typeof d.was === "number" && (
                    <p className="text-neutral-600 line-through">{formatPrice(d.was)}</p>
                  )}
                  <p className="text-2xl font-bold">{formatPrice(d.now)}</p>
                  <Button
                    asChild
                    className="mt-3 w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                  >
                    <a
                      href={`mailto:boutamine.linda.dev@gmail.com?subject=${encodeURIComponent(
                        d.name + " discount"
                      )}&body=${encodeURIComponent("Hi Linda,\n\nI'm interested in " + d.name + ".")}`}
                    >
                      Email for Discount
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-16 px-4 text-center">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            { title: "Domain Appraisal", desc: "Professional valuation with CPC, search volume, and resale comps." },
            { title: "Acquisition & Negotiation", desc: "Secure, transparent buying via trusted platforms (Atom, GoDaddy)." },
            { title: "Launch & Redirect Setup", desc: "Fast setup so your new domain starts working for you immediately." },
          ].map((s) => (
            <Card key={s.title} className="shadow-xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-violet-600">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-800 text-sm">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
              Let’s talk domains
            </h2>
            <p className="text-neutral-700 mb-4">
              Tell me what you’re building, your market, and your goals — I’ll suggest domain options that
              bring measurable impact and help you integrate them seamlessly.
            </p>
            <p className="text-neutral-700 flex items-center gap-2">
              <Mail className="h-4 w-4" /> boutamine.linda.dev@gmail.com
            </p>
            <p className="text-neutral-700 flex items-center gap-2">
              <Phone className="h-4 w-4" /> +44 7424 646361
            </p>
          </div>
          <Card className="border border-white/20 shadow-xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-violet-600">Quick Brief</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const name = (form.elements.namedItem("name") as HTMLInputElement)?.value || "";
                  const email = (form.elements.namedItem("email") as HTMLInputElement)?.value || "";
                  const company = (form.elements.namedItem("company") as HTMLInputElement)?.value || "";
                  const message = (form.elements.namedItem("message") as HTMLTextAreaElement)?.value || "";
                  const subject = `Inquiry from ${name || "website visitor"}`;
                  const body = `Hi Linda,\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}\n\nMessage:\n${message}`;
                  window.location.href = `mailto:boutamine.linda.dev@gmail.com?subject=${encodeURIComponent(
                    subject
                  )}&body=${encodeURIComponent(body)}`;
                }}
              >
                <Input name="name" placeholder="Your name" className="border-neutral-300" required />
                <Input name="email" placeholder="Email" type="email" className="border-neutral-300" required />
                <Input name="company" placeholder="Company / Project (optional)" className="border-neutral-300" />
                <Textarea name="message" placeholder="Describe what you need…" className="border-neutral-300 min-h-32" />
                <Button type="submit" className="mt-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white">
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* EXIT POPUP */}
      {showExit && (
        <div className="fixed inset-0 z-[60] bg-black/40 grid place-items-center p-4" role="dialog" aria-modal>
          <Card className="max-w-lg w-full border border-violet-200 bg-white shadow-2xl">
            <CardHeader>
              <CardTitle className="font-extrabold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent text-2xl">
                Before you go — want a domain shortlist?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-700">Tell me your niche, city, and budget. I’ll reply with 3–5 options in 24h.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="flex-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white">
                  <a href={`mailto:boutamine.linda.dev@gmail.com?subject=${encodeURIComponent("Domain shortlist request")}&body=${encodeURIComponent("Hi Linda,\n\nNiche: \nCity: \nBudget: \n\nPlease send me options.")}`}>
                    Email Linda
                  </a>
                </Button>
                <Button variant="outline" className="rounded-full border-violet-300 text-violet-700" onClick={() => setShowExit(false)}>
                  No thanks
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-600">
        © {new Date().getFullYear()} Linda Bout — Domain Consultant
      </footer>
    </div>
  );
}

/******************************
 * UTILS
 ******************************/
function parseAtomPrice(str?: string): PriceType {
  if (!str) return "REQUEST";
  const n = Number(str.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : "REQUEST";
}

const DiscountThumb: React.FC<{ label: string }> = ({ label }) => (
  <svg viewBox="0 0 400 220" className="w-full h-auto rounded-t-lg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="50%" stopColor="#d946ef" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <rect width="400" height="220" fill="url(#g)" opacity="0.18" />
    <text x="200" y="125" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">
      {label}
    </text>
  </svg>
);
