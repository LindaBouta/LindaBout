// extract-atom.cjs
// Extracts domains, logos, and prices from Atom portfolio HTML

const fs = require("fs");
const cheerio = require("cheerio");

// Load your saved Atom HTML file
const html = fs.readFileSync("./atom-portfolio.html", "utf8");
const $ = cheerio.load(html);

// Select each domain box
const results = [];

$(".store-box").each((_, el) => {
  const domain = $(el).find(".domain-title").text().trim();
  const logo = $(el).find(".thumb img").attr("src")?.trim() || null;

  // Price can be inside .price-show or inside nested spans
  let price = $(el).find(".price-show").first().text().trim();

  // Normalize and set defaults
  if (!price || price.toLowerCase().includes("request")) {
    price = "$300"; // Default placeholder if not shown
  }

  results.push({
    domain_name: domain,
    logo_url: logo,
    price,
  });
});

// Save to JSON
fs.writeFileSync("./atom-portfolio.json", JSON.stringify({ results }, null, 2));
console.log(`✅ Extracted ${results.length} domains → atom-portfolio.json`);
