// NASA Space Explorer (Local JSON Version) — now with 15-per-page pagination + video thumbnails with inline play
// Keeps original behavior; only adds pager + improved video rendering.

// Local JSON file
const DATA_URL = "data/data.json";

const els = {
  gallery: document.getElementById("gallery"),
  loading: document.getElementById("loading"),
  fact: document.getElementById("fact"),
  fetchForm: document.getElementById("controls"),
  startDate: document.getElementById("startDate"),
  days: document.getElementById("days"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalDate: document.getElementById("modalDate"),
  modalExplanation: document.getElementById("modalExplanation"),
  modalCredit: document.getElementById("modalCredit"),
  modalMedia: document.getElementById("modalMedia"),
  // pager
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageLabel: document.getElementById("pageLabel"),
  // NEW: reset button
  resetDate: document.getElementById("resetDate"),
  // NEW: fullscreen button (optional in DOM)
  modalFs: document.getElementById("modalFs"),
};

// ---- Random Space Facts (unchanged) ----
const FACTS = [
  "A day on Venus is longer than a year on Venus.",
  "Neutron stars can spin 600+ times per second.",
  "There are more trees on Earth than stars in the Milky Way.",
  "Saturn could float in a bathtub—if you found one big enough.",
  "On Mars, sunsets are blue.",
  "A teaspoon of a neutron star would weigh billions of tons.",
  "The footprints on the Moon could last millions of years.",
  "Jupiter’s Great Red Spot is a centuries-old storm.",
  "There may be more planets than stars in our galaxy."
];

function showRandomFact() {
  const pick = FACTS[Math.floor(Math.random() * FACTS.length)];
  els.fact.innerHTML = `<strong>Did You Know?</strong> ${pick}`;
}

// ---- Utilities ----
function formatDate(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDate(str) {
  const d = new Date(str);
  return isNaN(d) ? null : d;
}
function showLoading(on) {
  els.loading.hidden = !on;
}
function sortByDateDesc(a, b) {
  return b.date.localeCompare(a.date);
}

// ---- Pagination state ----
const PAGE_SIZE = 15;
let filteredItems = [];   // last filtered list
let currentPage = 1;      // 1-based for UI
let totalPages = 1;

function updatePager() {
  totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  els.pageLabel.textContent = `Page ${currentPage} / ${totalPages}`;
  els.prev.disabled = currentPage <= 1;
  els.next.disabled = currentPage >= totalPages;
}

function currentPageSlice() {
  const start = (currentPage - 1) * PAGE_SIZE;
  return filteredItems.slice(start, start + PAGE_SIZE);
}

// ---- Video helpers ----
function getYouTubeId(url) {
  // Supports youtube.com/watch?v=, youtu.be/, youtube.com/embed/
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/) ||
    [];
  return m[1] || null;
}

function getVideoThumb(item) {
  // Prefer dataset-provided thumbnail if present
  if (item.thumbnail_url) return item.thumbnail_url;

  // Derive for YouTube if possible
  const id = getYouTubeId(item.url || "");
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  // Fallback: no thumb
  return null;
}

function buildVideoIframe(url, autoplay = true) {
  // Add autoplay for YouTube embed if needed
  if (url.includes("youtube.com/embed/")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}autoplay=${autoplay ? "1" : "0"}&rel=0`;
  }
  // Leave other providers as-is
  return url;
}

// ---- Rendering ----
function renderGallery(items) {
  els.gallery.innerHTML = "";
  if (!items.length) {
    els.gallery.innerHTML = `<p class="empty">No photos found for this date range.</p>`;
    return;
  }

  const frag = document.createDocumentFragment();

  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${item.title}`);

    const media = document.createElement("div");
    media.className = "card-media";

    if (item.media_type === "image") {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = item.title || "APOD image";
      img.src = item.url;
      media.appendChild(img);
    } else if (item.media_type === "video") {
      // Show thumbnail + VIDEO badge; click to play inline
      const thumb = getVideoThumb(item);
      if (thumb) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = item.title || "APOD video thumbnail";
        img.src = thumb;
        media.appendChild(img);
      }

      const badge = document.createElement("span");
      badge.className = "badge-video";
      badge.textContent = "VIDEO";
      media.appendChild(badge);

      const overlay = document.createElement("div");
      overlay.className = "play-overlay";
      overlay.innerHTML =
        '<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="28" fill="rgba(0,0,0,.35)"></circle><polygon points="24,18 24,42 44,30" fill="#fff"></polygon></svg>';
      media.appendChild(overlay);

      // Inline play on click (but keep card click for modal)
      media.style.cursor = "pointer";
      media.addEventListener("click", (e) => {
        e.stopPropagation();
        media.innerHTML = ""; // clear thumb/overlay/badge
        const ifr = document.createElement("iframe");
        ifr.src = buildVideoIframe(item.url, true);
        ifr.title = item.title || "APOD video";
        ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        ifr.setAttribute("allowfullscreen", "true");
        media.appendChild(ifr);
      });
    }

    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = item.title;
    const sub = document.createElement("p");
    sub.className = "card-sub";
    sub.textContent = new Date(item.date).toDateString();
    body.appendChild(title);
    body.appendChild(sub);

    /* NEW: short explanation preview, if available */
    if (item.explanation) {
      const preview = document.createElement("p");
      preview.className = "card-preview";
      const txt = String(item.explanation).replace(/\s+/g, ' ').trim();
      preview.textContent = txt.length > 140 ? txt.slice(0, 137) + '…' : txt;
      body.appendChild(preview);
    }

    card.appendChild(media);
    card.appendChild(body);

    // keep your modal behavior
    card.addEventListener("click", () => openModal(item));
    card.addEventListener("keypress", e => {
      if (e.key === "Enter") openModal(item);
    });

    frag.appendChild(card);
  });

  els.gallery.appendChild(frag);
}

// ---- Modal (now also locks scroll) ----
function openModal(item) {
  els.modalTitle.textContent = item.title || "";
  els.modalDate.textContent = new Date(item.date).toDateString();
  els.modalExplanation.textContent = item.explanation || "";
  els.modalCredit.textContent = item.copyright ? `© ${item.copyright}` : "";

  els.modalMedia.innerHTML = "";
  if (item.media_type === "image") {
    const img = document.createElement("img");
    img.alt = item.title || "APOD image";
    img.src = item.hdurl || item.url;
    els.modalMedia.appendChild(img);
  } else {
    const ifr = document.createElement("iframe");
    ifr.src = buildVideoIframe(item.url, false);
    ifr.title = item.title || "APOD video";
    ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    ifr.setAttribute("allowfullscreen", "true");
    els.modalMedia.appendChild(ifr);
  }

  els.modal.setAttribute("aria-hidden", "false");

  // NEW: prevent background scroll while modal is open
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}
function closeModal() {
  els.modal.setAttribute("aria-hidden", "true");

  // NEW: restore background scroll
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  // also exit immersive fallback if it was used
  els.modal.classList.remove("modal-immersive");
}
document.addEventListener("click", e => {
  if (e.target.matches("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// ---- NEW: Fullscreen helpers & wiring ----
function enterNativeFullscreen(el){
  try{
    if (el.requestFullscreen) { el.requestFullscreen(); return true; }
    if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return true; }
    if (el.msRequestFullscreen) { el.msRequestFullscreen(); return true; }
  }catch(_e){}
  return false;
}
function exitNativeFullscreen(){
  try{
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
  }catch(_e){}
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    els.modal.classList.remove("modal-immersive");
  }
});

// Button click → fullscreen (or immersive fallback)
if (els.modalFs) {
  els.modalFs.addEventListener("click", () => {
    const target = els.modalMedia.querySelector("img,iframe") || els.modalMedia;
    const ok = enterNativeFullscreen(target);
    if (!ok) {
      els.modal.classList.add("modal-immersive");
    }
  });
}

// Double-click the media to go fullscreen quickly
els.modalMedia.addEventListener("dblclick", () => {
  const target = els.modalMedia.querySelector("img,iframe") || els.modalMedia;
  const ok = enterNativeFullscreen(target);
  if (!ok) els.modal.classList.add("modal-immersive");
});

// ---- Data Fetch (unchanged) ----
async function fetchJSON() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("APOD JSON fetch failed");
  return res.json();
}

// ---- Load & Filter + paginate ----
async function loadGallery(startDateStr, endDateStr, ascending = false) {
  showLoading(true);
  try {
    const data = await fetchJSON();

    const start = startDateStr ? parseDate(startDateStr) : null;
    const end   = endDateStr   ? parseDate(endDateStr)   : null;

    // Accept start-only, end-only, or both
    if (start || end) {
      filteredItems = data.filter((item) => {
        const d = parseDate(item.date);
        if (!d) return false;
        if (start && end) return d >= start && d <= end;
        if (start)       return d >= start; // start → today
        if (end)         return d <= end;   // earliest → end
        return true;
      });
    } else {
      filteredItems = data.slice();
    }

    // support ascending sort when requested (used by Reset Date)
    filteredItems.sort(ascending ? (a, b) => a.date.localeCompare(b.date) : sortByDateDesc);

    currentPage = 1; // reset to first page when (re)loading
    updatePager();
    renderGallery(currentPageSlice());
  } catch (err) {
    console.warn(err);
    els.gallery.innerHTML = `<p class="empty">Could not load dataset (check data.json or CORS).</p>`;
    filteredItems = [];
    currentPage = 1;
    updatePager();
  } finally {
    showLoading(false);
  }
}

// ---- Initialize (kept your original UX) ----
function setDefaultStartEnd() {
  // Default: show all images initially
  els.startDate.value = "";
}

// Submit: start → start+days−1 (clamped to today), or start → today if no days.
// If no start, loads all (unchanged). Sort is descending by default.
els.fetchForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const startStr = els.startDate.value;
  const daysSel  = els.days;
  const daysVal  = daysSel ? parseInt(daysSel.value, 10) : NaN;

  let endStr = null;

  if (startStr) {
    const s = new Date(startStr + "T00:00:00");
    let e2;
    if (!isNaN(daysVal)) {
      e2 = new Date(s);
      e2.setDate(s.getDate() + Math.max(1, daysVal) - 1); // inclusive
    } else {
      e2 = new Date();
    }
    const today = new Date();
    if (e2 > today) e2 = today;
    endStr = formatDate(e2);
  }

  loadGallery(startStr || null, endStr, /* ascending */ false);
});

// NEW: Reset date → clear field, load everything DESCENDING (newest first), jump to top
els.resetDate.addEventListener("click", () => {
  els.startDate.value = "";
  if (els.days) els.days.selectedIndex = 0; // optional: reset days dropdown
  currentPage = 1;
  // NOTE: ascending=false so newest (e.g., 2025) appears at the top/page 1
  loadGallery(null, null, /* ascending */ false);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Pager events
els.prev.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    updatePager();
    renderGallery(currentPageSlice());
  }
});
els.next.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    updatePager();
    renderGallery(currentPageSlice());
  }
});

setDefaultStartEnd();
showRandomFact();
loadGallery(); // loads all by default, now paginated (15 per page)
