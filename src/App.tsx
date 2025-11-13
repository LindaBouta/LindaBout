import React, { useEffect, useMemo, useState } from "react";
import { Analytics } from '@vercel/analytics/react'; // NEW: Added this import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, Menu, X, ExternalLink } from "lucide-react";

/******************************
 * SIMPLE CONFIG
 ******************************/
const SETTINGS = {
  discountDurationDays: 7,
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
const headerClass =
  "font-display text-5xl md:text-6xl font-extrabold mb-8 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent";

const cardClass =
  "font-sans shadow-2xl bg-white/25 backdrop-blur-xl border border-violet-300/40 hover:bg-white/30 transition rounded-3xl";


/******************************
 * GLOBAL VISITOR COUNTER (UPDATED for Vercel Analytics)
 ******************************/
async function getGlobalVisitorCount(): Promise<number> {
  try {
    const res = await fetch("/api/analytics-count", { // CHANGED: Updated endpoint
      method: "GET",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.count ?? 0;
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
  
  // Navbar Scroll disappear
  const [showNavbar, setShowNavbar] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setShowNavbar(currentScroll < 80);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Navbar
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
    <>
      <Analytics /> {/* NEW: Added Vercel Analytics tracking */}
      <div className="min-h-screen bg-white text-neutral-900 font-sans">
        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-white pt-16">
            <div className="flex flex-col items-center gap-6 p-8 text-lg">
              <a href="#about" onClick={() => setMobileOpen(false)}>About</a>
              <a href="#portfolio" onClick={() => setMobileOpen(false)}>Portfolio</a>
              <a href="#discounts" onClick={() => setMobileOpen(false)}>Discounts</a>
              <a href="#services" onClick={() => setMobileOpen(false)}>Services</a>
              <a href="#contact" onClick={() => setMobileOpen(false)}>Contact</a>
            </div>
          </div>
        )}

        {/* NAVBAR */}
        <nav
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] md:w-[90%] flex items-center justify-between px-8 py-4 text-white transition-all duration-500 rounded-full ${
            showNavbar ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10 pointer-events-none"
          } 
          ${"md:border md:border-white/20 md:bg-white/10 md:backdrop-blur-md md:shadow-lg"}`}
        >
          {/* Left — Logo only */}
          <a href="#home" className="flex items-center gap-3">
            <img
              src="/images/logo.png"
              alt="Linda Boutamine Logo"
              className="h-12 w-12 md:h-10 md:w-10 rounded-full"
            />
            <span className="font-semibold text-lg hidden [@media(min-width:1321px)]:inline">
              Linda Boutamine · Domain Consultant & Designer
            </span>
          </a>

          {/* Center — Visitor Counter */}
          {visitorCount !== null && (
            <div
              className="flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base font-medium 
              md:bg-transparent md:backdrop-blur-none 
              bg-transparent shadow-none md:shadow-none"
            >
              <span role="img" aria-label="visitors">👁️</span>
              <span>{visitorCount.toLocaleString()}</span>
            </div>
          )}

          {/* Right — Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-lg font-medium">
            <a href="#about" className="hover:text-cyan-300 transition-colors duration-300">About</a>
            <a href="#portfolio" className="hover:text-cyan-300 transition-colors duration-300">Portfolio</a>
            <a href="#discounts" className="hover:text-cyan-300 transition-colors duration-300">Discounts</a>
            <a href="#services" className="hover:text-cyan-300 transition-colors duration-300">Services</a>
            <a href="#contact" className="hover:text-cyan-300 transition-colors duration-300">Contact</a>
          </div>
        </nav>

        <section
          id="hero-about"
          className="relative w-full text-center text-white overflow-hidden"
          style={{ height: "200vh" }}
        >
          {/* Background image */}
          <img
            src="/images/phone.png"
            alt="Hero and about background"
            className="absolute top-0 left-0 w-full h-full object-cover object-center z-0"
          />

          {/* HERO CONTENT */}
          <div
            id="home"
            className="relative z-10 flex flex-col items-center justify-center h-screen px-4 -translate-y-20"
          >
            <h1 className="text-4xl md:text-6xl font-extrabold mb-10 drop-shadow-lg leading-tight">
              Rank higher. Convert better. <br /> Own the right domain.
            </h1>
            <button
              onClick={() =>
                document
                  .getElementById("portfolio")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="relative overflow-hidden rounded-full bg-gradient-to-r from-[#FFB300] via-[#FFC107] to-[#FFD25A] text-white font-semibold px-14 py-4 text-xl shadow-[0_0_25px_rgba(255,200,0,0.6)] hover:shadow-[0_0_45px_rgba(255,220,50,0.9)] transition-all duration-500 hover:scale-105 glow-pulse"
            >
              <span className="relative z-10">Explore</span>
              <span className="absolute inset-0 bg-gradient-to-r from-[#FFD25A] via-[#FFE082] to-[#FFC107] opacity-0 hover:opacity-30 blur-2xl transition-opacity duration-700" />
            </button>
          </div>

          {/* ABOUT TEXT */}
          <div
            id="about"
            className="relative z-10 flex items-center justify-center min-h-screen px-6 py-16"
          >
            <div className="bg-white/85 backdrop-blur-md border border-violet-200 shadow-xl text-neutral-900 w-full max-w-3xl rounded-2xl flex flex-col items-center text-center p-10 md:p-14">
              <h2 className={`${headerClass} font-display mb-6`}>About Me</h2>
              <p className="text-base md:text-lg leading-relaxed text-neutral-800 space-y-4">
                I'm <span className="font-semibold">Linda Boutamine</span>, a domain consultant and creative strategist
                helping businesses stand out with the right digital identity.  
                By blending marketing insight, design, and data-driven research,  
                I help entrepreneurs and professionals secure premium domains that boost visibility, credibility,  
                and long-term growth.
              </p>
            </div>
          </div>
        </section>

        {/* PORTFOLIO */}
        <section id="portfolio" className="py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className={`${headerClass} font-display`}>
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
            <h2 className={`${headerClass} font-display`}>
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
                <Card
                  key={d.name}
                  className="shadow-xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10"
                >
                  <CardHeader className="p-0">
                    <div className="aspect-[16/9]">
                      {d.logo ? (
                        <img
                          src={d.logo}
                          alt={d.name}
                          className="object-cover w-full h-full rounded-t-lg"
                        />
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
                        Grab Offer Now
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* SERVICES + CONTACT + FOOTER */}
        <section id="services-contact-footer" className="relative text-neutral-100 overflow-hidden">
          {/* Shared Background */}
          <div className="absolute inset-0 z-0">
            <img
              src="/images/contactusandfooter.png"
              alt="Background for services, contact, and footer"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-[#1a003d]/90" />
          </div>

          {/* SERVICES */}
          <section id="services" className="relative z-10 py-24 px-4 text-center">
            <div className="max-w-6xl mx-auto mb-12">
              <h2 className={`${headerClass} font-display`}>
                My Services
              </h2>
              <p className="text-neutral-800 text-base max-w-4xl mx-auto">
                Whether you're a business looking to acquire a premium domain, an investor wanting to
                understand market value, or simply aiming to launch your online presence effectively —
                I provide end-to-end guidance to make the process seamless, secure, and strategic.
              </p>
            </div>

            <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-22">
              {[
                {
                  title: "Domain Appraisal",
                  desc: "Receive a detailed, data-driven valuation including CPC, search volume, keyword competitiveness, and comparable recent sales.",
                  img: "/images/services/domain-appraisal.png",
                },
                {
                  title: "Acquisition & Negotiation",
                  desc: "From outreach to purchase, I manage negotiations through verified platforms like Atom and GoDaddy for a secure and transparent process.",
                  img: "/images/services/acquisition-negotiation.png",
                },
                {
                  title: "Launch & Redirect Setup",
                  desc: "Once acquired, I handle DNS setup, redirects, and optimization so your new domain starts generating traffic instantly.",
                  img: "/images/services/launch-redirect.png",
                },
              ].map((s) => (
                <Card
                  key={s.title}
                  className={cardClass}
                >
                  <CardHeader>
                    <img src={s.img} alt={s.title} className="w-20 h-20 mx-auto mb-8" />
                    <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-2xl font-bold">
                      {s.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-800 text-l leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* CONTACT */}
          <div id="contact" className="relative z-10 py-24 px-4 text-white">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className={`${headerClass} font-display`}>
                  Let's talk domains
                </h2>
                <p className="text-neutral-100 mb-4 leading-relaxed">
                  Tell me what you're building, your market, and your goals — I'll suggest
                  domain options that bring measurable impact and help you integrate them
                  seamlessly.
                </p>
                <p className="text-neutral-100 flex items-center gap-2 mb-2 justify-center md:justify-start">
                  <Mail className="h-4 w-4" /> boutamine.linda.dev@gmail.com
                </p>
                <p className="text-neutral-100 flex items-center gap-2 justify-center md:justify-start">
                  <Phone className="h-4 w-4" /> +44 7424 646361
                </p>
              </div>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-violet-200 via-fuchsia-500 to-cyan-400 bg-clip-text text-transparent font-semibold">
                    Quick Brief
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
                      const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
                      const company = (form.elements.namedItem("company") as HTMLInputElement)?.value;
                      const message = (form.elements.namedItem("message") as HTMLTextAreaElement)?.value;
                      const subject = `Inquiry from ${name || "website visitor"}`;
                      const body = `Hi Linda,\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}\n\nMessage:\n${message}`;
                      window.location.href = `mailto:boutamine.linda.dev@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    }}
                  >
                    <Input name="name" placeholder="Your name" className="border-neutral-300 text-neutral-900" required />
                    <Input name="email" placeholder="Email" type="email" className="border-neutral-300 text-neutral-900" required />
                    <Input name="company" placeholder="Company / Project (optional)" className="border-neutral-300 text-neutral-900" />
                    <Textarea name="message" placeholder="Describe what you need…" className="border-neutral-300 min-h-32 text-neutral-900" />
                    <Button
                      type="submit"
                      className="mt-2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-400 text-white shadow-lg hover:opacity-90 transition"
                    >
                      Send
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FOOTER */}
          <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] md:w-[80%] rounded-full border border-white/20 bg-white/10 backdrop-blur-md shadow-lg text-center py-3 text-sm text-neutral-200">
            © {new Date().getFullYear()}{" "}
            <span className="font-medium bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              Linda Boutamine
            </span>{" "}
            — Domain Consultant
          </footer>
        </section>

        {/* EXIT POPUP */}
        {showExit && (
          <div
            className="fixed inset-0 z-[60] bg-black/40 grid place-items-center p-6"
            role="dialog"
            aria-modal="true"
          >
            <Card className="max-w-lg w-full border border-violet-200 bg-white shadow-2xl p-6 md:p-8 rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="font-extrabold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent text-3xl text-center">
                  Before you go . . .
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <p className="text-neutral-800 text-lg md:text-xl leading-relaxed text-center">
                  Tell me what you're building.<br />
                  I'll send back a shortlist of premium domains tailored to your market.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    asChild
                    className="flex-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white py-3 text-base font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-transform"
                  >
                    <a
                      href={`mailto:boutamine.linda.dev@gmail.com?subject=${encodeURIComponent(
                        "Domain shortlist request"
                      )}&body=${encodeURIComponent(
                        "Hi Linda,\n\nNiche: \nCity: \nBudget: \n\nPlease send me options."
                      )}`}
                    >
                      Email Linda
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-full border-violet-300 text-violet-700 py-3 text-base font-semibold hover:bg-violet-50 transition"
                    onClick={() => setShowExit(false)}
                  >
                    No thanks
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SCROLL TO TOP BUTTON */}
        {typeof window !== "undefined" && (
          <ScrollToTop />
        )}
      </div>
    </>
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

/******************************
 * SCROLL TO TOP COMPONENT
 ******************************/
const ScrollToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Scroll to top"
      className={`fixed bottom-8 right-8 z-50 transition-all duration-500 
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}
        rounded-full p-3 shadow-lg backdrop-blur-md bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 
        text-white hover:scale-110`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
};