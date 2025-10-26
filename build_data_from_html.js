/**
 * Build a full APOD dataset (1995–2025) from the NASA HTML archive
 * Works even when the official API is offline.
 * 
 * Usage:
 *   1. npm install node-fetch@3 jsdom
 *   2. node build_data_from_html.js
 */

import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { writeFileSync } from "fs";

const BASE = "https://apod.nasa.gov/apod/";
const ARCHIVE_URL = BASE + "archivepixFull.html";

// --- Helper to sleep politely between requests ---
const sleep = ms => new Promise(res => setTimeout(res, ms));

// --- Fetch and parse the master archive list ---
async function getArchiveLinks() {
  console.log("🛰️  Fetching APOD archive index...");
  const res = await fetch(ARCHIVE_URL);
  if (!res.ok) throw new Error(`Failed to fetch archive: ${res.status}`);
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const links = [];
  document.querySelectorAll("a[href]").forEach(a => {
    const href = a.getAttribute("href");
    const text = a.textContent.trim();
    if (href.match(/^ap\d{6}\.html$/)) {
      links.push({ href, text });
    }
  });
  console.log(`✅ Found ${links.length} entries`);
  return links;
}

// --- Parse individual APOD page ---
async function parseApodPage(href) {
  const url = BASE + href;
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Title
    const titleTag = doc.querySelector("b");
    const title = titleTag ? titleTag.textContent.trim() : "Untitled";

    // Explanation
    let explanation = "";
    [...doc.querySelectorAll("b")].forEach(b => {
      if (b.textContent.includes("Explanation")) {
        const p = b.parentElement?.nextElementSibling;
        if (p) explanation = p.textContent.trim();
      }
    });

    // Media
    const img = doc.querySelector("img");
    const iframe = doc.querySelector("iframe");
    let mediaType = "unknown";
    let mediaUrl = "";
    if (img) {
      mediaType = "image";
      mediaUrl = BASE + img.getAttribute("src");
    } else if (iframe && iframe.src.includes("youtube")) {
      mediaType = "video";
      mediaUrl = iframe.src;
    }

    // Copyright
    const copyrightMatch = html.match(/Copyright[: ]([^<\n]+)/i);
    const copyright = copyrightMatch ? copyrightMatch[1].trim() : "";

    // Extract date from filename (e.g. ap251024.html → 2025-10-24)
    const yy = href.slice(2, 4);
    const mm = href.slice(4, 6);
    const dd = href.slice(6, 8);
    const year = parseInt(yy) >= 95 ? "19" + yy : "20" + yy; // 1995–2094
    const dateStr = `${year}-${mm}-${dd}`;

    return {
      date: dateStr,
      title,
      explanation,
      media_type: mediaType,
      url: mediaUrl,
      hdurl: mediaUrl,
      copyright
    };
  } catch (err) {
    console.warn("⚠️  Skipping", href, err.message);
    return null;
  }
}

// --- Main function ---
async function main() {
  const links = await getArchiveLinks();

  // Uncomment this to test smaller batches first:
  // const recent = links.slice(-100); // last 100 entries
  // const selected = recent;
  const selected = links; // full 1995–2025 range

  const all = [];
  for (let i = 0; i < selected.length; i++) {
    const { href } = selected[i];
    const item = await parseApodPage(href);
    if (item) all.push(item);
    if (i % 50 === 0 && i > 0) {
      console.log(`Processed ${i}/${selected.length}`);
      // save partial progress every 500 entries
      writeFileSync("data_partial.json", JSON.stringify(all, null, 2));
    }
    await sleep(500); // polite delay
  }

  // Sort newest → oldest
  all.sort((a, b) => b.date.localeCompare(a.date));

  writeFileSync("data.json", JSON.stringify(all, null, 2));
  console.log(`✅ Saved ${all.length} entries to data.json`);
}

main().catch(console.error);
