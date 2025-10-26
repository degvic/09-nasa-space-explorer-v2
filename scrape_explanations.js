/**
 * scrape_explanations.js
 *
 * Enrich data/data.json with APOD "explanation" text by scraping
 * https://apod.nasa.gov/apod/apYYMMDD.html for each item missing it.
 *
 * Usage:
 *   npm i axios cheerio
 *   node scrape_explanations.js
 *
 * Notes:
 * - Creates a backup: data/data.json.bak
 * - Safe to re-run: only fills where explanation is empty/missing
 * - Throttled + basic retries to be polite to apod.nasa.gov
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios').default;
const cheerio = require('cheerio');

const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const BACKUP_FILE = path.join(__dirname, 'data', 'data.json.bak');

const HTTP_TIMEOUT = 20000;
const DELAY_MS = 200;        // delay between requests
const RETRIES = 3;
const UA = 'Mozilla/5.0 (compatible; APOD-Scraper/1.0; +https://example.local)';

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function yyMMddFrom(dateStr){
  // YYYY-MM-DD -> YYMMDD
  return dateStr.slice(2,4) + dateStr.slice(5,7) + dateStr.slice(8,10);
}

async function fetchHTML(url){
  for (let attempt = 1; attempt <= RETRIES; attempt++){
    try{
      const { data } = await axios.get(url, {
        timeout: HTTP_TIMEOUT,
        headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
        validateStatus: s => s >= 200 && s < 500
      });
      if (!data || typeof data !== 'string') throw new Error('Empty HTML');
      return data;
    }catch(err){
      if (attempt === RETRIES) throw err;
      await sleep(400 * attempt);
    }
  }
}

function extractExplanation(html){
  const $ = cheerio.load(html);

  // Typical structure is <b>Explanation:</b> inside a <p>, then text in same <p>
  // Some older pages use different casing or multiple <br>. We normalize.
  let text = '';

  // 1) Prefer <b>Explanation</b> then collect its nearest paragraph
  const bold = $('b').filter((_, el) => /explanation/i.test($(el).text().trim())).first();
  if (bold.length){
    const parentP = bold.closest('p');
    if (parentP.length){
      text = parentP.text();
    }else{
      // fallback: take the text of the parent element
      text = $(bold[0].parent).text();
    }
  }

  // 2) Fallbacks if nothing yet: search for any <p> that contains "Explanation:"
  if (!text.trim()){
    $('p').each((_, p) => {
      const t = $(p).text();
      if (/explanation:/i.test(t)) {
        text = t;
        return false;
      }
    });
  }

  // 3) Cleanup
  text = text
    .replace(/^\s*Explanation:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text || null;
}

async function enrich(){
  if (!fs.existsSync(DATA_FILE)){
    console.error(`Cannot find ${DATA_FILE}`);
    process.exit(1);
  }

  const original = fs.readFileSync(DATA_FILE, 'utf-8');
  let items = JSON.parse(original);
  if (!Array.isArray(items)) throw new Error('data.json must be an array');

  const targets = items.filter(x => !x.explanation || !String(x.explanation).trim());
  console.log(`Total items: ${items.length}. Missing explanations: ${targets.length}.`);

  let updated = 0;
  for (let i = 0; i < items.length; i++){
    const it = items[i];
    if (it.explanation && String(it.explanation).trim()) continue;

    const date = it.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const slug = yyMMddFrom(date);
    const url = `https://apod.nasa.gov/apod/ap${slug}.html`;
    try{
      const html = await fetchHTML(url);
      const exp = extractExplanation(html);
      if (exp){
        it.explanation = exp;
        updated++;
        process.stdout.write(`\rUpdated ${updated}/${targets.length}  (${date})       `);
      }else{
        process.stdout.write(`\rNo explanation found for ${date}                 `);
      }
    }catch(err){
      process.stdout.write(`\rFetch failed for ${date} (${err.message})        `);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nBacking up and writing file…`);
  fs.writeFileSync(BACKUP_FILE, original, 'utf-8');
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  console.log(`Done. Wrote ${updated} explanation(s). Backup at ${BACKUP_FILE}`);
}

enrich().catch(e => {
  console.error(e);
  process.exit(1);
});
