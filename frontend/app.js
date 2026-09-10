(() => {
  const meta = document.querySelector('meta[name="api-base"]');
  const API = (meta && meta.content) || location.origin;
  const LIVE_MAX = 100;
  const SESSION_KEY = "ztrack_session";
  const ZTRACK_URL = `${location.protocol}//${location.hostname}:8445`;

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSession(session, remember) {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    const raw = JSON.stringify(session);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, raw);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function applyShell(session) {
    const login = document.getElementById("appLogin");
    const serial = document.getElementById("shellSerial");
    const client = document.getElementById("shellClient");
    document.body.classList.remove("is-login", "is-client");
    if (!session) {
      if (login) login.hidden = false;
      if (serial) serial.hidden = true;
      if (client) client.hidden = true;
      document.body.classList.add("is-login");
      return "login";
    }
    if (login) login.hidden = true;
    if (session.role === "superadmin") {
      if (serial) serial.hidden = false;
      if (client) client.hidden = true;
      return "serial";
    }
    window.location.replace(ZTRACK_URL);
    return "redirect";
  }

  function kpi(label, value) {
    return `<div class="status-kpi"><span class="k">${label}</span><span class="v">${value}</span></div>`;
  }

  function fmt(n, suffix) {
    if (n == null || n === "") return "—";
    const num = Number(n);
    const t = Number.isInteger(num) ? String(num) : num.toFixed(1);
    return suffix ? `${t}${suffix}` : t;
  }

  async function startClientApp(session) {
    const roleEl = document.getElementById("clientRole");
    const identEl = document.getElementById("clientIdent");
    const freshEl = document.getElementById("clientFresh");
    const dot = document.getElementById("clientDot");
    const banner = document.getElementById("clientBanner");
    const tabCfg = document.getElementById("tabCfg");
    const air = document.getElementById("clientAir");
    const zones = document.getElementById("clientZones");
    const atmo = document.getElementById("clientAtmo");
    const relays = document.getElementById("clientRelays");
    const isAdmin = session.role === "admin";
    if (roleEl) roleEl.textContent = isAdmin ? "admin" : "monitoreo";
    if (identEl) identEl.textContent = session.ident || "POLLO_BEBE";
    if (tabCfg) tabCfg.hidden = !isAdmin;
    document.getElementById("cpanelCfg").hidden = true;
    document.getElementById("cpanelLive").hidden = false;

    document.querySelectorAll("#clientTabs .tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.ctab === "cfg" && !isAdmin) return;
        document.querySelectorAll("#clientTabs .tab").forEach((b) => b.classList.toggle("active", b === btn));
        document.getElementById("cpanelLive").hidden = btn.dataset.ctab !== "live";
        document.getElementById("cpanelCfg").hidden = btn.dataset.ctab !== "cfg";
      });
    });

    const cfg = {
      temp: document.getElementById("cfgTemp"),
      hum: document.getElementById("cfgHum"),
      co2: document.getElementById("cfgCo2"),
      hint: document.getElementById("cfgHint"),
    };
    let applied = { temp: null, hum: null, co2: null };
    let seeded = false;

    function paint(live) {
      if (identEl) identEl.textContent = live.ident || session.ident;
      if (dot) {
        dot.classList.toggle("on", !!live.online && !live.stale);
        dot.classList.toggle("off", !live.online || !!live.stale);
      }
      if (freshEl) {
        const age = live.age_s;
        freshEl.textContent = live.stale
          ? `Sin datos ${age != null ? Math.floor(age / 60) + " min" : ""}`
          : age != null
            ? `Hace ${age < 60 ? age + " s" : Math.floor(age / 60) + " min"}`
            : "—";
      }
      if (banner) {
        banner.classList.toggle("on", !!live.online && !live.stale);
        banner.classList.toggle("off", !!live.stale || !live.online);
        banner.textContent = live.stale
          ? "Última lectura antigua. Las tarjetas muestran el último valor conocido."
          : live.online
            ? "Datos de INFO / USDA / CO₂ % / 4 motores. Ventilación = motores."
            : "Sin sesión TCP. Se muestra el último seguimiento.";
      }
      if (air) {
        air.innerHTML =
          kpi("Suministro", fmt(live.supply_air_c, " °C")) +
          kpi("Retorno", fmt(live.return_air_c, " °C")) +
          kpi("Consigna", fmt(live.setpoint_c, " °C"));
      }
      if (zones) {
        zones.innerHTML = (live.zones || [])
          .map((z) => kpi(`Zona ${z.id}`, fmt(z.temp, " °C")))
          .join("");
      }
      if (atmo) {
        const motors = (live.motors || [])
          .map((m) => kpi(m.label || `Motor ${m.id}`, m.speed_pct == null ? "—" : `${fmt(m.volts, " V")} · ${fmt(m.speed_pct, " %")}`))
          .join("");
        atmo.innerHTML =
          kpi("CO₂", fmt(live.co2_pct, " %")) +
          kpi("Humedad", fmt(live.humidity_pct, " %")) +
          kpi("Ventilación", fmt(live.ventilation_pct, " %")) +
          motors;
      }
      if (relays) {
        relays.innerHTML = (live.relays || [])
          .map((r) => kpi(r.name || `R${r.id}`, r.on ? "ON" : "OFF"))
          .join("") || "<p class='hint'>Sin relés</p>";
      }
      if (!seeded && cfg.temp) {
        cfg.temp.value = live.setpoint_c ?? "";
        cfg.hum.value = live.humidity_setpoint_pct ?? "";
        cfg.co2.value = live.co2_setpoint_pct ?? "";
        applied = {
          temp: live.setpoint_c,
          hum: live.humidity_setpoint_pct,
          co2: live.co2_setpoint_pct,
        };
        seeded = true;
      }
    }

    async function refresh() {
      try {
        const live = await fetch(`${API}/api/client/live?ident=${encodeURIComponent(session.ident || "POLLO_BEBE")}`).then((r) => r.json());
        paint(live);
      } catch (e) {
        if (banner) banner.textContent = String(e);
      }
    }

    document.getElementById("cfgDiscard")?.addEventListener("click", () => {
      if (cfg.temp) cfg.temp.value = applied.temp ?? "";
      if (cfg.hum) cfg.hum.value = applied.hum ?? "";
      if (cfg.co2) cfg.co2.value = applied.co2 ?? "";
      if (cfg.hint) cfg.hint.textContent = "";
    });
    document.getElementById("cfgApply")?.addEventListener("click", async () => {
      if (!isAdmin) return;
      if (cfg.hint) cfg.hint.textContent = "Encolando…";
      try {
        const r = await fetch(`${API}/api/client/setpoints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ident: session.ident || "POLLO_BEBE",
            temperature_c: cfg.temp.value === "" ? undefined : Number(cfg.temp.value),
            humidity_pct: cfg.hum.value === "" ? undefined : Number(cfg.hum.value),
            co2_pct: cfg.co2.value === "" ? undefined : Number(cfg.co2.value),
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Error");
        applied = { temp: Number(cfg.temp.value), hum: Number(cfg.hum.value), co2: Number(cfg.co2.value) };
        cfg.hint.textContent = data.online
          ? "En cola. Sale en la próxima ventana libre."
          : "Guardado como referencia: no hay sesión. Se cancela a las 2 h.";
      } catch (e) {
        if (cfg.hint) cfg.hint.textContent = String(e);
      }
    });

    document.getElementById("btnLogoutClient")?.addEventListener("click", () => {
      clearSession();
      location.reload();
    });

    await refresh();
    setInterval(refresh, 8000);
  }

  function bindLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("loginError");
      const btn = document.getElementById("loginBtn");
      const user = document.getElementById("loginUser").value;
      const pass = document.getElementById("loginPass").value;
      const remember = document.getElementById("loginRemember").checked;
      if (err) err.hidden = true;
      if (btn) btn.disabled = true;
      try {
        const r = await fetch(`${API}/api/client/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user, password: pass }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error("bad");
        writeSession(data, remember);
        location.reload();
      } catch {
        if (err) err.hidden = false;
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  bindLogin();
  document.getElementById("btnLogoutSerial")?.addEventListener("click", () => {
    clearSession();
    location.reload();
  });

  const session = readSession();
  const mode = applyShell(session);
  if (mode === "login" || mode === "redirect") return;
  if (mode === "client") {
    startClientApp(session);
    return;
  }

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
    panelCmd: document.getElementById("panelCmd"),
    cmdTitle: document.getElementById("cmdTitle"),
    cmdOnline: document.getElementById("cmdOnline"),
    cmdWindow: document.getElementById("cmdWindow"),
    cmdBanner: document.getElementById("cmdBanner"),
    cmdScreen: document.getElementById("cmdScreen"),
    cmdFields: document.getElementById("cmdFields"),
    cmdActions: document.getElementById("cmdActions"),
    cmdRelays: document.getElementById("cmdRelays"),
    cmdRelayBits: document.getElementById("cmdRelayBits"),
    btnEnqueueRelay: document.getElementById("btnEnqueueRelay"),
    cmdPotV: document.getElementById("cmdPotV"),
    cmdPotHint: document.getElementById("cmdPotHint"),
    btnEnqueuePot: document.getElementById("btnEnqueuePot"),
    cmdQueue: document.getElementById("cmdQueue"),
    cmdSentBody: document.getElementById("cmdSentBody"),
    cmdMeta: document.getElementById("cmdMeta"),
    btnRefreshCmd: document.getElementById("btnRefreshCmd"),
    btnClearCmd: document.getElementById("btnClearCmd"),
    panelReglas: document.getElementById("panelReglas"),
    reglasTitle: document.getElementById("reglasTitle"),
    reglasOnline: document.getElementById("reglasOnline"),
    reglasBanner: document.getElementById("reglasBanner"),
    reglasLive: document.getElementById("reglasLive"),
    reglasMeta: document.getElementById("reglasMeta"),
    btnRefreshReglas: document.getElementById("btnRefreshReglas"),
    rgEntrada: document.getElementById("rgEntrada"),
    rgOperador: document.getElementById("rgOperador"),
    rgValor: document.getElementById("rgValor"),
    rgUnidad: document.getElementById("rgUnidad"),
    rgSalida: document.getElementById("rgSalida"),
    rgEstadoCombo: document.getElementById("rgEstadoCombo"),
    rgEstadoNum: document.getElementById("rgEstadoNum"),
    rgRango: document.getElementById("rgRango"),
    rgTiempo: document.getElementById("rgTiempo"),
    rgPerm: document.getElementById("rgPerm"),
    rgPreview: document.getElementById("rgPreview"),
    rgBody: document.getElementById("rgBody"),
    rgIdent: document.getElementById("rgIdent"),
    rgPrefijo: document.getElementById("rgPrefijo"),
    rgOut: document.getElementById("rgOut"),
    rgQueue: document.getElementById("rgQueue"),
    rgAddIf: document.getElementById("rgAddIf"),
    rgAddElse: document.getElementById("rgAddElse"),
    rgAddEndif: document.getElementById("rgAddEndif"),
    rgUp: document.getElementById("rgUp"),
    rgDown: document.getElementById("rgDown"),
    rgDel: document.getElementById("rgDel"),
    rgClear: document.getElementById("rgClear"),
    rgEnqueue: document.getElementById("rgEnqueue"),
    rgCopyJson: document.getElementById("rgCopyJson"),
    rgCopyHex: document.getElementById("rgCopyHex"),
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
      if (els.panelCmd) els.panelCmd.classList.toggle("active", activeTab === "cmd");
      if (els.panelReglas) els.panelReglas.classList.toggle("active", activeTab === "reglas");
      if (activeTab === "history") loadHistory();
      if (activeTab === "archive") loadArchiveTab();
      if (activeTab === "sent") loadSent();
      if (activeTab === "status") loadSeguimiento();
      if (activeTab === "cmd") loadComandos();
      if (activeTab === "reglas") loadReglas();
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
      if (!selected || !selected.session_id) {
        live = selected ? live.filter((m) => m.addr === selected.addr) : live;
        if (!selected) live = [];
        renderSerial();
        els.sendHint.textContent = selected
          ? `Serial · ${selected.addr} · solo tramas de esta conexión`
          : "Serial en vivo — vacío hasta que entre una sesión nueva";
        return;
      }
      const q = `session_id=${encodeURIComponent(selected.session_id)}&limit=${LIVE_MAX}`;
      const r = await fetch(`${API}/api/messages?${q}`);
      const data = await r.json();
      live = (data.messages || []).slice(-LIVE_MAX);
      renderSerial();
      els.sendHint.textContent = `Serial · sesión actual · ${liveRows().length} tramas (máx ${LIVE_MAX})`;
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
    all.innerHTML = `<div class="ip">Todos</div><div class="meta">Solo sesión en vivo (máx ${LIVE_MAX})</div>`;
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
    if (els.cmdTitle) {
      els.cmdTitle.textContent = selected
        ? `Comandos · ${selected.ip}:${selected.port}`
        : "Comandos";
    }
    if (els.reglasTitle) {
      els.reglasTitle.textContent = selected
        ? `Reglas · ${selected.ip}:${selected.port}`
        : "Reglas";
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
    if (activeTab === "cmd") await loadComandos();
    if (activeTab === "reglas") await loadReglas();
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
        if (msg.type === "comando" && (activeTab === "cmd" || activeTab === "reglas")) {
          if (activeTab === "cmd") loadComandos();
          if (activeTab === "reglas") loadReglas();
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

  function cmdScope() {
    const p = new URLSearchParams();
    p.set("ident", "POLLO_BEBE");
    if (selected && selected.ip) p.set("ip", selected.ip);
    return p;
  }

  function cmdBodyBase() {
    return {
      ident: "POLLO_BEBE",
      addr: selected ? selected.addr : null,
      ip: selected ? selected.ip : null,
      session_id: selected ? selected.session_id : null,
    };
  }

  function updateRelayBitsPreview() {
    if (!els.cmdRelays || !els.cmdRelayBits) return;
    const bits = [...els.cmdRelays.querySelectorAll("input[type=checkbox]")]
      .sort((a, b) => Number(a.dataset.id) - Number(b.dataset.id))
      .map((c) => (c.checked ? "0" : "1"))
      .join("");
    els.cmdRelayBits.textContent = bits || "----------";
    return bits;
  }

  function updatePotHint() {
    if (!els.cmdPotV || !els.cmdPotHint) return;
    const v = Number(els.cmdPotV.value);
    const n = Math.round(v * 100);
    els.cmdPotHint.textContent = `n=${n} · ${(n / 10).toFixed(1)}% · ${v.toFixed(2)} V`;
    return n;
  }

  function renderCmdCatalog(data) {
    const online = !!(data && data.online);
    if (els.cmdOnline) els.cmdOnline.textContent = online ? "en línea" : "sin sesión";
    if (els.cmdBanner) {
      els.cmdBanner.classList.toggle("on", online);
      els.cmdBanner.classList.toggle("off", !online);
      els.cmdBanner.textContent = online
        ? "Equipo en línea: Encolar manda el comando a la cola y sale en la próxima ventana libre (V1/V2)."
        : "Sin sesión activa: el comando se guarda solo como referencia. No se envía. Se cancela solo a las 2 horas.";
    }
    const screen = (data && data.screen) || {};
    if (els.cmdScreen) {
      els.cmdScreen.innerHTML =
        kpiHtml("Supply", fmtStatusVal(screen.supply_air_c, " °C")) +
        kpiHtml("Return", fmtStatusVal(screen.return_air_c, " °C")) +
        kpiHtml("SP temp", fmtStatusVal(screen.setpoint_c, " °C")) +
        kpiHtml("Humedad", fmtStatusVal(screen.humidity_pct, " %")) +
        kpiHtml("SP humedad", fmtStatusVal(screen.humidity_setpoint, " %")) +
        kpiHtml("Contenedor", screen.container_id || "—") +
        kpiHtml("Modo", MODE_ES[screen.unit_mode] || screen.unit_mode || "—");
    }
    if (els.cmdFields) {
      els.cmdFields.innerHTML = "";
      for (const f of (data && data.fields) || []) {
        const card = document.createElement("div");
        card.className = "cmd-card";
        card.innerHTML =
          `<strong>${esc(f.label)}</strong> <span class="cur">ahora ${esc(fmtStatusVal(f.current, f.unit ? " " + f.unit : ""))}</span>` +
          `<p class="help">${esc(f.help || "")} · idx ${f.idx} · fp ${f.fp}</p>` +
          `<div class="cmd-row"><input type="number" step="any" data-idx="${f.idx}" data-fp="${f.fp}" placeholder="nuevo valor" />` +
          `<button type="button" class="btn primary btn-enc-mp">Encolar</button></div>` +
          `<code class="cmd-preview" data-preview-idx="${f.idx}">MP5000_Trama_Write(${f.idx},valor,${f.fp})</code>`;
        const inp = card.querySelector("input");
        const prev = card.querySelector(".cmd-preview");
        inp.addEventListener("input", () => {
          prev.textContent = `MP5000_Trama_Write(${f.idx},${inp.value || "valor"},${f.fp})`;
        });
        card.querySelector(".btn-enc-mp").addEventListener("click", () => {
          enqueueComando({
            ...cmdBodyBase(),
            kind: "mp5000_write",
            idx: f.idx,
            value: inp.value,
            fp: f.fp,
          });
        });
        els.cmdFields.appendChild(card);
      }
    }
    if (els.cmdActions) {
      els.cmdActions.innerHTML = "";
      for (const a of (data && data.actions) || []) {
        const card = document.createElement("div");
        card.className = "cmd-card";
        const needVal = a.idx === 30;
        card.innerHTML =
          `<strong>${esc(a.label)}</strong><p class="help">${esc(a.help || "")}</p>` +
          (needVal ? `<div class="cmd-row"><input type="number" id="cmdPauseS" value="300" /> s</div>` : "") +
          `<button type="button" class="btn primary">Encolar acción</button>`;
        card.querySelector("button").addEventListener("click", () => {
          if (!confirm(`¿Encolar «${a.label}»? Acción de riesgo.`)) return;
          const value = needVal ? (card.querySelector("input") || {}).value : 1;
          enqueueComando({
            ...cmdBodyBase(),
            kind: "mp5000_write",
            idx: a.idx,
            value,
            fp: a.fp || 1,
          });
        });
        els.cmdActions.appendChild(card);
      }
    }
    if (els.cmdRelays) {
      els.cmdRelays.innerHTML = "";
      for (const r of (data && data.relays) || []) {
        const row = document.createElement("label");
        row.className = "relay-toggle";
        row.innerHTML =
          `<span>R${r.id}</span><span>${esc(r.name)}</span>` +
          `<span><input type="checkbox" data-id="${r.id}" ${r.on ? "checked" : ""} /> ON</span>`;
        els.cmdRelays.appendChild(row);
      }
      els.cmdRelays.querySelectorAll("input").forEach((c) => {
        c.addEventListener("change", updateRelayBitsPreview);
      });
      updateRelayBitsPreview();
    }
  }

  function renderCmdQueue(data) {
    if (!els.cmdQueue) return;
    const items = (data && data.items) || [];
    if (!items.length) {
      els.cmdQueue.innerHTML = "<p class='hint'>Cola vacía (pendientes y referencias).</p>";
      return;
    }
    els.cmdQueue.innerHTML = items
      .map((it) => {
        return (
          `<div class="q-item"><span class="kind-badge kind-${esc(it.status)}">${esc(it.status)}</span> ` +
          `${esc(it.label || it.rs || "")}<br><code>${esc(it.rs || "")}</code> ` +
          `<button type="button" class="btn ghost" data-cancel="${esc(it.queue_id)}">Cancelar</button></div>`
        );
      })
      .join("");
    els.cmdQueue.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => cancelComando(btn.dataset.cancel));
    });
  }

  function renderCmdSent(data) {
    if (!els.cmdSentBody) return;
    els.cmdSentBody.innerHTML = "";
    for (const it of (data && data.items) || []) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td class="mono">${esc(formatTs(it.sent_at || it.enqueued_at))}</td>` +
        `<td><span class="kind-badge">${esc(it.status || "")}</span></td>` +
        `<td>${esc(it.label || "—")}</td>` +
        `<td class="mono">${esc(it.rs || "")}</td>` +
        `<td>${esc(it.window_used || it.window || "—")}</td>`;
      els.cmdSentBody.appendChild(tr);
    }
  }

  async function enqueueComando(body) {
    try {
      const r = await fetch(`${API}/api/comandos/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.detail || "No se pudo encolar");
        return;
      }
      const st = (data.item && data.item.status) || "";
      const note = data.online
        ? `En cola (${st}). Sale en la próxima ventana libre (FIFO).`
        : `Referencia guardada (${st}). No se envía: no hay sesión. Se cancela a las 2 h.`;
      if (els.cmdMeta) els.cmdMeta.textContent = note;
      if (els.reglasMeta) els.reglasMeta.textContent = note;
      if (activeTab === "cmd") loadComandos();
      if (activeTab === "reglas") loadReglas();
    } catch (e) {
      alert(String(e));
    }
  }

  async function cancelComando(queueId) {
    try {
      await fetch(`${API}/api/comandos/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: queueId }),
      });
      if (activeTab === "cmd") loadComandos();
      if (activeTab === "reglas") loadReglas();
    } catch (e) {
      alert(String(e));
    }
  }

  async function loadComandos() {
    const p = cmdScope();
    try {
      const [cat, queue, sent] = await Promise.all([
        fetch(`${API}/api/comandos/catalog?${p}`).then((r) => r.json()),
        fetch(`${API}/api/comandos/queue?${selected && selected.ip ? "ip=" + encodeURIComponent(selected.ip) : ""}`).then((r) => r.json()),
        fetch(`${API}/api/comandos/sent?${p}&limit=100`).then((r) => r.json()),
      ]);
      renderCmdCatalog(cat);
      renderCmdQueue(queue);
      renderCmdSent(sent);
      const openWin = Object.values(queue.windows || {}).find((w) => w && w.open);
      if (els.cmdWindow) els.cmdWindow.textContent = openWin ? `ventana ${openWin.name}` : "ventana —";
      if (els.cmdMeta) {
        els.cmdMeta.textContent =
          `${queue.queued || 0} en cola · ${queue.reference || 0} referencia(s) · ${sent.sent || 0} enviados · TTL 2 h`;
      }
    } catch (e) {
      if (els.cmdMeta) els.cmdMeta.textContent = String(e);
    }
  }

  if (els.btnRefreshCmd) els.btnRefreshCmd.addEventListener("click", loadComandos);
  if (els.btnClearCmd) {
    els.btnClearCmd.addEventListener("click", async () => {
      if (!confirm("¿Cancelar todos los pendientes y referencias?")) return;
      await fetch(`${API}/api/comandos/queue/clear`, { method: "POST" });
      loadComandos();
    });
  }
  if (els.btnEnqueueRelay) {
    els.btnEnqueueRelay.addEventListener("click", () => {
      const bits = updateRelayBitsPreview();
      enqueueComando({ ...cmdBodyBase(), kind: "relay_set", bits });
    });
  }
  if (els.btnEnqueuePot) {
    els.btnEnqueuePot.addEventListener("click", () => {
      const n = updatePotHint();
      enqueueComando({ ...cmdBodyBase(), kind: "relay_pot", pot: n });
    });
  }
  if (els.cmdPotV) els.cmdPotV.addEventListener("input", updatePotHint);

  const RG_RELAY_EST = [
    { txt: "ACTIVAR  (0)", val: 0 },
    { txt: "DESACTIVAR  (1)", val: 1 },
  ];
  const RG_GATE_EST = [
    { txt: "OPEN  (1)", val: 1 },
    { txt: "CLOSE  (0)", val: 0 },
  ];
  let rgTables = { entradas: [], salidas: [], operadores: [] };
  let rgLive = { info: {}, relays: [], motores: [] };
  let rgProgram = [];
  let rgSel = -1;
  let rgFilled = false;

  function rgModo() {
    const el = document.querySelector('input[name="rgModo"]:checked');
    return el ? el.value : "DEC";
  }

  function rgB1(v) {
    return (v & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function rgB2(valor, modo) {
    const n = Number(valor);
    if (modo === "DEC") {
      if (!Number.isInteger(n) || n < 0 || n > 9999) {
        throw new Error(`${valor} no cabe en BCD 0-9999; use HEX`);
      }
      return String(n).padStart(4, "0");
    }
    return (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  }

  function rgGroup(hexstr) {
    const hx = String(hexstr || "").replace(/\s/g, "").toUpperCase();
    return hx.replace(/../g, (b) => `${b} `).trim();
  }

  function rgFind(list, name) {
    return (list || []).find((x) => x.name === name) || null;
  }

  function rgCodeByte(code) {
    return parseInt(String(code || "").replace(/^0x/i, ""), 16);
  }

  function rgEstadoLabel(sal, estado) {
    if (!sal) return String(estado);
    if (sal.tipo === "relay") return Number(estado) === 0 ? "ACTIVAR" : "DESACTIVAR";
    if (sal.tipo === "compuerta") return Number(estado) === 1 ? "OPEN" : "CLOSE";
    if (sal.name === "Setpoint") return `${(Number(estado) / 10).toFixed(1)} °C`;
    if (sal.name === "MOTORES") return `${estado} %`;
    return String(estado);
  }

  function rgSalidaActual() {
    return rgFind(rgTables.salidas, els.rgSalida ? els.rgSalida.value : "");
  }

  function rgEntradaActual() {
    return rgFind(rgTables.entradas, els.rgEntrada ? els.rgEntrada.value : "");
  }

  function rgEstadoValor() {
    const sal = rgSalidaActual();
    if (sal && (sal.tipo === "relay" || sal.tipo === "compuerta")) {
      return Number(els.rgEstadoCombo && els.rgEstadoCombo.value);
    }
    return Number(els.rgEstadoNum && els.rgEstadoNum.value);
  }

  function rgFillSelect(sel, items, keep) {
    if (!sel) return;
    const cur = keep || sel.value;
    sel.innerHTML = (items || [])
      .map((it) => `<option value="${esc(it.name)}">${esc(it.name)}</option>`)
      .join("");
    if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  function rgOnSalidaChange() {
    const sal = rgSalidaActual();
    if (els.rgRango) els.rgRango.textContent = (sal && sal.help) || "";
    const combo = !!(sal && (sal.tipo === "relay" || sal.tipo === "compuerta"));
    if (els.rgEstadoCombo) els.rgEstadoCombo.hidden = !combo;
    if (els.rgEstadoNum) {
      els.rgEstadoNum.hidden = combo;
      if (sal && !combo) {
        els.rgEstadoNum.min = sal.min;
        els.rgEstadoNum.max = sal.max;
        const v = Number(els.rgEstadoNum.value);
        if (Number.isNaN(v) || v < sal.min || v > sal.max) els.rgEstadoNum.value = String(sal.min);
      }
    }
    if (combo && els.rgEstadoCombo) {
      const tabla = sal.tipo === "relay" ? RG_RELAY_EST : RG_GATE_EST;
      els.rgEstadoCombo.innerHTML = tabla
        .map((t) => `<option value="${t.val}">${esc(t.txt)}</option>`)
        .join("");
    }
    rgRefreshPreview();
  }

  function rgReadIf() {
    const ent = rgEntradaActual();
    const op = rgFind(rgTables.operadores, els.rgOperador ? els.rgOperador.value : "");
    const sal = rgSalidaActual();
    if (!ent || !op || !sal) throw new Error("Complete entrada, operador y salida");
    const valor = Number(String(els.rgValor.value || "").replace(",", "."));
    if (Number.isNaN(valor)) throw new Error("El valor a comparar no es un número válido.");
    if (valor < ent.min || valor > ent.max) {
      throw new Error(`El valor debe estar entre ${ent.min} y ${ent.max} ${ent.unit}.`);
    }
    const estado = rgEstadoValor();
    if (!Number.isFinite(estado) || estado < sal.min || estado > sal.max) {
      throw new Error(`El estado de ${sal.name} debe estar entre ${sal.min} y ${sal.max}.`);
    }
    const permanente = !!(els.rgPerm && els.rgPerm.checked);
    let tiempo = 0;
    if (!permanente) {
      tiempo = Number(els.rgTiempo && els.rgTiempo.value);
      if (!Number.isInteger(tiempo) || tiempo < 0 || tiempo > 65534) {
        throw new Error("El tiempo debe estar entre 0 y 65534 segundos.");
      }
    }
    const modo = rgModo();
    const raw = Math.round(valor * 10);
    const tHex = permanente ? "FEFE" : rgB2(tiempo, modo);
    const codigo =
      rgB1(0x50) +
      rgB1(rgCodeByte(ent.code)) +
      rgB1(rgCodeByte(op.code)) +
      rgB2(raw, modo) +
      rgB1(rgCodeByte(sal.code)) +
      rgB2(estado, modo) +
      tHex;
    const tTxt = permanente ? "permanente" : `${tiempo} s`;
    const desc = `SI ${ent.name} ${op.simbolo} ${valor} ${ent.unit} → ${sal.name} = ${rgEstadoLabel(sal, estado)} (${tTxt})`;
    return {
      tipo: "if",
      entrada: ent.name,
      operador: op.name,
      valor,
      salida: sal.name,
      estado,
      tiempo: permanente ? null : tiempo,
      permanente,
      codigo,
      descripcion: desc,
      timed: !permanente,
    };
  }

  function rgRefreshPreview() {
    if (els.rgTiempo) els.rgTiempo.disabled = !!(els.rgPerm && els.rgPerm.checked);
    const ent = rgEntradaActual();
    if (els.rgUnidad && ent) {
      const now = rgLive.info ? rgLive.info[ent.live_key] : null;
      const nowTxt = now == null ? "" : ` · ahora ${now} ${ent.unit}`;
      els.rgUnidad.textContent = `${ent.unit}   (x10 → 2 bytes)${nowTxt}`;
    }
    if (!els.rgPreview) return;
    try {
      const r = rgReadIf();
      els.rgPreview.textContent = `→  ${rgGroup(r.codigo)}`;
      els.rgPreview.classList.remove("bad");
    } catch (e) {
      els.rgPreview.textContent = `→  ${e.message || e}`;
      els.rgPreview.classList.add("bad");
    }
    rgRefreshOut();
  }

  function rgRefreshOut() {
    const hex = rgProgram.map((r) => r.codigo).join("");
    const ident = (els.rgIdent && els.rgIdent.value) || "POLLO_BEBE";
    const pref = (els.rgPrefijo && els.rgPrefijo.value) || "PANTALLA_CMD:";
    const trama = JSON.stringify({ i: ident, rs: pref + hex });
    if (els.rgOut) {
      els.rgOut.textContent = hex ? `${rgGroup(hex)}\n\n${trama}` : "(sin condicionales)";
    }
    return { hex, ident, pref, trama };
  }

  function rgRepaint() {
    if (!els.rgBody) return;
    els.rgBody.innerHTML = "";
    rgProgram.forEach((r, i) => {
      const tr = document.createElement("tr");
      if (i === rgSel) tr.className = "sel";
      tr.innerHTML =
        `<td>${i + 1}</td><td>${esc(r.descripcion)}</td><td class="mono">${esc(rgGroup(r.codigo))}</td>`;
      tr.addEventListener("click", () => {
        rgSel = i;
        rgRepaint();
      });
      els.rgBody.appendChild(tr);
    });
    rgRefreshOut();
  }

  function rgApiItems() {
    return rgProgram.map((r) => {
      if (r.tipo === "else") return { tipo: "else" };
      if (r.tipo === "endif") return { tipo: "endif" };
      return {
        tipo: "if",
        entrada: r.entrada,
        operador: r.operador,
        valor: r.valor,
        salida: r.salida,
        estado: r.estado,
        tiempo: r.tiempo || 0,
        permanente: !!r.permanente,
      };
    });
  }

  function rgRenderLive(data) {
    rgLive = (data && data.live) || { info: {}, relays: [], motores: [] };
    const info = rgLive.info || {};
    const relays = rgLive.relays || [];
    const motores = rgLive.motores || [];
    const online = !!(data && data.online);
    if (els.reglasOnline) els.reglasOnline.textContent = online ? "en línea" : "sin sesión";
    if (els.reglasBanner) {
      els.reglasBanner.classList.toggle("on", online);
      els.reglasBanner.classList.toggle("off", !online);
      els.reglasBanner.textContent = online
        ? "Equipo en línea. El programa entra a la misma cola FIFO que Comandos (el primero encolado sale primero). Son acciones con tiempo, no consignas."
        : "Sin sesión: se guarda como referencia en la misma cola. No se envía. Se cancela a las 2 h. No reemplaza MP-5000 ni SET_RELE.";
    }
    if (!els.reglasLive) return;
    let html =
      kpiHtml("Supply", fmtStatusVal(info.supply_air_c, " °C")) +
      kpiHtml("Return", fmtStatusVal(info.return_air_c, " °C")) +
      kpiHtml("SP temp", fmtStatusVal(info.setpoint_c, " °C")) +
      kpiHtml("CO₂", fmtStatusVal(info.co2_pct, " %")) +
      kpiHtml("USDA1", fmtStatusVal(info.usda1_c, " °C")) +
      kpiHtml("USDA2", fmtStatusVal(info.usda2_c, " °C")) +
      kpiHtml("USDA3", fmtStatusVal(info.usda3_c, " °C")) +
      kpiHtml("USDA4", fmtStatusVal(info.usda4_c, " °C")) +
      kpiHtml("Humedad", fmtStatusVal(info.humidity_pct != null ? info.humidity_pct : rgLive.humidity_pct, " %")) +
      kpiHtml("SP humedad", fmtStatusVal(info.humidity_setpoint_pct, " %"));
    for (const r of relays) {
      html += kpiHtml(`R${r.id} ${r.name || ""}`.trim(), r.on ? "ON" : "OFF");
    }
    if (!motores.length) {
      html += kpiHtml("Motor 1", "—") + kpiHtml("Motor 2", "—") + kpiHtml("Motor 3", "—") + kpiHtml("Motor 4", "—");
    } else {
      for (const m of motores) {
        html += kpiHtml(
          m.label || `Motor ${m.id}`,
          m.volts == null ? "—" : `${m.volts} V · ${m.speed_pct ?? "—"} %`
        );
      }
    }
    els.reglasLive.innerHTML = html;
  }

  function rgEnsureTables(tables) {
    rgTables = tables || rgTables;
    if (!rgFilled && rgTables.entradas && rgTables.entradas.length) {
      rgFillSelect(els.rgEntrada, rgTables.entradas);
      rgFillSelect(els.rgOperador, rgTables.operadores);
      rgFillSelect(els.rgSalida, rgTables.salidas);
      if (els.rgEntrada) els.rgEntrada.value = "Suministro";
      if (els.rgOperador) {
        const mayor = rgTables.operadores.find((o) => o.simbolo === ">");
        if (mayor) els.rgOperador.value = mayor.name;
      }
      if (els.rgSalida) els.rgSalida.value = "RELAY1";
      rgFilled = true;
      rgOnSalidaChange();
    }
  }

  function renderRgQueue(data) {
    if (!els.rgQueue) return;
    const items = (data && data.items) || [];
    if (!items.length) {
      els.rgQueue.innerHTML = "<p class='hint'>Cola vacía. Misma línea FIFO que la pestaña Comandos.</p>";
      return;
    }
    els.rgQueue.innerHTML = items
      .map((it) => {
        const tag = it.kind === "pantalla_cmd" ? "regla" : it.kind || "";
        return (
          `<div class="q-item"><span class="kind-badge kind-${esc(it.status)}">${esc(it.status)}</span> ` +
          `<span class="kind-badge">${esc(tag)}</span> ` +
          `${esc(it.label || it.rs || "")}<br><code>${esc(it.rs || "")}</code> ` +
          `<button type="button" class="btn ghost" data-cancel="${esc(it.queue_id)}">Cancelar</button></div>`
        );
      })
      .join("");
    els.rgQueue.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => cancelComando(btn.dataset.cancel));
    });
  }

  async function loadReglas() {
    const p = cmdScope();
    if (selected && selected.addr) p.set("addr", selected.addr);
    try {
      const [cat, queue] = await Promise.all([
        fetch(`${API}/api/reglas/catalog?${p}`).then((r) => r.json()),
        fetch(`${API}/api/comandos/queue?${selected && selected.ip ? "ip=" + encodeURIComponent(selected.ip) : ""}`).then((r) => r.json()),
      ]);
      rgEnsureTables(cat.tables);
      rgRenderLive(cat);
      renderRgQueue(queue);
      rgRefreshPreview();
      if (els.reglasMeta) {
        els.reglasMeta.textContent =
          `${queue.queued || 0} en cola · ${queue.reference || 0} referencia(s) · acciones con tiempo · motores = 4 analógicas`;
      }
    } catch (e) {
      if (els.reglasMeta) els.reglasMeta.textContent = String(e);
    }
  }

  function rgBind() {
    ["rgEntrada", "rgOperador", "rgValor", "rgEstadoNum", "rgTiempo", "rgIdent"].forEach((k) => {
      if (els[k]) els[k].addEventListener("input", rgRefreshPreview);
      if (els[k]) els[k].addEventListener("change", rgRefreshPreview);
    });
    if (els.rgSalida) els.rgSalida.addEventListener("change", rgOnSalidaChange);
    if (els.rgEstadoCombo) els.rgEstadoCombo.addEventListener("change", rgRefreshPreview);
    if (els.rgPerm) els.rgPerm.addEventListener("change", rgRefreshPreview);
    document.querySelectorAll('input[name="rgModo"]').forEach((el) => {
      el.addEventListener("change", rgRefreshPreview);
    });
    if (els.rgAddIf) {
      els.rgAddIf.addEventListener("click", () => {
        try {
          rgProgram.push(rgReadIf());
          rgSel = rgProgram.length - 1;
          rgRepaint();
        } catch (e) {
          alert(e.message || e);
        }
      });
    }
    if (els.rgAddElse) {
      els.rgAddElse.addEventListener("click", () => {
        rgProgram.push({ tipo: "else", codigo: "53", descripcion: "--- ELSE ---" });
        rgSel = rgProgram.length - 1;
        rgRepaint();
      });
    }
    if (els.rgAddEndif) {
      els.rgAddEndif.addEventListener("click", () => {
        rgProgram.push({ tipo: "endif", codigo: "51", descripcion: "--- FIN IF ---" });
        rgSel = rgProgram.length - 1;
        rgRepaint();
      });
    }
    if (els.rgUp) {
      els.rgUp.addEventListener("click", () => {
        if (rgSel <= 0) return;
        const j = rgSel - 1;
        [rgProgram[rgSel], rgProgram[j]] = [rgProgram[j], rgProgram[rgSel]];
        rgSel = j;
        rgRepaint();
      });
    }
    if (els.rgDown) {
      els.rgDown.addEventListener("click", () => {
        if (rgSel < 0 || rgSel >= rgProgram.length - 1) return;
        const j = rgSel + 1;
        [rgProgram[rgSel], rgProgram[j]] = [rgProgram[j], rgProgram[rgSel]];
        rgSel = j;
        rgRepaint();
      });
    }
    if (els.rgDel) {
      els.rgDel.addEventListener("click", () => {
        if (rgSel < 0) return;
        rgProgram.splice(rgSel, 1);
        if (rgSel >= rgProgram.length) rgSel = rgProgram.length - 1;
        rgRepaint();
      });
    }
    if (els.rgClear) {
      els.rgClear.addEventListener("click", () => {
        if (!rgProgram.length || !confirm("¿Borrar todas las condicionales?")) return;
        rgProgram = [];
        rgSel = -1;
        rgRepaint();
      });
    }
    if (els.rgEnqueue) {
      els.rgEnqueue.addEventListener("click", () => {
        if (!rgProgram.length) {
          alert("Agregue al menos una condicional");
          return;
        }
        enqueueComando({
          ...cmdBodyBase(),
          ident: (els.rgIdent && els.rgIdent.value) || "POLLO_BEBE",
          kind: "pantalla_cmd",
          modo: rgModo(),
          reglas: rgApiItems(),
        });
      });
    }
    if (els.rgCopyJson) {
      els.rgCopyJson.addEventListener("click", async () => {
        const { trama } = rgRefreshOut();
        try {
          await navigator.clipboard.writeText(trama);
        } catch (_) {}
      });
    }
    if (els.rgCopyHex) {
      els.rgCopyHex.addEventListener("click", async () => {
        const { hex } = rgRefreshOut();
        try {
          await navigator.clipboard.writeText(hex);
        } catch (_) {}
      });
    }
    if (els.btnRefreshReglas) els.btnRefreshReglas.addEventListener("click", loadReglas);
  }

  rgBind();

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
