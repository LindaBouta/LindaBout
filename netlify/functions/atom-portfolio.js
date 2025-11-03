// netlify/functions/atom-portfolio.js

const fetch = require("node-fetch");

exports.handler = async function () {
  try {
    const apiUrl = "https://api.atom.com/v2/portfolios/2924605/domains";

    // Simulate a browser request to bypass the 403
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer":
          "https://www.atom.com/domain-portfolio/linda%20boutamine/2924605",
        "Origin": "https://www.atom.com",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Atom API: ${res.status}`);
    }

    const data = await res.json();

    const domains = (data.domains || []).map((d) => ({
      name: d.name,
      price: d.buy_now_price || "Make Offer",
      logo: d.logo_url || null,
      status: d.status,
      url: `https://www.atom.com/domain/${d.name}`,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: domains }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
