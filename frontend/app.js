(() => {
  const meta = document.querySelector('meta[name="api-base"]');
  const API = (meta && meta.content) || location.origin;
  const LIVE_MAX = 100;

  const els = {
    wsDot: document.getElementById("wsDot"),
    wsLabel: document.getElementById("wsLabel"),
    deviceList: document.getElementById("deviceList"),
    emptyDevices: document.getElementById("emptyDevices"),
    emptySerial: document.getElementById("emptySerial"),
    emptyHistory: document.getElementById("emptyHistory"),
    devCount: document.getElementById("devCount"),
    serialTerm: document.getElementById("serialTerm"),
    serialTitle: document.getElementById("serialTitle"),
    serialCount: document.getElementById("serialCount"),
    historyHours: document.getElementById("historyHours"),
    historyTitle: document.getElementById("historyTitle"),
    historyMeta: document.getElementById("historyMeta"),
    sendForm: document.getElementById("sendForm"),
    message: document.getElementById("message"),
    encoding: document.getElementById("encoding"),
    addCrLf: document.getElementById("addCrLf"),
    sendHint: document.getElementById("sendHint"),
    btnSweep: document.getElementById("btnSweep"),
    btnRefreshSerial: document.getElementById("btnRefreshSerial"),
    btnClearSerial: document.getElementById("btnClearSerial"),
    btnExportSerial: document.getElementById("btnExportSerial"),
    btnRefreshHistory: document.getElementById("btnRefreshHistory"),
    filterDir: document.getElementById("filterDir"),
    filterType: document.getElementById("filterType"),
    serialView: document.getElementById("serialView"),
    historyView: document.getElementById("historyView"),
    exportFormat: document.getElementById("exportFormat"),
    panelSerial: document.getElementById("panelSerial"),
    panelHistory: document.getElementById("panelHistory"),
    panelArchive: document.getElementById("panelArchive"),
    archiveTitle: document.getElementById("archiveTitle"),
    archiveDate: document.getElementById("archiveDate"),
    archiveDayList: document.getElementById("archiveDayList"),
    archiveHours: document.getElementById("archiveHours"),
    archiveMeta: document.getElementById("archiveMeta"),
    emptyArchive: document.getElementById("emptyArchive"),
    emptyArchiveDays: document.getElementById("emptyArchiveDays"),
    btnArchivePrev: document.getElementById("btnArchivePrev"),
    btnArchiveNext: document.getElementById("btnArchiveNext"),
    btnRefreshArchive: document.getElementById("btnRefreshArchive"),
    archiveDir: document.getElementById("archiveDir"),
    archiveType: document.getElementById("archiveType"),
    archiveView: document.getElementById("archiveView"),
  };

  let selected = null; // { addr, ip, port }
  /** @type {Array<object>} */
  let live = [];
  /** @type {Array<object>} */
  let history = [];
  /** @type {Array<object>} */
  let archive = [];
  /** @type {Array<{date:string,count:number,rx:number,tx:number}>} */
  let archiveDays = [];
  let archiveSelectedDate = "";
  let activeTab = "serial";
  let ws;
  /** horas expandidas en histórico */
  const openHours = new Set();
  /** horas expandidas en archivo */
  const openArchiveHours = new Set();

  function setWsState(ok) {
    els.wsDot.classList.toggle("on", ok);
    els.wsDot.classList.toggle("off", !ok);
    els.wsLabel.textContent = ok ? "WS conectado" : "WS desconectado";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatTs(ts) {
    try {
      const d = new Date(ts);
      return (
        d.toLocaleTimeString("es-PE", { hour12: false }) +
        "." +
        String(d.getMilliseconds()).padStart(3, "0")
      );
    } catch {
      return ts || "";
    }
  }

  function formatHeader(h) {
    if (!h || typeof h !== "object") return "—";
    const parts = [
      h.event || "data",
      `${h.src_ip || "?"}:${h.src_port ?? "?"}`,
      "→",
      `${h.dst_ip || "?"}:${h.dst_port ?? "?"}`,
      h.payload_len != null ? `len=${h.payload_len}` : "",
      h.protocol || "TCP",
    ].filter(Boolean);
    return parts.join(" ");
  }

  function decimalOf(msg) {
    if (msg.decimal != null && msg.decimal !== "") return String(msg.decimal);
    if (msg.int_value != null) return String(msg.int_value);
    const hex = (msg.hex || "").replace(/[\s:]/g, "");
    if (hex.length >= 2 && hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(String(parseInt(hex.slice(i, i + 2), 16)));
      }
      return bytes.join(" ");
    }
    return "—";
  }

  function hexToAscii(hexRaw) {
    const hex = String(hexRaw || "").replace(/[\s:]/g, "");
    if (!hex || hex.length < 2 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      return "";
    }
    let out = "";
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      out += code >= 0x20 && code <= 0x7e ? String.fromCharCode(code) : ".";
    }
    return out;
  }

  function asciiOf(msg) {
    const fromHex = hexToAscii(msg.hex);
    if (fromHex) return fromHex;
    if (msg.text != null && msg.text !== "" && normalizeType(msg) !== "tcp_header") {
      return String(msg.text).replace(/[^\x20-\x7E]/g, ".");
    }
    return "—";
  }

  function normalizeType(msg) {
    let t = (msg.value_type || msg.encoding || "hex").toLowerCase();
    if (t === "hexadecimal") t = "hex";
    if (t === "text") t = "string";
    return t || "hex";
  }

  function serialViewMode() {
    return (els.serialView && els.serialView.value) || "both";
  }

  function historyViewMode() {
    return (els.historyView && els.historyView.value) || "both";
  }

  function archiveViewMode() {
    return (els.archiveView && els.archiveView.value) || "both";
  }

  function todayDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatDayLabel(dateKey) {
    try {
      const [y, m, d] = dateKey.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString("es-PE", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateKey;
    }
  }

  function shiftDateKey(dateKey, deltaDays) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  /** Clave de hora local: YYYY-MM-DD HH:00 */
  function hourKey(ts) {
    try {
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      return `${y}-${m}-${day} ${h}:00`;
    } catch {
      return "desconocida";
    }
  }

  function parseAddr(addr) {
    if (!addr) return { ip: null, port: null };
    const i = addr.lastIndexOf(":");
    if (i < 0) return { ip: addr, port: null };
    return { ip: addr.slice(0, i), port: Number(addr.slice(i + 1)) || addr.slice(i + 1) };
  }

  function liveRows() {
    const rows = selected
      ? live.filter((m) => !m.addr || m.addr === selected.addr)
      : live;
    return rows.slice(-LIVE_MAX);
  }

  function updateSerialCount() {
    const n = liveRows().length;
    if (els.serialCount) els.serialCount.textContent = `${n} / ${LIVE_MAX}`;
  }

  // ---- Tabs ----
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      els.panelSerial.classList.toggle("active", activeTab === "serial");
      els.panelHistory.classList.toggle("active", activeTab === "history");
      els.panelArchive.classList.toggle("active", activeTab === "archive");
      if (activeTab === "history") loadHistory();
      if (activeTab === "archive") loadArchiveTab();
    });
  });

  // ---- Serial en vivo (máx 100) ----
  function buildSerialLineHtml(msg) {
    const dir = (msg.direction || "rx").toLowerCase();
    const type = normalizeType(msg);
    const hex = msg.hex || "";
    const ascii = asciiOf(msg);
    const dec = decimalOf(msg);
    const hdr = formatHeader(msg.tcp_header);
    const view = serialViewMode();

    if (type === "tcp_header") {
      return (
        `<span class="ts">${esc(formatTs(msg.ts))}</span> ` +
        `<span class="dir">HDR</span> ` +
        `<span class="payload">${esc(msg.text || hdr)}</span>`
      );
    }
    const parts = [
      `<span class="ts">${esc(formatTs(msg.ts))}</span>`,
      `<span class="dir">${esc(dir.toUpperCase())}</span>`,
      `<span class="type-badge type-${esc(type)}">${esc(type.toUpperCase())}</span>`,
    ];
    if (view === "hex" || view === "both" || view === "all") {
      parts.push(`<span class="hex-part">HEX ${esc(hex || "—")}</span>`);
    }
    if (view === "ascii" || view === "both" || view === "all") {
      parts.push(`<span class="ascii-part">ASCII ${esc(ascii)}</span>`);
    }
    if (view === "all") {
      parts.push(`<span class="payload">DEC ${esc(dec)}</span>`);
    }
    return parts.join(" ");
  }

  function appendSerialLine(msg) {
    if (selected && msg.addr && msg.addr !== selected.addr) return;
    const dir = (msg.direction || "rx").toLowerCase();
    const line = document.createElement("div");
    line.className = `line ${dir}`;
    line.innerHTML = buildSerialLineHtml(msg);
    els.serialTerm.appendChild(line);

    // Mantener solo LIVE_MAX nodos visibles
    while (els.serialTerm.children.length > LIVE_MAX) {
      els.serialTerm.removeChild(els.serialTerm.firstChild);
    }
    els.serialTerm.scrollTop = els.serialTerm.scrollHeight;
    els.emptySerial.classList.remove("show");
    updateSerialCount();
  }

  function renderSerial() {
    els.serialTerm.innerHTML = "";
    const rows = liveRows();
    els.emptySerial.classList.toggle("show", rows.length === 0);
    for (const m of rows) {
      const dir = (m.direction || "rx").toLowerCase();
      const line = document.createElement("div");
      line.className = `line ${dir}`;
      line.innerHTML = buildSerialLineHtml(m);
      els.serialTerm.appendChild(line);
    }
    els.serialTerm.scrollTop = els.serialTerm.scrollHeight;
    updateSerialCount();
  }

  function pushLive(msg) {
    const row = {
      addr: msg.addr,
      ip: msg.ip,
      session_id: msg.session_id || null,
      direction: msg.direction || "rx",
      text: msg.text || "",
      hex: msg.hex || "",
      decimal: msg.decimal,
      value_type: msg.value_type || "hex",
      int_value: msg.int_value ?? null,
      tcp_header: msg.tcp_header || null,
      frame_len: msg.frame_len,
      ts: msg.ts || new Date().toISOString(),
    };
    live.push(row);
    if (live.length > LIVE_MAX * 3) live = live.slice(-LIVE_MAX * 2);

    if (activeTab === "serial") {
      if (!selected || !row.addr || row.addr === selected.addr) {
        appendSerialLine(row);
      } else {
        updateSerialCount();
      }
    }
  }

  async function refreshSerial() {
    els.sendHint.textContent = "Actualizando serial…";
    try {
      await loadDevices();
      const q = selected
        ? `addr=${encodeURIComponent(selected.addr)}&limit=${LIVE_MAX}`
        : `limit=${LIVE_MAX}`;
      const r = await fetch(`${API}/api/messages?${q}`);
      const data = await r.json();
      live = (data.messages || []).slice(-LIVE_MAX);
      renderSerial();
      els.sendHint.textContent = `Serial · últimas ${liveRows().length} tramas (máx ${LIVE_MAX})`;
    } catch (e) {
      els.sendHint.textContent = String(e);
    }
  }

  // ---- Export JSON sesión IP:puerto ----
  function exportFrame(msg, format) {
    const base = {
      ts: msg.ts,
      direction: msg.direction || "rx",
      value_type: normalizeType(msg),
    };
    if (format === "hex") return { ...base, hex: msg.hex || "" };
    if (format === "decimal") return { ...base, decimal: decimalOf(msg) };
    if (format === "ascii") return { ...base, ascii: asciiOf(msg) };
    return {
      ...base,
      hex: msg.hex || "",
      decimal: decimalOf(msg),
      ascii: asciiOf(msg),
      frame_len: msg.frame_len ?? null,
      text: msg.text || "",
    };
  }

  function exportSerialJson() {
    if (!selected || !selected.addr) {
      els.sendHint.textContent = "Selecciona un dispositivo (IP:puerto) para exportar.";
      return;
    }
    const format = (els.exportFormat && els.exportFormat.value) || "all";
    const { ip, port } = parseAddr(selected.addr);
    const frames = live
      .filter((m) => m.addr === selected.addr)
      .slice(-LIVE_MAX)
      .map((m) => exportFrame(m, format));

    const payload = {
      exported_at: new Date().toISOString(),
      source: "serial_live",
      format,
      session: {
        ip,
        port,
        addr: selected.addr,
        session_id: selected.session_id || frames[0]?.session_id || null,
      },
      count: frames.length,
      frames,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const safeIp = String(ip || "ip").replace(/[^\w.-]/g, "_");
    a.href = URL.createObjectURL(blob);
    a.download = `serial_${safeIp}_${port || "port"}_${format}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    els.sendHint.textContent = `Exportado ${frames.length} trama(s) · ${format} · ${selected.addr}`;
  }

  // ---- Histórico agrupado por hora ----
  function passesHistoryFilters(msg) {
    return passesMessageFilters(msg, els.filterDir, els.filterType);
  }

  function passesArchiveFilters(msg) {
    return passesMessageFilters(msg, els.archiveDir, els.archiveType);
  }

  function passesMessageFilters(msg, dirEl, typeEl) {
    const dir = (msg.direction || "rx").toLowerCase();
    const type = normalizeType(msg);
    if (selected && msg.addr && msg.addr !== selected.addr) return false;
    if (dirEl && dirEl.value !== "all" && dir !== dirEl.value) return false;
    if (typeEl && typeEl.value !== "all" && type !== typeEl.value) return false;
    return true;
  }

  function groupByHour(rows) {
    const map = new Map();
    for (const msg of rows) {
      const key = hourKey(msg.ts);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(msg);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }

  function renderHourGroups(container, rows, viewMode, openSet, metaEl, titlePrefix) {
    container.innerHTML = "";
    const groups = groupByHour(rows);
    const showHex = viewMode === "hex" || viewMode === "both";
    const showAscii = viewMode === "ascii" || viewMode === "both";

    if (metaEl) {
      metaEl.textContent =
        `${titlePrefix}${groups.length} hora(s) · ${rows.length} trama(s)` +
        (selected ? ` · ${selected.addr}` : "");
    }

    for (const [hour, msgs] of groups) {
      const rx = msgs.filter((m) => (m.direction || "rx") === "rx").length;
      const tx = msgs.filter((m) => m.direction === "tx").length;

      const section = document.createElement("details");
      section.className = "hour-block";
      section.open = openSet.has(hour);
      section.addEventListener("toggle", () => {
        if (section.open) openSet.add(hour);
        else openSet.delete(hour);
      });

      const summary = document.createElement("summary");
      summary.innerHTML =
        `<span class="hour-label">${esc(hour)}</span>` +
        `<span class="hour-meta">${msgs.length} tramas · RX ${rx} · TX ${tx}</span>`;
      section.appendChild(summary);

      const table = document.createElement("table");
      table.className = "capture-table";
      table.innerHTML =
        `<thead><tr>` +
        `<th>Hora</th><th>Dir</th><th>Tipo</th>` +
        (showHex ? `<th>HEX</th>` : "") +
        (showAscii ? `<th>ASCII</th>` : "") +
        `<th>Decimal</th><th>Dispositivo</th>` +
        `</tr></thead>`;
      const tbody = document.createElement("tbody");

      const ordered = [...msgs].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
      for (const msg of ordered) {
        const dir = (msg.direction || "rx").toLowerCase();
        const type = normalizeType(msg);
        const isHdr = type === "tcp_header";
        const tr = document.createElement("tr");
        tr.className = `cap-${dir}`;
        tr.innerHTML =
          `<td class="mono">${esc(formatTs(msg.ts))}</td>` +
          `<td><span class="dir-badge dir-${dir}">${esc(dir.toUpperCase())}</span></td>` +
          `<td><span class="type-badge type-${esc(type)}">${esc(type.toUpperCase())}</span></td>` +
          (showHex
            ? `<td class="mono hex">${esc(isHdr ? "—" : msg.hex || "—")}</td>`
            : "") +
          (showAscii
            ? `<td class="mono ascii">${esc(isHdr ? "—" : asciiOf(msg))}</td>`
            : "") +
          `<td class="mono val">${esc(isHdr ? "—" : decimalOf(msg))}</td>` +
          `<td class="mono muted">${esc(msg.addr || msg.ip || "")}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      section.appendChild(table);
      container.appendChild(section);
    }
  }

  function renderHistory() {
    const rows = history.filter(passesHistoryFilters);
    els.emptyHistory.classList.toggle("show", rows.length === 0);
    renderHourGroups(
      els.historyHours,
      rows,
      historyViewMode(),
      openHours,
      els.historyMeta,
      ""
    );
  }

  async function loadHistory() {
    els.historyMeta.textContent = "Cargando histórico…";
    try {
      const q = selected
        ? `addr=${encodeURIComponent(selected.addr)}&limit=2000`
        : "limit=2000";
      const r = await fetch(`${API}/api/history?${q}`);
      const data = await r.json();
      history = data.messages || [];
      renderHistory();
    } catch (e) {
      els.historyMeta.textContent = String(e);
    }
  }

  function historyQueryBase() {
    return selected ? `addr=${encodeURIComponent(selected.addr)}` : "";
  }

  function renderArchiveDayList() {
    els.archiveDayList.innerHTML = "";
    els.emptyArchiveDays.classList.toggle("show", archiveDays.length === 0);
    for (const day of archiveDays) {
      const li = document.createElement("li");
      li.dataset.date = day.date;
      if (day.date === archiveSelectedDate) li.classList.add("active");
      li.innerHTML =
        `<span class="date">${esc(formatDayLabel(day.date))}</span>` +
        `<span class="meta">${day.count} tramas · RX ${day.rx} · TX ${day.tx}</span>`;
      li.addEventListener("click", () => selectArchiveDay(day.date));
      els.archiveDayList.appendChild(li);
    }
  }

  function setArchiveDateInput(dateKey) {
    archiveSelectedDate = dateKey || "";
    if (els.archiveDate) els.archiveDate.value = dateKey || "";
    [...els.archiveDayList.children].forEach((li) => {
      li.classList.toggle("active", li.dataset.date === archiveSelectedDate);
    });
  }

  function renderArchive() {
    const rows = archive.filter(passesArchiveFilters);
    els.emptyArchive.classList.toggle("show", !archiveSelectedDate || rows.length === 0);
    const dayLabel = archiveSelectedDate ? formatDayLabel(archiveSelectedDate) : "";
    renderHourGroups(
      els.archiveHours,
      rows,
      archiveViewMode(),
      openArchiveHours,
      els.archiveMeta,
      archiveSelectedDate ? `${dayLabel} · ` : ""
    );
    if (archiveSelectedDate && rows.length === 0) {
      els.archiveMeta.textContent = `${dayLabel} · sin tramas para los filtros actuales`;
    }
  }

  async function loadArchiveDays() {
    try {
      const base = historyQueryBase();
      const url = base ? `${API}/api/history/days?${base}` : `${API}/api/history/days`;
      const r = await fetch(url);
      const data = await r.json();
      archiveDays = data.days || [];
      renderArchiveDayList();
      if (!archiveSelectedDate && archiveDays.length > 0) {
        setArchiveDateInput(archiveDays[0].date);
      }
    } catch (e) {
      els.archiveMeta.textContent = String(e);
    }
  }

  async function loadArchiveDay(dateKey) {
    if (!dateKey) return;
    setArchiveDateInput(dateKey);
    openArchiveHours.clear();
    els.archiveMeta.textContent = `Cargando ${formatDayLabel(dateKey)}…`;
    try {
      const parts = [`date=${encodeURIComponent(dateKey)}`, "limit=10000"];
      const base = historyQueryBase();
      if (base) parts.unshift(base);
      const r = await fetch(`${API}/api/history?${parts.join("&")}`);
      const data = await r.json();
      archive = data.messages || [];
      const total = data.total ?? archive.length;
      renderArchive();
      if (total > archive.length) {
        els.archiveMeta.textContent +=
          ` · mostrando ${archive.length} de ${total} (usa filtros para acotar)`;
      }
    } catch (e) {
      els.archiveMeta.textContent = String(e);
    }
  }

  async function selectArchiveDay(dateKey) {
    await loadArchiveDay(dateKey);
  }

  async function loadArchiveTab() {
    await loadArchiveDays();
    if (archiveSelectedDate) {
      await loadArchiveDay(archiveSelectedDate);
    } else {
      renderArchive();
    }
  }

  function navigateArchiveDay(delta) {
    if (!archiveSelectedDate) {
      if (archiveDays.length > 0) selectArchiveDay(archiveDays[0].date);
      return;
    }
    const idx = archiveDays.findIndex((d) => d.date === archiveSelectedDate);
    if (idx >= 0) {
      const nextIdx = idx - delta;
      if (nextIdx >= 0 && nextIdx < archiveDays.length) {
        selectArchiveDay(archiveDays[nextIdx].date);
        return;
      }
    }
    selectArchiveDay(shiftDateKey(archiveSelectedDate, delta));
  }

  // ---- Devices ----
  async function loadDevices() {
    try {
      const r = await fetch(`${API}/api/devices`);
      const data = await r.json();
      renderDevices(data.devices || []);
    } catch (e) {
      console.warn(e);
    }
  }

  function renderDevices(devices) {
    els.deviceList.innerHTML = "";
    els.devCount.textContent = String(devices.length);
    els.emptyDevices.classList.toggle("show", devices.length === 0);

    const all = document.createElement("li");
    all.className = selected ? "" : "active";
    all.innerHTML = `<div class="ip">Todos</div><div class="meta">Ver todos (serial limitado a 100)</div>`;
    all.addEventListener("click", () => selectDevice(null));
    els.deviceList.appendChild(all);

    for (const d of devices) {
      const li = document.createElement("li");
      li.dataset.addr = d.addr;
      if (selected && selected.addr === d.addr) li.classList.add("active");
      const { ip, port } = parseAddr(d.addr);
      li.innerHTML =
        `<div class="ip">${esc(ip || d.ip || d.addr)}</div>` +
        `<div class="meta">puerto ${esc(port ?? "—")} · idle ${esc(d.idle_s ?? "—")}s` +
        (d.session_id ? ` · ses ${esc(String(d.session_id).slice(0, 8))}` : "") +
        `</div>`;
      li.addEventListener("click", () => selectDevice(d));
      els.deviceList.appendChild(li);
    }

    if (selected && !devices.some((d) => d.addr === selected.addr)) {
      // Mantener selección histórica aunque se desconecte (para export/histórico)
    }
  }

  async function selectDevice(d) {
    if (!d) {
      selected = null;
    } else {
      const { ip, port } = parseAddr(d.addr);
      selected = {
        addr: d.addr,
        ip: d.ip || ip,
        port,
        session_id: d.session_id || null,
      };
    }
    els.serialTitle.textContent = selected
      ? `Serial · ${selected.ip}:${selected.port}`
      : "Serial en vivo";
    els.historyTitle.textContent = selected
      ? `Histórico · ${selected.ip}:${selected.port}`
      : "Histórico por hora";
    els.archiveTitle.textContent = selected
      ? `Archivo · ${selected.ip}:${selected.port}`
      : "Archivo por día";
    els.sendHint.textContent = selected
      ? `Sesión ${selected.addr} — envío / export JSON`
      : "Selecciona un dispositivo (IP:puerto) para enviar o exportar.";

    [...els.deviceList.children].forEach((li, i) => {
      if (i === 0) li.classList.toggle("active", !selected);
      else li.classList.toggle("active", !!(selected && li.dataset.addr === selected.addr));
    });

    await refreshSerial();
    if (activeTab === "history") await loadHistory();
    if (activeTab === "archive") await loadArchiveTab();
  }

  // ---- WS ----
  function connectWs() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const host = API.replace(/^https?:\/\//, "");
    ws = new WebSocket(`${proto}://${host}/ws`);
    ws.onopen = () => setWsState(true);
    ws.onclose = () => {
      setWsState(false);
      setTimeout(connectWs, 2000);
    };
    ws.onerror = () => setWsState(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "message") pushLive(msg);
        if (
          msg.type === "connect" ||
          msg.type === "disconnect" ||
          msg.type === "disconnect_all" ||
          msg.type === "sweep"
        ) {
          loadDevices();
        }
      } catch (_) {}
    };
  }

  // ---- Send ----
  els.sendForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selected) {
      els.sendHint.textContent = "Selecciona un dispositivo primero.";
      return;
    }
    let message = els.message.value;
    if (!message) return;
    const encoding = els.encoding.value;
    if (encoding === "string" && els.addCrLf.checked) message += "\r\n";
    if (encoding === "hex" && els.addCrLf.checked) message += "0d0a";

    try {
      const r = await fetch(`${API}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addr: selected.addr, message, encoding }),
      });
      const data = await r.json();
      if (!r.ok) {
        els.sendHint.textContent = data.detail || data.error || "Error al enviar";
        return;
      }
      els.message.value = "";
      els.sendHint.textContent = `TX ${data.bytes} B · HEX ${data.hex} · ${selected.addr}`;
    } catch (err) {
      els.sendHint.textContent = String(err);
    }
  });

  els.btnClearSerial.addEventListener("click", () => {
    live = selected ? live.filter((m) => m.addr !== selected.addr) : [];
    renderSerial();
  });
  els.btnRefreshSerial.addEventListener("click", refreshSerial);
  els.btnExportSerial.addEventListener("click", exportSerialJson);
  els.btnRefreshHistory.addEventListener("click", loadHistory);
  els.filterDir.addEventListener("change", renderHistory);
  els.filterType.addEventListener("change", renderHistory);
  if (els.serialView) els.serialView.addEventListener("change", renderSerial);
  if (els.historyView) els.historyView.addEventListener("change", renderHistory);

  els.btnRefreshArchive.addEventListener("click", () =>
    loadArchiveDay(archiveSelectedDate || els.archiveDate.value)
  );
  els.btnArchivePrev.addEventListener("click", () => navigateArchiveDay(1));
  els.btnArchiveNext.addEventListener("click", () => navigateArchiveDay(-1));
  els.archiveDate.addEventListener("change", () => {
    const v = els.archiveDate.value;
    if (v) loadArchiveDay(v);
  });
  els.archiveDir.addEventListener("change", renderArchive);
  els.archiveType.addEventListener("change", renderArchive);
  if (els.archiveView) els.archiveView.addEventListener("change", renderArchive);

  els.btnSweep.addEventListener("click", async () => {
    try {
      const r = await fetch(`${API}/api/sweep`, { method: "POST" });
      const data = await r.json();
      els.sendHint.textContent = `Huérfanas limpiadas: ${data.bridge_removed}`;
      renderDevices(data.devices || []);
    } catch (e) {
      els.sendHint.textContent = String(e);
    }
  });

  els.encoding.addEventListener("change", () => {
    if (els.encoding.value === "hex") {
      els.message.placeholder = "Trama HEX… ej. AA55010A";
    } else if (els.encoding.value === "int") {
      els.message.placeholder = "Entero… ej. 42";
      els.addCrLf.checked = false;
    } else {
      els.message.placeholder = "Mensaje string…";
    }
  });

  connectWs();
  loadDevices();
  refreshSerial();
  setInterval(loadDevices, 10000);
})();
