/* WERLD — client. Reads data/feed.json (built from the Intel Engine) and draws the channels. */
(() => {
  "use strict";
  const FEED = "data/feed.json";
  const POLL_MS = 60_000;
  const WORLD = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const DESK_VAR = { world: "--d-world", conflict: "--d-conflict", defence: "--d-defence", cyber: "--d-cyber", ai: "--d-ai", markets: "--d-markets", hazards: "--d-hazards" };
  const REGIONS = ["Europe", "Middle East", "Africa", "Asia", "Americas", "Oceania"];

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let feed = null, byId = new Map(), knownIds = null, pendingNew = 0;
  const filt = { desk: null, region: null, q: "", multi: false, limit: 60 };
  const lastVisit = Number(store.get("werld.lastVisit")) || 0;
  setTimeout(() => store.set("werld.lastVisit", String(Date.now())), 20_000);
  addEventListener("pagehide", () => store.set("werld.lastVisit", String(Date.now())));

  // ---------- time, in the reader's zone ----------
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmtHM = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" });
  const fmtShort = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const tzShort = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || tz;
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  function dayLabel(d) {
    const now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return "TODAY";
    if (dayKey(d) === dayKey(y)) return "YESTERDAY";
    return fmtDay.format(d).toUpperCase();
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  }
  function when(iso) {
    const d = new Date(iso);
    return dayKey(d) === dayKey(new Date()) ? fmtHM.format(d) : fmtShort.format(d);
  }

  // ---------- tube ----------
  const cv = $("#static"), cx = cv.getContext("2d");
  function noise() {
    cv.width = 160; cv.height = 100;
    const img = cx.createImageData(160, 100);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    cx.putImageData(img, 0, 0);
  }
  let noiseT = setInterval(noise, 90);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setTube(on) {
    document.documentElement.classList.toggle("notube", !on);
    $("#tube").textContent = `TUBE: ${on ? "ON" : "OFF"}`;
    store.set("werld.tube", on ? "1" : "0");
    clearInterval(noiseT); if (on) noiseT = setInterval(noise, 90);
  }
  setTube(store.get("werld.tube") !== "0" && !reduce);
  $("#tube").onclick = () => setTube(document.documentElement.classList.contains("notube"));

  // ---------- clock + timecode ----------
  const t0 = performance.now();
  function tick() {
    const n = new Date();
    $("#clock").textContent = n.toLocaleTimeString(undefined, { hour12: false });
    $("#tz").textContent = tzShort;
    const e = Math.floor((performance.now() - t0) / 1000), f = Math.floor(((performance.now() - t0) % 1000) / 40);
    const tc = [Math.floor(e / 3600), Math.floor(e / 60) % 60, e % 60, f].map((x) => String(x).padStart(2, "0")).join(":");
    document.querySelectorAll(".tc").forEach((el) => (el.textContent = tc));
  }
  setInterval(tick, 40); tick();

  // ---------- channels ----------
  const CH = ["live", "brief", "map", "desks", "method"];
  let current = null;
  function go(ch, instant) {
    if (!CH.includes(ch)) ch = "live";
    document.querySelectorAll("nav.ch a").forEach((a) => (a.dataset.ch === ch ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    const next = $(`#ch-${ch}`), prev = current && $(`#ch-${current}`);
    if (ch === current) return;
    const show = () => {
      if (prev) prev.classList.remove("active", "out");
      next.classList.add("active");
      if (!instant && !reduce) {
        next.classList.add("in"); setTimeout(() => next.classList.remove("in"), 600);
        const b = $(".beam"); b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
        cv.style.opacity = ".32"; setTimeout(() => (cv.style.opacity = ""), 260);
      }
      scrollTo({ top: 0 });
      if (ch === "map") drawMap();
    };
    current = ch;
    if (prev && !instant && !reduce) { prev.classList.add("out"); setTimeout(show, 400); } else show();
    termSay(`> tune ch ${String(CH.indexOf(ch) + 1).padStart(2, "0")} ${ch}`);
  }
  addEventListener("hashchange", () => go(location.hash.slice(1)));
  addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) return;
    const i = CH.indexOf(current);
    if (e.key === "ArrowRight") location.hash = CH[(i + 1) % CH.length];
    if (e.key === "ArrowLeft") location.hash = CH[(i + CH.length - 1) % CH.length];
    if (e.key === "/") { e.preventDefault(); location.hash = "live"; setTimeout(() => $("#q").focus(), 450); }
  });

  // ---------- terminal line ----------
  let termTimer;
  function termSay(s) {
    const el = $("#term"); clearInterval(termTimer); let i = 0;
    termTimer = setInterval(() => { el.textContent = s.slice(0, ++i); if (i >= s.length) clearInterval(termTimer); }, 18);
  }

  // ---------- data ----------
  async function load(first) {
    let data;
    try {
      const r = await fetch(`${FEED}?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
    } catch (e) {
      setStatus(false, "FEED UNREACHABLE");
      return;
    }
    const ids = new Set(data.stories.map((s) => s.id));
    if (knownIds && !first) {
      const fresh = [...ids].filter((i) => !knownIds.has(i)).length;
      if (fresh) { pendingNew += fresh; const p = $("#newpill"); p.textContent = `▲ ${pendingNew} NEW ${pendingNew === 1 ? "STORY" : "STORIES"}`; p.classList.add("show"); }
    }
    knownIds = ids;
    feed = data; byId = new Map(data.stories.map((s) => [s.id, s]));
    const genAge = (Date.now() - new Date(data.generated)) / 60000;
    const ok = data.engine.ok && genAge < 45;
    setStatus(ok, ok ? "LIVE" : `STALE · ${ago(data.generated).toUpperCase()}`);
    renderAll();
    if (first) termSay(`> werld --live  ·  ${data.stories.length} stories  ·  ${data.engine.pulled} reports scanned  ·  engine ${data.engine.ok ? "ok" : "down"}`);
  }
  function setStatus(ok, text) {
    $("#readout").classList.toggle("stale", !ok);
    $("#st").textContent = text;
  }
  $("#newpill").onclick = () => { pendingNew = 0; $("#newpill").classList.remove("show"); location.hash = "live"; scrollTo({ top: 0, behavior: "smooth" }); };

  function deskOf(id) { return feed.desks.find((d) => d.id === id) || { name: id, code: id.slice(0, 3).toUpperCase() }; }
  const cvar = (desk) => `var(${DESK_VAR[desk] || "--phos"})`;

  function renderAll() {
    renderTicker(); renderFacets(); renderStream(); renderTop(); renderBrief(); renderDesks(); renderMethod();
    if (mapReady) { drawPins(); drawMini(); }
  }

  // ---------- ticker ----------
  function renderTicker() {
    const items = feed.brief.map((i) => byId.get(i)).concat(feed.stories.filter((s) => s.sources.length > 1).slice(0, 14))
      .filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 20);
    const html = items.map((s) => `<a href="${esc(safeUrl(s.sources[0].url))}" target="_blank" rel="noopener"><b style="color:${cvar(s.desk)}">${esc(deskOf(s.desk).code)}</b>${esc(s.title)}</a>`).join("");
    const t = $("#track"); t.innerHTML = html + html;
    t.style.setProperty("--dur", `${Math.max(60, items.length * 9)}s`);
  }

  // ---------- facets ----------
  function renderFacets() {
    const pool = feed.stories;
    const dk = feed.desks.filter((d) => d.count > 0);
    $("#f-desk").innerHTML = [`<button type="button" data-d="" aria-pressed="${!filt.desk}" style="--c:var(--text)"><i></i>All desks<em>${pool.length}</em></button>`]
      .concat(dk.map((d) => `<button type="button" data-d="${d.id}" aria-pressed="${filt.desk === d.id}" style="--c:${cvar(d.id)}"><i></i>${esc(d.name)}<em>${d.count}</em></button>`)).join("");
    const rc = Object.fromEntries(REGIONS.map((r) => [r, pool.filter((s) => s.region === r).length]));
    $("#f-region").innerHTML = [`<button type="button" data-r="" aria-pressed="${!filt.region}"><i style="background:var(--text)"></i>Everywhere</button>`]
      .concat(REGIONS.filter((r) => rc[r]).map((r) => `<button type="button" data-r="${r}" aria-pressed="${filt.region === r}"><i style="background:var(--rule2)"></i>${r}<em>${rc[r]}</em></button>`)).join("");
  }
  $("#f-desk").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filt.desk = b.dataset.d || null; filt.limit = 60; renderFacets(); renderStream(); };
  $("#f-region").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filt.region = b.dataset.r || null; filt.limit = 60; renderFacets(); renderStream(); };
  $("#f-multi").onclick = (e) => { filt.multi = !filt.multi; e.currentTarget.setAttribute("aria-pressed", filt.multi); filt.limit = 60; renderStream(); };
  let qT; $("#q").oninput = (e) => { clearTimeout(qT); qT = setTimeout(() => { filt.q = e.target.value.trim().toLowerCase(); filt.limit = 60; renderStream(); }, 120); };
  $("#more").onclick = () => { filt.limit += 60; renderStream(); };

  // ---------- story row ----------
  function storyRow(s, opts = {}) {
    const d = deskOf(s.desk), n = s.sources.length;
    const fresh = lastVisit && new Date(s.first) > lastVisit;
    const names = s.sources.slice(0, 3).map((x) => esc(x.name)).join(" · ") + (n > 3 ? ` +${n - 3}` : "");
    const pl = s.places.slice(0, 3).map(esc).join(", ");
    return `<article class="story${fresh ? " fresh" : ""}${s.severity === 2 ? " sev2" : ""}" data-id="${s.id}">
      <div class="t">${when(s.last)}</div>
      <span class="dk" style="--c:${cvar(s.desk)}">${esc(d.code)}</span>
      <h4><a href="${esc(safeUrl(s.sources[0].url))}" target="_blank" rel="noopener">${esc(s.title)}</a></h4>
      ${s.summary && !opts.compact ? `<p class="sum">${esc(s.summary)}</p>` : ""}
      <div class="meta">
        <span class="src">${names}</span>
        ${n > 1 ? `<button type="button" data-open>${n} outlets ▾</button>` : ""}
        ${pl ? `<span class="pl">${pl}</span>` : ""}
        ${s.first !== s.last && n > 1 ? `<span>first seen ${when(s.first)}</span>` : ""}
      </div>
      ${n > 1 ? `<div class="srcs">${s.sources.map((x) => `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener"><b>${esc(x.name)}</b><span>${when(x.ts)}</span><em>${esc(x.title)}</em></a>`).join("")}</div>` : ""}
    </article>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]"); if (!b) return;
    const a = b.closest(".story"); a.classList.toggle("open");
    b.textContent = b.textContent.replace(/[▾▴]/, a.classList.contains("open") ? "▴" : "▾");
  });

  // ---------- LIVE ----------
  function filtered() {
    return feed.stories.filter((s) =>
      (!filt.desk || s.desk === filt.desk) &&
      (!filt.region || s.region === filt.region) &&
      (!filt.multi || s.sources.length > 1) &&
      (!filt.q || (s.title + " " + s.places.join(" ") + " " + s.sources.map((x) => x.name + " " + x.title).join(" ")).toLowerCase().includes(filt.q)));
  }
  function renderStream() {
    const list = filtered();
    const multi = feed.stories.filter((s) => s.sources.length > 1).length;
    const outlets = new Set(feed.stories.flatMap((s) => s.sources.map((x) => x.name))).size;
    $("#lede-live").innerHTML = `<b>${feed.stories.length}</b> stories from <b>${outlets}</b> outlets in the last ${feed.window_hours} hours, <b>${multi}</b> of them confirmed by more than one outlet. Updated ${esc(ago(feed.generated))}. Times in <b>${esc(tzShort)}</b>.`;
    if (lastVisit) {
      const n = feed.stories.filter((s) => new Date(s.first) > lastVisit).length;
      const el = $("#since"); el.hidden = false;
      el.innerHTML = `<span>Since your last visit at <b>${when(new Date(lastVisit).toISOString())}</b>: <b>${n}</b> new ${n === 1 ? "story" : "stories"}.</span>`;
    }
    let html = "", lastDay = "";
    const shown = list.slice(0, filt.limit);
    for (const s of shown) {
      const lbl = dayLabel(new Date(s.last));
      if (lbl !== lastDay) {
        const cnt = list.filter((x) => dayLabel(new Date(x.last)) === lbl).length;
        html += `<div class="day">${lbl} <em>${cnt}</em></div>`; lastDay = lbl;
      }
      html += storyRow(s);
    }
    $("#stream").innerHTML = html || `<div class="empty">Nothing on the wire matches that.</div>`;
    $("#more").hidden = list.length <= filt.limit;
  }
  function renderTop() {
    $("#top5").innerHTML = feed.brief.slice(0, 5).map((id, i) => {
      const s = byId.get(id); if (!s) return "";
      return `<li><b>${i + 1}</b><div><a href="${esc(safeUrl(s.sources[0].url))}" target="_blank" rel="noopener">${esc(s.title)}</a><small>${esc(deskOf(s.desk).name.toUpperCase())} · ${s.sources.length} outlet${s.sources.length > 1 ? "s" : ""} · ${esc(ago(s.last))}</small></div></li>`;
    }).join("");
  }

  // ---------- BRIEF ----------
  function renderBrief() {
    const d = new Date(feed.generated);
    $("#brief").innerHTML = feed.brief.map((id, i) => {
      const s = byId.get(id); if (!s) return "";
      const n = s.sources.length;
      return `<article class="bc${i === 0 ? " lead" : ""}" style="--c:${cvar(s.desk)}">
        <div class="no">${String(i + 1).padStart(2, "0")}</div>
        <div class="k">${esc(deskOf(s.desk).name.toUpperCase())}${s.places.length ? " · " + esc(s.places.slice(0, 2).join(" / ").toUpperCase()) : ""}</div>
        <h3><a href="${esc(safeUrl(s.sources[0].url))}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
        <div class="meta"><span class="src">${s.sources.slice(0, 4).map((x) => esc(x.name)).join(" · ")}</span><span class="n">${n} outlet${n > 1 ? "s" : ""}</span><span>${esc(ago(s.last))}</span></div>
      </article>`;
    }).join("");
    $("#h-brief").textContent = `THE BRIEF · ${fmtDay.format(d).toUpperCase()}`;
  }
  $("#copybrief").onclick = async () => {
    const lines = [`WERLD/ BRIEF · ${fmtDay.format(new Date(feed.generated))}`, ""];
    feed.brief.forEach((id, i) => { const s = byId.get(id); if (s) lines.push(`${i + 1}. ${s.title} (${s.sources.map((x) => x.name).slice(0, 3).join(", ")})`); });
    lines.push("", "WERLD/ live intelligence engine from binning.ai");
    try { await navigator.clipboard.writeText(lines.join("\n")); $("#copybrief").textContent = "[ COPIED ]"; }
    catch { $("#copybrief").textContent = "[ COPY FAILED ]"; }
    setTimeout(() => ($("#copybrief").textContent = "[ COPY AS TEXT ]"), 1600);
  };

  // ---------- DESKS ----------
  function renderDesks() {
    $("#desks").innerHTML = feed.desks.filter((d) => d.count).map((d) => {
      const items = feed.stories.filter((s) => s.desk === d.id).slice(0, 8);
      return `<section class="desk" style="--c:${cvar(d.id)}"><header><b>${esc(d.name.toUpperCase())}</b><small>${d.count} STORIES</small></header>
        ${items.map((s) => `<a class="item" href="${esc(safeUrl(s.sources[0].url))}" target="_blank" rel="noopener">${esc(s.title)}<small>${when(s.last)} · ${s.sources.slice(0, 2).map((x) => esc(x.name)).join(" · ")}${s.sources.length > 2 ? ` +${s.sources.length - 2}` : ""}</small></a>`).join("")}</section>`;
    }).join("");
  }

  // ---------- METHOD ----------
  function renderMethod() {
    const e = feed.engine;
    const agent = e.agents && e.agents[0];
    $("#pipeline").innerHTML =
`<b>$</b> werld status
  engine      Binning.AI Intel Engine · collector <em>${esc(agent ? agent.name : "?")}</em> ${esc(agent ? agent.status : "")}
  archive     ${Number(e.items_total || 0).toLocaleString()} reports collected to date
  last ingest ${esc(e.last_ingest ? ago(e.last_ingest) : "unknown")}
  this build  ${e.pulled} scanned → ${e.kept} kept → ${feed.stories.length} stories
  window      last ${feed.window_hours} hours · built ${esc(ago(feed.generated))}

<b>$</b> werld pipeline
  1  <b>collect</b>   the engine reads news wires, regional press, defence and
                security outlets, government sources and hazard alerts
  2  <b>select</b>    only public news desks reach WERLD
  3  <b>clean</b>     strip markup, name the outlet, drop duplicates
  4  <b>merge</b>     the same event from many outlets becomes one story
  5  <b>place</b>     countries and cities in the headline are pinned
  6  <b>rank</b>      outlets reporting × severity × recency → the brief
  7  <b>publish</b>   rebuilt every few minutes; this page re-checks every minute`;
    const outlets = new Set(feed.stories.flatMap((s) => s.sources.map((x) => x.name))).size;
    $("#stats").innerHTML = [
      [feed.stories.length, "STORIES LIVE"], [outlets, "OUTLETS"],
      [feed.stories.filter((s) => s.sources.length > 1).length, "MULTI-OUTLET"], [feed.stories.filter((s) => s.pin).length, "PINNED ON MAP"],
    ].map(([v, l]) => `<div><b>${Number(v).toLocaleString()}</b><small>${l}</small></div>`).join("");
  }

  // ---------- MAP ----------
  let mapReady = false, land = null, mapSel = null;
  async function ensureWorld() {
    if (land) return land;
    if (!window.d3 || !window.topojson) return null;
    try {
      const w = await (await fetch(WORLD)).json();
      land = topojson.feature(w, w.objects.countries);
      mapReady = true;
      return land;
    } catch { return null; }
  }
  function pinGroups() {
    const g = new Map();
    for (const s of feed.stories) {
      if (!s.pin) continue;
      const k = s.pin.place;
      if (!g.has(k)) g.set(k, { place: k, lat: s.pin.lat, lon: s.pin.lon, stories: [], sev: 0, desks: {} });
      const o = g.get(k); o.stories.push(s); o.sev = Math.max(o.sev, s.severity); o.desks[s.desk] = (o.desks[s.desk] || 0) + 1;
    }
    for (const o of g.values()) o.desk = Object.entries(o.desks).sort((a, b) => b[1] - a[1])[0][0];
    return [...g.values()].sort((a, b) => b.stories.length - a.stories.length);
  }
  function baseMap(el, w, h) {
    el.querySelector("svg")?.remove();
    const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [w - 6, h - 6]], { type: "Sphere" });
    const path = d3.geoPath(proj);
    const svg = d3.select(el).insert("svg", ":first-child").attr("viewBox", `0 0 ${w} ${h}`).attr("preserveAspectRatio", "xMidYMid meet");
    svg.append("path").attr("class", "grat").attr("d", path(d3.geoGraticule10()));
    svg.append("g").selectAll("path").data(land.features).join("path").attr("class", "land").attr("d", path);
    return { svg, proj };
  }
  async function drawMap() {
    if (!feed) return;
    if (!(await ensureWorld())) { $("#map").insertAdjacentHTML("beforeend", `<div class="empty">Map unavailable offline.</div>`); return; }
    drawPins(); drawMini();
    $("#legend").innerHTML = feed.desks.filter((d) => d.count).map((d) => `<span style="--c:${cvar(d.id)}"><i></i>${esc(d.name)}</span>`).join("");
  }
  function drawPins() {
    const el = $("#map"); if (!el || !land) return;
    const { svg, proj } = baseMap(el, 960, 505);
    const groups = pinGroups(), max = groups[0]?.stories.length || 1;
    const tip = $("#tip");
    const g = svg.append("g").selectAll("g").data(groups).join("g")
      .attr("class", (d) => `pin${d.sev === 2 ? " sev" : ""}${mapSel === d.place ? " sel" : ""}`)
      .attr("transform", (d) => `translate(${proj([d.lon, d.lat])})`)
      .attr("style", (d) => `--c:${cvar(d.desk)}`)
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", (d) => `${d.place}: ${d.stories.length} stories`);
    const r = (d) => 3 + Math.sqrt(d.stories.length / max) * 11;
    g.append("circle").attr("class", "halo").attr("r", (d) => r(d) + 3);
    g.append("circle").attr("class", "core").attr("r", r).attr("opacity", .85);
    g.on("mouseenter", (ev, d) => {
      const box = el.getBoundingClientRect();
      tip.style.display = "block";
      tip.innerHTML = `<b>${esc(d.place.toUpperCase())}</b>${d.stories.length} stories · latest: ${esc(d.stories[0].title)}`;
      tip.style.left = Math.min(ev.clientX - box.left + 12, box.width - 290) + "px";
      tip.style.top = (ev.clientY - box.top + 12) + "px";
    }).on("mouseleave", () => (tip.style.display = "none"))
      .on("click keydown", (ev, d) => { if (ev.type === "keydown" && ev.key !== "Enter") return; selectPlace(d.place); });
    if (!mapSel && groups[0]) selectPlace(groups[0].place);
    else if (mapSel) selectPlace(mapSel, true);
  }
  function selectPlace(place, quiet) {
    mapSel = place;
    document.querySelectorAll("#map .pin").forEach((p) => p.classList.toggle("sel", p.getAttribute("aria-label").startsWith(place + ":")));
    const list = feed.stories.filter((s) => s.places.includes(place));
    $("#place-h").innerHTML = `${esc(place.toUpperCase())} <small>${list.length} STORIES</small>`;
    $("#place-list").innerHTML = list.slice(0, 40).map((s) => storyRow(s, { compact: true })).join("");
    if (!quiet) $("#place-list").scrollTop = 0;
  }
  function drawMini() {
    const el = $("#mini"); if (!el || !land) return;
    const { svg, proj } = baseMap(el, 340, 200);
    const groups = pinGroups().slice(0, 40), max = groups[0]?.stories.length || 1;
    svg.append("g").selectAll("circle").data(groups).join("circle")
      .attr("cx", (d) => proj([d.lon, d.lat])[0]).attr("cy", (d) => proj([d.lon, d.lat])[1])
      .attr("r", (d) => 1.6 + Math.sqrt(d.stories.length / max) * 5)
      .attr("fill", (d) => cvar(d.desk)).attr("opacity", .85);
    svg.style("cursor", "pointer").on("click", () => (location.hash = "map"));
  }

  // ---------- boot ----------
  go(location.hash.slice(1) || "live", true);
  load(true).then(() => ensureWorld().then(() => { if (land) { drawMini(); if (current === "map") drawMap(); } }));
  setInterval(() => load(false), POLL_MS);
  setInterval(() => { if (feed) { renderTop(); } }, 60_000);
})();
