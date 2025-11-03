// netlify/functions/visitor-count.js
export default async function handler(req) {
  try {
    const namespace = "site_metrics"; // any unique name
    const key = "visitor_count";

    // Get current count from KV
    let count = 0;
    const existing = await Netlify.env.get(`${namespace}:${key}`);
    if (existing) count = parseInt(existing, 10) || 0;

    // Increment
    count++;

    // Store it back (persistent)
    await Netlify.env.set(`${namespace}:${key}`, count.toString());

    return new Response(
      JSON.stringify({ count }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
