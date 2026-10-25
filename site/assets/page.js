/* WERLD/ — standalone pages: story (s/CODE/), thread (t/SLUG/), brief edition (b/N/), briefs (b/), video (v/N/), videos (v/). */
(() => {
  "use strict";
  const B = document.body, KIND = B.dataset.page, KEY = B.dataset.key, ROOT = B.dataset.root || "./";
  const WORLD = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const DESK = {
    world: ["World", "WLD", "--d-world"], conflict: ["Conflict", "CNF", "--d-conflict"], defence: ["Defence", "DEF", "--d-defence"],
    cyber: ["Cyber", "CYB", "--d-cyber"], ai: ["AI & Tech", "AI", "--d-ai"], markets: ["Markets", "MKT", "--d-markets"], hazards: ["Hazards", "HAZ", "--d-hazards"],
  };
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safe = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const cvar = (d) => `var(${(DESK[d] || DESK.world)[2]})`;
  const S = (code) => `${ROOT}s/${code}/`;
  const getJSON = async (p) => { const r = await fetch(`${ROOT}${p}?t=${Date.now()}`, { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); };

  // ---------- time (reader's zone) ----------
  const fmtHM = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const fmtDT = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
  const tzShort = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";
  const dk = (d) => d.toDateString();
  const when = (iso) => { const d = new Date(iso); return dk(d) === dk(new Date()) ? fmtHM.format(d) : fmtDT.format(d); };
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 90) return "just now"; if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`; return `${Math.round(s / 86400)} d ago`;
  }
  const developing = (s) => Date.now() - new Date(s.last) < 3 * 3600e3 && Date.now() - new Date(s.first) < 24 * 3600e3 && s.sources.length > 1;

  // ---------- chrome ----------
  const CH = [["live", "LIVE"], ["brief", "BRIEF"], ["threads", "THREADS"], ["map", "MAP"], ["desks", "DESKS"], ["method", "METHOD"]];
  const here = { story: "live", thread: "threads", edition: "brief", editions: "brief", video: "videos", videos: "videos" }[KIND];
  B.insertAdjacentHTML("afterbegin", `
    <canvas id="static" aria-hidden="true"></canvas><div class="scan" aria-hidden="true"></div><div class="roll" aria-hidden="true"></div><div class="beam go" aria-hidden="true"></div>
    <header class="top"><div class="bar">
      <a class="mark" href="${ROOT}" aria-label="WERLD/ home"><b>WERLD<i>/</i></b><small>LIVE INTELLIGENCE ENGINE<br>FROM <em>BINNING.AI</em></small></a>
      <nav class="ch" aria-label="Channels">${CH.map(([id, l], i) => `<a href="${ROOT}#${id}" ${here === id ? 'aria-current="page"' : ""}>CH ${String(i + 1).padStart(2, "0")}<span>${l}</span></a>`).join("")}</nav>
      <div class="readout"><div class="row"><i class="rec"></i><b class="st">WERLD/</b></div><div class="row"><span id="clock"></span><span>${esc(tzShort)}</span></div></div>
    </div></header>
    <main id="page" class="page"><div class="empty">Tuning in…</div></main>
    <footer><span class="draft">DRAFT</span><span class="term" id="term">&gt; werld --open ${esc(KIND)} ${esc(KEY)}</span>
      <a href="${ROOT}v/">Videos</a><a href="${ROOT}b/">Briefs</a>
      <a href="https://github.com/karambinning/werld/issues/new?title=${encodeURIComponent(`Correction: ${KIND} ${KEY}`)}" target="_blank" rel="noopener">Report a correction</a>
      <button class="tubebtn" id="tube" type="button">TUBE: ON</button></footer>`);
  const cv = $("#static"), cx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let nt;
  function noise() { cv.width = 160; cv.height = 100; const im = cx.createImageData(160, 100); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } cx.putImageData(im, 0, 0); }
  function setTube(on) { document.documentElement.classList.toggle("notube", !on); $("#tube").textContent = `TUBE: ${on ? "ON" : "OFF"}`; store.set("werld.tube", on ? "1" : "0"); clearInterval(nt); if (on) nt = setInterval(noise, 90); }
  setTube(store.get("werld.tube") !== "0" && !reduce);
  $("#tube").onclick = () => setTube(document.documentElement.classList.contains("notube"));
  setInterval(() => ($("#clock").textContent = new Date().toLocaleTimeString(undefined, { hour12: false })), 500);
  const main = $("#page");
  const fail = (msg) => { main.innerHTML = `<div class="ch-id">● SIGNAL LOST</div><h1 class="big">NO SIGNAL</h1><p class="lede">${msg} <a href="${ROOT}" style="color:var(--phos)">Back to the live wire →</a></p>`; };

  const chips = (s) => `
    <span class="chip ${s.status === "confirmed" ? "ok" : "warn"}">${s.status === "confirmed" ? "CONFIRMED" : "SINGLE SOURCE"}</span>
    ${developing(s) ? `<span class="chip live">DEVELOPING</span>` : ""}`;

  // ---------- video embeds ----------
  function embed(v) {
    const tt = (v.tiktok || "").match(/video\/(\d+)/), ig = (v.reels || "").match(/\/(?:reel|p)\/([\w-]+)/), yt = (v.youtube || "").match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{6,})/);
    if (v.mp4) return `<video src="${esc(safe(v.mp4))}" ${v.poster ? `poster="${esc(safe(v.poster))}"` : ""} controls playsinline preload="metadata"></video>`;
    if (tt) return `<iframe src="https://www.tiktok.com/player/v1/${tt[1]}?music_info=0&description=0" allow="fullscreen" title="WERLD/ video on TikTok"></iframe>`;
    if (ig) return `<iframe src="https://www.instagram.com/reel/${ig[1]}/embed" allow="fullscreen" title="WERLD/ video on Instagram"></iframe>`;
    if (yt) return `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" allow="fullscreen" title="WERLD/ video on YouTube"></iframe>`;
    return `<div class="vid-empty">VIDEO #${v.n}</div>`;
  }
  const platLinks = (v) => [["TikTok", v.tiktok], ["Reels", v.reels], ["YouTube", v.youtube]].filter((x) => x[1]).map(([l, u]) => `<a class="btn quiet" href="${esc(safe(u))}" target="_blank" rel="noopener">[ ${l} ]</a>`).join(" ");
  function videoBlock(v, sinceHtml) {
    return `<section class="vidbox">
      <div class="vid">${embed(v)}</div>
      <div class="vid-side">
        <div class="ch-id">▶ WERLD/ VIDEO #${v.n}</div>
        <h2 class="mid">${esc(v.title || "")}</h2>
        <p class="lede">Posted ${v.published ? esc(when(v.published)) : ""}. Below are the sources this video is based on${sinceHtml ? ", and what has happened since" : ""}.</p>
        ${sinceHtml || ""}
        <div class="row-btns">${platLinks(v)}</div>
      </div></section>`;
  }

  // ---------- story ----------
  async function story(code, video) {
    let s;
    try { s = await getJSON(`data/s/${code}.json`); } catch { return fail(`Story <b>${esc(code)}</b> isn't in the archive.`); }
    document.title = `${s.title} · WERLD/`;
    const key = `werld.seen.${code}`, seenN = Number(store.get(key)) || 0;
    store.set(key, String(s.timeline.length));
    const newSince = seenN && s.timeline.length > seenN ? s.timeline.length - seenN : 0;
    const n = s.sources.length;
    let since = "";
    if (video && video.published) {
      const after = s.timeline.filter((r) => new Date(r.ts) > new Date(video.published));
      since = `<div class="since-video"><b>${after.length ? `+${after.length}` : "No"}</b> new report${after.length === 1 ? "" : "s"} since this video${after.length ? ` from ${new Set(after.map((r) => r.src)).size} outlet(s)` : ""}. Last update ${esc(ago(s.last))}.</div>`;
    }
    const regions = Object.entries(s.coverage || {}), maxR = Math.max(1, ...regions.map((r) => r[1]));
    main.innerHTML = `
      ${video ? videoBlock(video, since) : ""}
      <div class="slate" style="--c:${cvar(s.desk)}">
        <span class="bug">WERLD/ STORY</span><b class="code" title="Story code">${esc(code)}</b>
        <span class="dk">${esc(DESK[s.desk]?.[1] || "")}</span>${chips(s)}
      </div>
      <h1 class="story-h">${esc(s.title)}</h1>
      <p class="credit">Headline as published by <b>${esc(s.lead)}</b>. WERLD/ does not rewrite headlines.</p>
      <div class="facts">
        <div><small>FIRST SEEN</small><b>${esc(when(s.first))}</b></div>
        <div><small>LAST UPDATE</small><b>${esc(ago(s.last))}</b></div>
        <div><small>OUTLETS</small><b>${n}</b></div>
        <div><small>INDEPENDENT ORIGINS</small><b>${s.origins}</b></div>
        <div><small>WHERE</small><b>${esc(s.places.slice(0, 3).join(", ") || "—")}</b></div>
      </div>
      ${newSince ? `<div class="since"><span><b>+${newSince}</b> new report${newSince > 1 ? "s" : ""} since you last opened this story.</span></div>` : ""}
      <div class="story-grid">
        <section>
          <div class="sect">TIMELINE <small>${s.timeline.length} REPORTS · NEWEST FIRST · ${esc(tzShort)}</small></div>
          <ol class="tl">${s.timeline.map((r, i) => `<li${i >= s.timeline.length - 1 ? ' class="origin"' : ""}><time>${esc(when(r.ts))}</time><div><b>${esc(r.src)}</b><a href="${esc(safe(r.url))}" target="_blank" rel="noopener">${esc(r.title)} ↗</a>${i === s.timeline.length - 1 ? `<small>FIRST REPORT</small>` : ""}</div></li>`).join("")}</ol>
          ${s.threads?.length ? `<div class="sect">PART OF</div><div class="row-btns">${s.threads.map((t) => `<a class="btn quiet" href="${ROOT}t/${esc(t)}/">[ THREAD: ${esc(t.replace(/-/g, " ").toUpperCase())} ]</a>`).join(" ")}</div>` : ""}
          ${s.related?.length ? `<div class="sect">ALSO IN ${esc((s.places[0] || "").toUpperCase())}</div>${s.related.map((r) => `<a class="item rel" href="${S(r.id)}"><span class="dk" style="--c:${cvar(r.desk)}">${esc(DESK[r.desk]?.[1] || "")}</span>${esc(r.title)}<small>${esc(ago(r.last))}</small></a>`).join("")}` : ""}
        </section>
        <aside>
          <section class="panel"><header>WHO'S REPORTING</header>
            <div class="cov">${regions.map(([r, c]) => `<div><span>${esc(r)}</span><i style="--w:${(c / maxR) * 100}%"></i><em>${c}</em></div>`).join("")}</div>
            <div class="kinds">${Object.entries(s.kinds || {}).map(([k, c]) => `<span>${c} ${esc(k)}</span>`).join(" · ")}</div>
            <p class="note">${s.origins < n ? `${n - s.origins} of these ${n} outlets carried near-identical wording, so they count as one origin.` : "Each outlet's report is worded independently."}</p>
          </section>
          ${s.pin ? `<section class="panel"><header>WHERE <small>${esc(s.pin.place.toUpperCase())}</small></header><div class="mini" id="smap"></div></section>` : ""}
          <section class="panel"><header>SHARE</header><div class="share">
            <button class="btn" id="copy" type="button">[ COPY LINK ]</button>
            <a class="btn quiet" href="https://github.com/karambinning/werld/issues/new?title=${encodeURIComponent(`Correction: story ${code}`)}&body=${encodeURIComponent(`Story: ${location.href}\n\nWhat's wrong:\n`)}" target="_blank" rel="noopener">[ REPORT AN ERROR ]</a>
          </div></section>
        </aside>
      </div>`;
    $("#copy").onclick = async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname); $("#copy").textContent = "[ COPIED ]"; } catch { $("#copy").textContent = "[ COPY FAILED ]"; } };
    if (s.pin) miniMap($("#smap"), [{ lat: s.pin.lat, lon: s.pin.lon, desk: s.desk }], s.pin);
  }

  async function miniMap(el, pins, focus) {
    try {
      await loadScripts();
      const w = await (await fetch(WORLD)).json(), land = topojson.feature(w, w.objects.countries);
      const W = 340, Hh = 190, proj = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, Hh - 4]], { type: "Sphere" });
      if (focus) proj.rotate([-focus.lon, 0]).fitExtent([[4, 4], [W - 4, Hh - 4]], { type: "Sphere" });
      const path = d3.geoPath(proj), svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${Hh}`);
      svg.append("g").selectAll("path").data(land.features).join("path").attr("d", path).attr("fill", "#0b1a30").attr("stroke", "#1d3150").attr("stroke-width", .5);
      const g = svg.append("g").selectAll("g").data(pins).join("g").attr("transform", (d) => `translate(${proj([d.lon, d.lat])})`);
      g.append("circle").attr("r", 9).attr("fill", "none").attr("stroke", (d) => cvar(d.desk)).attr("class", "pingc");
      g.append("circle").attr("r", 4).attr("fill", (d) => cvar(d.desk));
    } catch { el.innerHTML = `<div class="empty">Map unavailable.</div>`; }
  }
  let scriptsP;
  function loadScripts() {
    return scriptsP ||= Promise.all(["https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js", "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"]
      .map((src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); })));
  }

  // ---------- thread ----------
  async function thread(slug) {
    let t;
    try { t = await getJSON(`data/t/${slug}.json`); } catch { return fail(`There's no thread called <b>${esc(slug)}</b>.`); }
    document.title = `${t.title} · WERLD/ thread`;
    const max = Math.max(1, ...t.activity.map((a) => a.n));
    let html = "", last = "";
    for (const s of t.stories) {
      const d = fmtDay.format(new Date(s.last)).toUpperCase();
      if (d !== last) { html += `<div class="day">${esc(d)}</div>`; last = d; }
      html += `<a class="tstory${s.severity === 2 ? " sev2" : ""}" href="${S(s.id)}"><time>${esc(fmtHM.format(new Date(s.last)))}</time>
        <div><span class="chip ${s.status === "confirmed" ? "ok" : "warn"}">${s.status === "confirmed" ? "CONFIRMED" : "SINGLE"}</span>
        <h4>${esc(s.title)}</h4><small>${s.n} outlet${s.n > 1 ? "s" : ""} · ${esc(s.places.join(", "))} · ${esc(s.id)}</small></div></a>`;
    }
    main.innerHTML = `
      <div class="ch-id">● THREAD <span class="tc">${esc(slug)}</span></div>
      <h1 class="big">${esc(t.title.toUpperCase())}</h1>
      <p class="lede">${esc(t.blurb)} <b>${t.count}</b> stories in the last 30 days, <b>${t.count_24h}</b> in the last 24 hours. Stories join this thread automatically by place and topic, so a few may not belong.</p>
      <div class="activity" aria-label="Stories per day, last 7 days">${t.activity.map((a) => `<div><i style="--h:${(a.n / max) * 100}%"></i><small>${esc(new Date(a.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" }).toUpperCase())}</small><em>${a.n}</em></div>`).join("")}</div>
      <div class="thread-tl">${html || `<div class="empty">Nothing on this thread in the last 30 days.</div>`}</div>`;
  }

  // ---------- briefs ----------
  async function edition(n, video) {
    let e;
    try { e = await getJSON(`data/b/${n}.json`); } catch { return fail(`Brief <b>#${esc(n)}</b> doesn't exist yet.`); }
    document.title = `WERLD/ Brief #${e.n}`;
    const [d, half] = [e.slot.slice(0, 10), e.slot.slice(11)];
    main.innerHTML = `${video ? videoBlock(video, "") : ""}
      <div class="ch-id">● BRIEF #${e.n} <span class="tc">${half === "am" ? "MORNING" : "EVENING"} EDITION</span></div>
      <h1 class="big">BRIEF #${e.n}</h1>
      <p class="lede">${esc(fmtDay.format(new Date(d + "T12:00:00")))}, ${half === "am" ? "morning" : "evening"} edition, frozen ${esc(when(e.frozen))}. These were the top stories at that moment. Each one links to its live story page, which keeps updating.</p>
      <ol class="ed">${e.items.map((s, i) => `<li id="${i + 1}" style="--c:${cvar(s.desk)}"><b class="no">${String(i + 1).padStart(2, "0")}</b>
        <div><div class="k">${esc(DESK[s.desk]?.[0].toUpperCase() || "")}${s.places.length ? " · " + esc(s.places.slice(0, 2).join(" / ").toUpperCase()) : ""}</div>
        <h3><a href="${S(s.id)}">${esc(s.title)}</a></h3>
        <small>${esc(s.sources.slice(0, 4).join(" · "))} · ${s.sources.length} outlet${s.sources.length > 1 ? "s" : ""} · <span class="code-s">${esc(s.id)}</span></small></div></li>`).join("")}</ol>
      <div class="row-btns" style="margin-top:20px">${Number(e.n) > 1 ? `<a class="btn quiet" href="../${e.n - 1}/">[ ← BRIEF #${e.n - 1} ]</a>` : ""}<a class="btn quiet" href="${ROOT}b/">[ ALL BRIEFS ]</a></div>`;
    if (location.hash) document.getElementById(location.hash.slice(1))?.classList.add("hit");
  }
  async function editions() {
    let x;
    try { x = await getJSON("data/b/index.json"); } catch { return fail("No briefs yet."); }
    main.innerHTML = `<div class="ch-id">● BRIEFS</div><h1 class="big">EVERY BRIEF</h1>
      <p class="lede">A new numbered brief is frozen every day at 07:00 and 18:00 UK time. When a WERLD/ video says "Brief #12, item 3", this is where it lives.</p>
      <div class="list">${x.editions.map((e) => `<a class="item big-i" href="${ROOT}b/${e.n}/"><b>#${e.n}</b><span>${esc(e.lead)}</span><small>${esc(e.slot.replace("-am", " · morning").replace("-pm", " · evening"))}</small></a>`).join("")}</div>`;
  }

  // ---------- videos ----------
  async function videos() {
    let x;
    try { x = await getJSON("data/videos.json"); } catch { x = { videos: [] }; }
    main.innerHTML = `<div class="ch-id">● VIDEOS</div><h1 class="big">WERLD/ VIDEOS</h1>
      <p class="lede">Short intelligence briefs on TikTok and Instagram Reels. Every video has a number: this page has the sources behind each one, and what has changed since.</p>
      ${x.videos.length ? `<div class="vgrid">${x.videos.map((v) => `<a class="vcard" href="${ROOT}v/${v.n}/"><b>#${v.n}</b><span>${esc(v.title || "")}</span><small>${v.published ? esc(when(v.published)) : ""}</small></a>`).join("")}</div>`
        : `<div class="empty">The first WERLD/ videos are on their way.<br><a href="${ROOT}b/" style="color:var(--phos)">Read the latest brief →</a></div>`}`;
  }
  async function video(n) {
    let x;
    try { x = await getJSON("data/videos.json"); } catch { return fail("Video list unavailable."); }
    const v = x.videos.find((y) => String(y.n) === String(n));
    if (!v) return fail(`There's no video <b>#${esc(n)}</b> yet.`);
    document.title = `#${v.n} ${v.title || ""} · WERLD/`;
    if (v.story) return story(v.story, v);
    if (v.brief) return edition(v.brief, v);
    main.innerHTML = videoBlock(v, "");
  }

  ({ story: () => story(KEY), thread: () => thread(KEY), edition: () => edition(KEY), editions, video: () => video(KEY), videos }[KIND] || (() => fail("Unknown page.")))();
})();
