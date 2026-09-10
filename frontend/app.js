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
    btnExportHistory: document.getElementById("btnExportHistory"),
    historyExportKind: document.getElementById("historyExportKind"),
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
    btnExportArchive: document.getElementById("btnExportArchive"),
    archiveExportKind: document.getElementById("archiveExportKind"),
    archiveDir: document.getElementById("archiveDir"),
    archiveType: document.getElementById("archiveType"),
    archiveView: document.getElementById("archiveView"),
    homoQueueText: document.getElementById("homoQueueText"),
    btnHomoScan: document.getElementById("btnHomoScan"),
    btnHomoEnqueueAll: document.getElementById("btnHomoEnqueueAll"),
    btnHomoClear: document.getElementById("btnHomoClear"),
    panelSent: document.getElementById("panelSent"),
    sentBody: document.getElementById("sentBody"),
    sentCount: document.getElementById("sentCount"),
    sentMeta: document.getElementById("sentMeta"),
    emptySent: document.getElementById("emptySent"),
    sentStatus: document.getElementById("sentStatus"),
    sentSource: document.getElementById("sentSource"),
    btnRefreshSent: document.getElementById("btnRefreshSent"),
    panelStatus: document.getElementById("panelStatus"),
    statusTitle: document.getElementById("statusTitle"),
    statusKpis: document.getElementById("statusKpis"),
    statusHours: document.getElementById("statusHours"),
    statusBadge: document.getElementById("statusBadge"),
    statusMeta: document.getElementById("statusMeta"),
    emptyStatus: document.getElementById("emptyStatus"),
    emptyStatusDays: document.getElementById("emptyStatusDays"),
    statusDayList: document.getElementById("statusDayList"),
    statusDate: document.getElementById("statusDate"),
    btnStatusPrev: document.getElementById("btnStatusPrev"),
    btnStatusNext: document.getElementById("btnStatusNext"),
    btnRefreshStatus: document.getElementById("btnRefreshStatus"),
    statusKind: document.getElementById("statusKind"),
    relayNamesForm: document.getElementById("relayNamesForm"),
    btnSaveRelayNames: document.getElementById("btnSaveRelayNames"),
    relayNamesHint: document.getElementById("relayNamesHint"),
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
  let statusSelectedDate = "";
  /** @type {Array<{date:string,count:number}>} */
  let statusDays = [];
  let activeTab = "serial";
  let ws;
  /** horas expandidas en histórico */
  const openHours = new Set();
  /** horas expandidas en archivo */
  const openArchiveHours = new Set();
  /** @type {Map<string, {count:number, ids:string[]}>} */
  const homoByHour = new Map();
  let homoConfigured = false;
  let homoScanCount = 0;

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
      if (els.panelSent) els.panelSent.classList.toggle("active", activeTab === "sent");
      if (els.panelStatus) els.panelStatus.classList.toggle("active", activeTab === "status");
      if (activeTab === "history") loadHistory();
      if (activeTab === "archive") loadArchiveTab();
      if (activeTab === "sent") loadSent();
      if (activeTab === "status") loadSeguimiento();
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

  const ANALYSIS_COLS = [
    "ts",
    "date",
    "hour",
    "direction",
    "value_type",
    "hex",
    "ascii",
    "decimal",
    "text",
    "frame_len",
    "addr",
    "ip",
    "session_id",
  ];

  function analysisRow(msg) {
    const parsed = parseAddr(msg.addr);
    return {
      ts: msg.ts || "",
      date: hourKey(msg.ts).slice(0, 10),
      hour: hourKey(msg.ts),
      direction: (msg.direction || "rx").toLowerCase(),
      value_type: normalizeType(msg),
      hex: msg.hex || "",
      ascii: asciiOf(msg) === "—" ? "" : asciiOf(msg),
      decimal: decimalOf(msg) === "—" ? "" : decimalOf(msg),
      text: msg.text || "",
      frame_len: msg.frame_len ?? "",
      addr: msg.addr || "",
      ip: msg.ip || parsed.ip || "",
      session_id: msg.session_id || "",
    };
  }

  function csvEscape(value) {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCsv(rows) {
    const lines = [ANALYSIS_COLS.join(",")];
    for (const row of rows) {
      lines.push(ANALYSIS_COLS.map((col) => csvEscape(row[col])).join(","));
    }
    return `\uFEFF${lines.join("\r\n")}`;
  }

  function downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function safeFilePart(value, fallback) {
    const s = String(value || fallback || "x").replace(/[^\w.-]+/g, "_");
    return s.slice(0, 48) || fallback || "x";
  }

  function exportAnalysis(rows, source, kind, extra = {}) {
    const statusEl = extra.statusEl || els.historyMeta;
    if (!rows.length) {
      if (statusEl) statusEl.textContent = "No hay tramas para descargar con los filtros actuales.";
      return;
    }
    const frames = [...rows]
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
      .map(analysisRow);
    const payload = {
      exported_at: new Date().toISOString(),
      source,
      device: selected ? selected.addr : "todos",
      date: extra.date || null,
      hour: extra.hour || null,
      filters: extra.filters || {},
      count: frames.length,
      frames,
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const scope = selected ? safeFilePart(selected.addr, "ip") : "todos";
    const range = extra.hour
      ? safeFilePart(extra.hour.replace(" ", "_"), "hora")
      : extra.date
        ? safeFilePart(extra.date, "dia")
        : "reciente";
    const base = `${source}_${scope}_${range}_${stamp}`;
    if (kind === "csv") {
      downloadText(toCsv(frames), `${base}.csv`, "text/csv;charset=utf-8");
    } else {
      downloadText(JSON.stringify(payload, null, 2), `${base}.json`, "application/json");
    }
    if (statusEl) {
      statusEl.textContent = `Descargado ${frames.length} trama(s) · ${kind.toUpperCase()} · ${range}`;
    }
  }

  function currentHistoryFilters() {
    return {
      direction: els.filterDir.value,
      type: els.filterType.value,
    };
  }

  function currentArchiveFilters() {
    return {
      direction: els.archiveDir.value,
      type: els.archiveType.value,
    };
  }

  function exportHistory(kind, hourRows, hourKeyValue) {
    const rows = hourRows || history.filter(passesHistoryFilters);
    exportAnalysis(rows, hourKeyValue ? "historico_hora" : "historico", kind, {
      statusEl: els.historyMeta,
      hour: hourKeyValue || null,
      filters: currentHistoryFilters(),
    });
  }

  function exportArchive(kind, hourRows, hourKeyValue) {
    if (!archiveSelectedDate && !hourRows) {
      els.archiveMeta.textContent = "Elige un día para descargar el archivo.";
      return;
    }
    const rows = hourRows || archive.filter(passesArchiveFilters);
    exportAnalysis(rows, hourKeyValue ? "archivo_hora" : "archivo_dia", kind, {
      statusEl: els.archiveMeta,
      date: archiveSelectedDate || null,
      hour: hourKeyValue || null,
      filters: currentArchiveFilters(),
    });
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

  function renderHourGroups(container, rows, viewMode, openSet, metaEl, titlePrefix, exportFn) {
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
      const label = document.createElement("span");
      label.className = "hour-label";
      label.textContent = hour;
      const meta = document.createElement("span");
      meta.className = "hour-meta";
      meta.textContent = `${msgs.length} tramas · RX ${rx} · TX ${tx}`;
      summary.appendChild(label);
      summary.appendChild(meta);
      const actions = document.createElement("span");
      actions.className = "hour-export";
      if (exportFn) {
        for (const kind of ["json", "csv"]) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn ghost";
          btn.textContent = kind.toUpperCase();
          btn.title = `Descargar esta hora en ${kind.toUpperCase()}`;
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            exportFn(kind, msgs, hour);
          });
          actions.appendChild(btn);
        }
      }
      const homoInfo = homoByHour.get(hour);
      if (homoInfo && homoInfo.count > 0) {
        const homoBtn = document.createElement("button");
        homoBtn.type = "button";
        homoBtn.className = "btn ghost homo";
        homoBtn.textContent = `Enviar ${homoInfo.count}`;
        homoBtn.title = homoConfigured
          ? `Encolar ${homoInfo.count} trama(s) homologable(s) de esta hora (5 s entre POST)`
          : "Configura HOMOLOGATE_URL para enviar";
        homoBtn.disabled = !homoConfigured;
        homoBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          enqueueHomologate({ hour });
        });
        actions.appendChild(homoBtn);
      }
      if (actions.childNodes.length) summary.appendChild(actions);
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

  function historyQueryParams() {
    const p = new URLSearchParams();
    if (selected && selected.addr) p.set("addr", selected.addr);
    return p;
  }

  function renderHomoQueue(q) {
    if (!els.homoQueueText) return;
    if (!q) {
      els.homoQueueText.textContent = "Cola homologación: —";
      return;
    }
    const parts = [];
    if (!q.configured) parts.push("sin URL de destino");
    else parts.push(q.host || "destino ok");
    if (q.sending) parts.push(`enviando ${q.sending.i || ""} ${q.sending.hour || ""}`.trim());
    parts.push(`${q.pending || 0} en cola`);
    parts.push(`${q.sent || 0} enviadas`);
    if (q.errors) parts.push(`${q.errors} error(es)`);
    parts.push(`${q.interval_s || 5}s entre POST`);
    els.homoQueueText.textContent = `Cola: ${parts.join(" · ")}`;
    if (els.btnHomoEnqueueAll) {
      els.btnHomoEnqueueAll.disabled = !homoConfigured || homoScanCount <= 0;
      els.btnHomoEnqueueAll.textContent =
        homoScanCount > 0 ? `Encolar ${homoScanCount} visibles` : "Encolar visibles";
    }
  }

  async function refreshHomoQueue() {
    try {
      const r = await fetch(`${API}/api/homologate/queue`);
      const data = await r.json();
      homoConfigured = !!(data.configured && data.enabled);
      renderHomoQueue(data);
    } catch (_) {}
  }

  async function scanHomologate(opts) {
    const p = historyQueryParams();
    if (opts && opts.date) p.set("date", opts.date);
    if (opts && opts.hour) p.set("hour", opts.hour);
    if (els.homoQueueText) els.homoQueueText.textContent = "Explorando histórico…";
    try {
      const r = await fetch(`${API}/api/homologate/candidates?${p.toString()}`);
      const data = await r.json();
      homoConfigured = !!(data.configured && data.enabled);
      homoByHour.clear();
      for (const h of data.hours || []) {
        const ids = (data.items || [])
          .filter((it) => it.hour === h.hour)
          .map((it) => it.message_id)
          .filter(Boolean);
        homoByHour.set(h.hour, { count: h.count, ids });
      }
      homoScanCount = data.count || 0;
      renderHomoQueue(data.queue);
      if (activeTab === "history") renderHistory();
      if (activeTab === "archive") renderArchive();
      const dest = data.configured ? data.host : "sin URL";
      const msg = `${homoScanCount} trama(s) homologable(s) · ${ (data.hours || []).length } hora(s) · ${dest}`;
      if (els.historyMeta && activeTab === "history") els.historyMeta.textContent = msg;
      if (els.archiveMeta && activeTab === "archive") els.archiveMeta.textContent = msg;
    } catch (e) {
      if (els.homoQueueText) els.homoQueueText.textContent = String(e);
    }
  }

  async function enqueueHomologate(opts) {
    if (!homoConfigured) {
      alert("Configura HOMOLOGATE_URL en el backend para enviar.");
      return;
    }
    const hour = opts && opts.hour;
    const date = opts && opts.date;
    const n = hour
      ? (homoByHour.get(hour) || {}).count || 0
      : homoScanCount;
    const label = hour ? `la hora ${hour}` : date ? `el día ${date}` : "las horas visibles";
    if (!n) {
      alert("No hay tramas homologables para encolar. Pulsa «Explorar homologables».");
      return;
    }
    if (!confirm(`¿Encolar ${n} trama(s) de ${label}?\nSe envían por POST con 5 s entre cada una.\nSi ya hay un envío, se agregan al final de la cola.`)) {
      return;
    }
    const body = {};
    if (hour) body.hour = hour;
    else if (date) body.date = date;
    else {
      const ids = [];
      homoByHour.forEach((info) => {
        for (const id of info.ids || []) ids.push(id);
      });
      if (ids.length) body.ids = ids;
    }
    if (selected && selected.addr) body.addr = selected.addr;
    try {
      const r = await fetch(`${API}/api/homologate/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.detail || "No se pudo encolar");
        return;
      }
      renderHomoQueue(data.queue);
      const hint = `Encoladas ${data.added || 0} (omitidas ${data.skipped || 0}) · pendientes ${data.queue && data.queue.pending}`;
      if (els.historyMeta) els.historyMeta.textContent = hint;
      if (els.archiveMeta && activeTab === "archive") els.archiveMeta.textContent = hint;
    } catch (e) {
      alert(String(e));
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
      "",
      exportHistory
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
      scanHomologate();
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
      archiveSelectedDate ? `${dayLabel} · ` : "",
      exportArchive
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
      if (dateKey) scanHomologate({ date: dateKey });
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
    if (els.statusTitle) {
      els.statusTitle.textContent = selected
        ? `Seguimiento · ${selected.ip}:${selected.port}`
        : "Seguimiento";
    }

    [...els.deviceList.children].forEach((li, i) => {
      if (i === 0) li.classList.toggle("active", !selected);
      else li.classList.toggle("active", !!(selected && li.dataset.addr === selected.addr));
    });

    await refreshSerial();
    if (activeTab === "history") await loadHistory();
    if (activeTab === "archive") await loadArchiveTab();
    if (activeTab === "sent") await loadSent();
    if (activeTab === "status") await loadSeguimiento();
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
        if (msg.type === "seguimiento" && activeTab === "status") {
          if (!statusSelectedDate || msg.date === statusSelectedDate) loadSeguimiento();
        }
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
  els.btnExportHistory.addEventListener("click", () =>
    exportHistory((els.historyExportKind && els.historyExportKind.value) || "json")
  );
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
  els.btnExportArchive.addEventListener("click", () =>
    exportArchive((els.archiveExportKind && els.archiveExportKind.value) || "json")
  );

  els.btnHomoScan.addEventListener("click", () => {
    if (activeTab === "archive" && archiveSelectedDate) scanHomologate({ date: archiveSelectedDate });
    else scanHomologate();
  });
  els.btnHomoEnqueueAll.addEventListener("click", () => {
    if (activeTab === "archive" && archiveSelectedDate) enqueueHomologate({ date: archiveSelectedDate });
    else enqueueHomologate({});
  });
  function sourceLabel(src) {
    if (src === "live") return "En vivo";
    if (src === "queue") return "Histórico";
    return src || "—";
  }

  function statusLabel(st) {
    if (st === "ok") return "Enviada";
    if (st === "error") return "Error";
    if (st === "queued") return "En cola";
    if (st === "sending") return "Enviando";
    return st || "—";
  }

  function renderSent(items, meta) {
    if (!els.sentBody) return;
    els.sentBody.innerHTML = "";
    const statusF = (els.sentStatus && els.sentStatus.value) || "all";
    const rows = (items || []).filter((it) => statusF === "all" || it.status === statusF);
    els.emptySent.classList.toggle("show", rows.length === 0);
    if (els.sentCount) els.sentCount.textContent = String(rows.length);
    if (els.sentMeta) {
      els.sentMeta.textContent =
        `${rows.length} registro(s)` +
        (meta && meta.ok != null ? ` · OK ${meta.ok} · error ${meta.errors} · cola ${meta.pending}` : "") +
        (meta && meta.host ? ` · ${meta.host}` : "");
    }
    for (const it of rows) {
      const tr = document.createElement("tr");
      const payload = it.payload || {};
      const preview = payload.d02
        ? String(payload.d02).slice(0, 48) + (payload.d02.length > 48 ? "…" : "")
        : "";
      const json = payload.i
        ? JSON.stringify(payload, null, 2)
        : it.error || "—";
      tr.innerHTML =
        `<td class="mono">${esc(formatTs(it.ts))}</td>` +
        `<td><span class="type-badge src-${esc(it.source || "queue")}">${esc(sourceLabel(it.source))}</span></td>` +
        `<td><span class="type-badge st-${esc(it.status || "")}">${esc(statusLabel(it.status))}</span></td>` +
        `<td class="mono">${esc(it.i || "—")}</td>` +
        `<td class="mono muted">${esc(it.hour || "—")}</td>` +
        `<td class="mono">${esc(it.http_status != null ? it.http_status : it.error || "—")}</td>` +
        `<td class="payload-cell"><details><summary>${esc(preview || "ver JSON")}</summary><pre>${esc(json)}</pre></details></td>`;
      els.sentBody.appendChild(tr);
    }
  }

  async function loadSent() {
    if (els.sentMeta) els.sentMeta.textContent = "Cargando envíos…";
    const p = new URLSearchParams();
    if (els.sentSource && els.sentSource.value !== "all") p.set("source", els.sentSource.value);
    p.set("limit", "500");
    try {
      const r = await fetch(`${API}/api/homologate/sent?${p}`);
      const data = await r.json();
      renderSent(data.items || [], data);
    } catch (e) {
      if (els.sentMeta) els.sentMeta.textContent = String(e);
    }
  }

  els.btnHomoClear.addEventListener("click", async () => {
    try {
      const r = await fetch(`${API}/api/homologate/queue/clear`, { method: "POST" });
      const data = await r.json();
      renderHomoQueue(data.queue);
    } catch (e) {
      if (els.homoQueueText) els.homoQueueText.textContent = String(e);
    }
  });
  if (els.btnRefreshSent) els.btnRefreshSent.addEventListener("click", loadSent);
  if (els.sentStatus) els.sentStatus.addEventListener("change", loadSent);
  if (els.sentSource) els.sentSource.addEventListener("change", loadSent);

  const MODE_ES = {
    chilled: "Refrigerado",
    frozen: "Congelado",
    stop: "Parado",
    defrost_begin: "Inicio deshielo",
    defrost_ended: "Fin deshielo",
    function_test_begin: "Inicio test función",
    function_test: "Test función",
    brief_pti_begin: "Inicio PTI breve",
    chill_pti_begin: "Inicio PTI frío",
    afam_pti_begin: "Inicio PTI AFAM+",
    rh_pti_begin: "Inicio PTI rH",
    pti_begin: "Inicio PTI",
    pti: "PTI",
    manual_function_test_begin: "Inicio test manual",
    manual_function_test: "Test manual",
    runtime_probe_test: "Test sonda runtime",
    auto_unit_test: "Auto test unidad",
    unit_autoconfiguration: "Autoconfiguración",
    external_test_begin: "Inicio test externo",
    external_test: "Test externo",
    shutdown_begin: "Inicio apagado",
    shutdown: "Apagado",
    shutdown_end: "Fin apagado",
    pti_chill_pulldown: "PTI pulldown frío",
    pti_chill_maintaining: "PTI mantenimiento frío",
    pti_defrosting: "PTI deshielo",
    pti_frozen_pulldown: "PTI pulldown congelado",
    pti_ended_failed: "PTI fallido",
    pti_ended_passed: "PTI aprobado",
  };

  function fmtStatusVal(v, suffix) {
    if (v == null || v === "") return "—";
    if (typeof v === "boolean") return v ? "Sí" : "No";
    return suffix ? `${v}${suffix}` : String(v);
  }

  function kpiHtml(label, value) {
    return `<div class="status-kpi"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function renderStatusDays() {
    if (!els.statusDayList) return;
    els.statusDayList.innerHTML = "";
    if (els.emptyStatusDays) els.emptyStatusDays.classList.toggle("show", statusDays.length === 0);
    for (const day of statusDays) {
      const li = document.createElement("li");
      li.dataset.date = day.date;
      if (day.date === statusSelectedDate) li.classList.add("active");
      li.innerHTML =
        `<span class="date">${esc(formatDayLabel(day.date))}</span>` +
        `<span class="meta">${esc(String(day.count))} registro(s)</span>`;
      li.addEventListener("click", () => selectStatusDay(day.date));
      els.statusDayList.appendChild(li);
    }
  }

  function kindLabel(kind) {
    if (kind === "info") return "INFO";
    if (kind === "relay") return "RELAY";
    return "MP-5000";
  }

  function renderSeguimientoKpis(latestByKind) {
    if (!els.statusKpis) return;
    const by = latestByKind || {};
    const info = by.info;
    const relay = by.relay;
    const unit = by.mp5000;
    if (!info && !relay && !unit) {
      els.statusKpis.innerHTML = "";
      return;
    }
    let html = "";
    if (info) {
      const s = info.snapshot || {};
      html +=
        kpiHtml("Pantalla", "INFO") +
        kpiHtml("Supply (pantalla)", fmtStatusVal(s.supply_air_c, " °C")) +
        kpiHtml("Return (pantalla)", fmtStatusVal(s.return_air_c, " °C")) +
        kpiHtml("SP temp", fmtStatusVal(s.setpoint_c, " °C")) +
        kpiHtml("Humedad", fmtStatusVal(s.humidity_pct, " %")) +
        kpiHtml("SP humedad", fmtStatusVal(s.humidity_setpoint_pct, " %")) +
        kpiHtml("CO2", fmtStatusVal(s.co2_pct, " %")) +
        kpiHtml("SP CO2", fmtStatusVal(s.co2_setpoint_pct, " %"));
    }
    if (relay) {
      const s = relay.snapshot || {};
      const on = (s.relays_on || []).join(", ") || "ninguno";
      html +=
        kpiHtml("Control", relay.source || "RELAY") +
        kpiHtml("Relés ON", on) +
        kpiHtml("Humedad (relay)", fmtStatusVal(s.humidity_pct ?? relay.humidity_pct, " %")) +
        kpiHtml("SP humedad (relay)", fmtStatusVal(s.humidity_setpoint_pct ?? relay.humidity_setpoint_pct, " %")) +
        kpiHtml("Pot1", fmtStatusVal(s.pot1_v, " V"));
    }
    if (unit) {
      const s = unit.snapshot || {};
      const mode = s.unit_mode
        ? `${MODE_ES[s.unit_mode] || s.unit_mode} (${s.unit_mode_id ?? "—"})`
        : "—";
      html +=
        kpiHtml("Equipo", s.container_id || unit.container_id || "MP-5000") +
        kpiHtml("Modo", mode) +
        kpiHtml("SP equipo", fmtStatusVal(s.setpoint_c, " °C")) +
        kpiHtml("Supply equipo", fmtStatusVal(s.supply_air_c, " °C")) +
        kpiHtml("CRC", unit.crc_all_ok ? "OK" : "ERROR");
    }
    els.statusKpis.innerHTML = html;
  }

  function rowSummary(it) {
    const kind = it.kind || "mp5000";
    const s = it.snapshot || {};
    if (kind === "info") {
      return {
        tipo: kind,
        detalle: `pantalla SP ${fmtStatusVal(s.setpoint_c, "°C")}`,
        extra: `RH ${fmtStatusVal(s.humidity_pct, "%")} / SP ${fmtStatusVal(s.humidity_setpoint_pct, "%")}`,
        supply: fmtStatusVal(s.supply_air_c, "°C"),
      };
    }
    if (kind === "relay") {
      const on = (s.relays_on || []).join(", ") || "ninguno ON";
      return {
        tipo: kind,
        detalle: it.source || "RELAY",
        extra: on,
        supply: fmtStatusVal(s.humidity_pct ?? it.humidity_pct, "% RH"),
      };
    }
    return {
      tipo: kind,
      detalle: MODE_ES[s.unit_mode] || s.unit_mode || it.container_id || "MP-5000",
      extra: (s.alarms || []).map((a) => `#${a.number}`).join(", ") || "sin alarma",
      supply: fmtStatusVal(s.supply_air_c, "°C"),
    };
  }

  function renderSeguimiento(data) {
    const items = (data && data.items) || [];
    const latest = data && data.latest;
    if (els.statusBadge) els.statusBadge.textContent = String(data.count || items.length);
    renderSeguimientoKpis(data.latest_by_kind || {});
    if (els.emptyStatus) els.emptyStatus.classList.toggle("show", items.length === 0);
    if (!els.statusHours) return;
    els.statusHours.innerHTML = "";
    const byHour = new Map();
    for (const it of items) {
      const hk = it.hour || "desconocida";
      if (!byHour.has(hk)) byHour.set(hk, []);
      byHour.get(hk).push(it);
    }
    const hours = [...byHour.keys()].sort().reverse();
    for (const hk of hours) {
      const rows = byHour.get(hk);
      const details = document.createElement("details");
      details.className = "hour-block";
      details.open = true;
      const summary = document.createElement("summary");
      summary.innerHTML = `<span class="hour-label">${esc(hk)}</span><span class="badge">${rows.length}</span>`;
      details.appendChild(summary);
      const table = document.createElement("table");
      table.className = "capture-table";
      table.innerHTML =
        "<thead><tr><th>Hora</th><th>Tipo</th><th>i</th><th>Detalle</th><th>Valor</th><th>Extra</th><th>JSON</th></tr></thead>";
      const tbody = document.createElement("tbody");
      for (const it of rows) {
        const sum = rowSummary(it);
        const tr = document.createElement("tr");
        const json = JSON.stringify(it, null, 2);
        tr.innerHTML =
          `<td class="mono">${esc(formatTs(it.ts))}</td>` +
          `<td><span class="kind-badge kind-${esc(sum.tipo)}">${esc(kindLabel(sum.tipo))}</span></td>` +
          `<td class="mono">${esc(it.i || "—")}</td>` +
          `<td>${esc(sum.detalle)}</td>` +
          `<td class="mono">${esc(sum.supply)}</td>` +
          `<td>${esc(sum.extra)}</td>` +
          `<td class="payload-cell"><details><summary>ver</summary><pre>${esc(json)}</pre></details></td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      details.appendChild(table);
      els.statusHours.appendChild(details);
    }
    if (els.statusMeta) {
      const day = statusSelectedDate || data.date || "—";
      els.statusMeta.textContent = latest
        ? `${day} · ${items.length} registro(s) · último ${kindLabel(latest.kind)} ${formatTs(latest.ts)}`
        : `${day} · sin registros`;
    }
  }

  async function loadSeguimientoDays() {
    const p = new URLSearchParams();
    if (selected && selected.ip) p.set("ip", selected.ip);
    try {
      const r = await fetch(`${API}/api/seguimiento/days?${p}`);
      const data = await r.json();
      statusDays = data.days || [];
      renderStatusDays();
      if (!statusSelectedDate) {
        statusSelectedDate = (statusDays[0] && statusDays[0].date) || todayKey();
      }
      if (els.statusDate) els.statusDate.value = statusSelectedDate;
    } catch (e) {
      if (els.statusMeta) els.statusMeta.textContent = String(e);
    }
  }

  async function loadSeguimiento() {
    try {
      await loadSeguimientoDays();
      if (!statusSelectedDate) statusSelectedDate = todayKey();
      if (els.statusDate) els.statusDate.value = statusSelectedDate;
      const p = new URLSearchParams();
      p.set("date", statusSelectedDate);
      p.set("limit", "500");
      if (selected && selected.ip) p.set("ip", selected.ip);
      if (els.statusKind && els.statusKind.value !== "all") p.set("kind", els.statusKind.value);
      const r = await fetch(`${API}/api/seguimiento?${p}`);
      const data = await r.json();
      renderSeguimiento(data);
    } catch (e) {
      if (els.statusMeta) els.statusMeta.textContent = String(e);
    }
  }

  function selectStatusDay(dateKey) {
    statusSelectedDate = dateKey;
    if (els.statusDate) els.statusDate.value = dateKey;
    if (els.statusDayList) {
      [...els.statusDayList.children].forEach((li) => {
        li.classList.toggle("active", li.dataset.date === dateKey);
      });
    }
    loadSeguimiento();
  }

  function currentIdent() {
    return "POLLO_BEBE";
  }

  function renderRelayNameInputs(names) {
    if (!els.relayNamesForm) return;
    els.relayNamesForm.innerHTML = "";
    for (let i = 1; i <= 10; i += 1) {
      const row = document.createElement("label");
      row.className = "relay-name-row";
      const key = String(i);
      row.innerHTML =
        `<span>R${i}</span><input type="text" data-relay="${key}" value="${esc(names[key] || "libre")}" />`;
      els.relayNamesForm.appendChild(row);
    }
  }

  async function loadRelayNames() {
    try {
      const r = await fetch(`${API}/api/relay-labels?ident=${encodeURIComponent(currentIdent())}`);
      const data = await r.json();
      renderRelayNameInputs(data.names || {});
      if (els.relayNamesHint) {
        els.relayNamesHint.textContent = data.custom ? `Nombres de ${data.ident}` : "Usando nombres predefinidos";
      }
    } catch (e) {
      if (els.relayNamesHint) els.relayNamesHint.textContent = String(e);
    }
  }

  async function saveRelayNames() {
    if (!els.relayNamesForm) return;
    const names = {};
    els.relayNamesForm.querySelectorAll("input[data-relay]").forEach((inp) => {
      names[inp.dataset.relay] = inp.value.trim() || "libre";
    });
    try {
      const r = await fetch(`${API}/api/relay-labels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ident: currentIdent(), names }),
      });
      const data = await r.json();
      renderRelayNameInputs(data.names || names);
      if (els.relayNamesHint) els.relayNamesHint.textContent = "Nombres guardados. Las próximas tramas RELAY los usan.";
    } catch (e) {
      if (els.relayNamesHint) els.relayNamesHint.textContent = String(e);
    }
  }

  if (els.btnRefreshStatus) els.btnRefreshStatus.addEventListener("click", loadSeguimiento);
  if (els.statusKind) els.statusKind.addEventListener("change", loadSeguimiento);
  if (els.btnSaveRelayNames) els.btnSaveRelayNames.addEventListener("click", saveRelayNames);
  loadRelayNames();
  if (els.statusDate) {
    els.statusDate.addEventListener("change", () => {
      if (els.statusDate.value) selectStatusDay(els.statusDate.value);
    });
  }
  if (els.btnStatusPrev) {
    els.btnStatusPrev.addEventListener("click", () => {
      if (!statusSelectedDate) statusSelectedDate = todayKey();
      selectStatusDay(shiftDateKey(statusSelectedDate, -1));
    });
  }
  if (els.btnStatusNext) {
    els.btnStatusNext.addEventListener("click", () => {
      if (!statusSelectedDate) statusSelectedDate = todayKey();
      selectStatusDay(shiftDateKey(statusSelectedDate, 1));
    });
  }

  setInterval(refreshHomoQueue, 2000);
  setInterval(() => {
    if (activeTab === "sent") loadSent();
  }, 4000);

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
  refreshHomoQueue();
  setInterval(loadDevices, 10000);
})();
