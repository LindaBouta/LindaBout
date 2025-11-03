import fs from "fs";
import path from "path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const FILE_PATH = path.join(process.cwd(), "visitor-data.json");

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Check if file exists
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({ count: 0 }, null, 2));
    }

    // Read current count
    const data = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    data.count = (data.count || 0) + 1;

    // Write new count
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));

    res.status(200).json({ count: data.count });
  } catch (err) {
    console.error("Error in visitor-count:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
