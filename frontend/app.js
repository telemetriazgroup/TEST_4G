(() => {
  const meta = document.querySelector('meta[name="api-base"]');
  const API = (meta && meta.content) || location.origin;

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
    historyBody: document.getElementById("historyBody"),
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
    btnRefreshHistory: document.getElementById("btnRefreshHistory"),
    filterDir: document.getElementById("filterDir"),
    filterType: document.getElementById("filterType"),
    serialView: document.getElementById("serialView"),
    historyView: document.getElementById("historyView"),
    panelSerial: document.getElementById("panelSerial"),
    panelHistory: document.getElementById("panelHistory"),
  };

  let selected = null;
  /** @type {Array<object>} live buffer (serial) */
  let live = [];
  /** @type {Array<object>} history rows */
  let history = [];
  let activeTab = "serial";
  let ws;

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
    // fallback: convertir hex a decimales por byte
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

  /** Convierte hex (p.ej. 48656C6C6F) a ASCII legible. */
  function hexToAscii(hexRaw) {
    const hex = String(hexRaw || "").replace(/[\s:]/g, "");
    if (!hex || hex.length < 2 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      return "";
    }
    let out = "";
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      // ASCII imprimible 0x20–0x7E; resto como punto
      out += code >= 0x20 && code <= 0x7e ? String.fromCharCode(code) : ".";
    }
    return out;
  }

  function asciiOf(msg) {
    const fromHex = hexToAscii(msg.hex);
    if (fromHex) return fromHex;
    if (msg.text != null && msg.text !== "" && normalizeType(msg) !== "tcp_header") {
      // Si no hay hex válido, mostrar text filtrado a ASCII
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

  // ---- Tabs ----
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
      els.panelSerial.classList.toggle("active", activeTab === "serial");
      els.panelHistory.classList.toggle("active", activeTab === "history");
      if (activeTab === "history") loadHistory();
    });
  });

  // ---- Serial en vivo ----
  function appendSerialLine(msg) {
    if (selected && msg.addr && msg.addr !== selected.addr) return;

    const dir = (msg.direction || "rx").toLowerCase();
    const type = normalizeType(msg);
    const line = document.createElement("div");
    line.className = `line ${dir}`;

    const hex = msg.hex || "";
    const ascii = asciiOf(msg);
    const dec = decimalOf(msg);
    const hdr = formatHeader(msg.tcp_header);
    const view = serialViewMode();

    if (type === "tcp_header") {
      line.innerHTML =
        `<span class="ts">${esc(formatTs(msg.ts))}</span> ` +
        `<span class="dir">HDR</span> ` +
        `<span class="payload">${esc(msg.text || hdr)}</span>`;
    } else {
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
      line.innerHTML = parts.join(" ");
    }

    els.serialTerm.appendChild(line);
    els.serialTerm.scrollTop = els.serialTerm.scrollHeight;
    els.emptySerial.classList.remove("show");
  }

  function renderSerial() {
    els.serialTerm.innerHTML = "";
    const rows = selected
      ? live.filter((m) => !m.addr || m.addr === selected.addr)
      : live;
    els.emptySerial.classList.toggle("show", rows.length === 0);
    for (const m of rows) appendSerialLine(m);
  }

  function pushLive(msg) {
    const row = {
      addr: msg.addr,
      ip: msg.ip,
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
    if (live.length > 400) live = live.slice(-300);

    if (activeTab === "serial") {
      if (!selected || !row.addr || row.addr === selected.addr) {
        appendSerialLine(row);
      }
    }
    // también acumular en histórico en memoria
    history.unshift(row);
    if (history.length > 2000) history.length = 2000;
    if (activeTab === "history") renderHistory();
  }

  async function refreshSerial() {
    els.sendHint.textContent = "Actualizando serial…";
    try {
      await loadDevices();
      const q = selected
        ? `addr=${encodeURIComponent(selected.addr)}&limit=150`
        : "limit=150";
      const r = await fetch(`${API}/api/messages?${q}`);
      const data = await r.json();
      live = data.messages || [];
      renderSerial();
      els.sendHint.textContent = `Serial actualizado · ${live.length} trama(s)`;
    } catch (e) {
      els.sendHint.textContent = String(e);
    }
  }

  // ---- Histórico ----
  function passesHistoryFilters(msg) {
    const dir = (msg.direction || "rx").toLowerCase();
    const type = normalizeType(msg);
    if (selected && msg.addr && msg.addr !== selected.addr) return false;
    if (els.filterDir.value !== "all" && dir !== els.filterDir.value) return false;
    if (els.filterType.value !== "all" && type !== els.filterType.value) return false;
    return true;
  }

  function renderHistory() {
    const rows = history.filter(passesHistoryFilters);
    els.historyBody.innerHTML = "";
    els.emptyHistory.classList.toggle("show", rows.length === 0);
    els.historyMeta.textContent = `${rows.length} trama(s) mostradas · total cargado ${history.length}`;

    const view = historyViewMode();
    const showHex = view === "hex" || view === "both";
    const showAscii = view === "ascii" || view === "both";

    // Toggle columnas del thead
    document.querySelectorAll(".col-hex").forEach((el) => {
      el.style.display = showHex ? "" : "none";
    });
    document.querySelectorAll(".col-ascii").forEach((el) => {
      el.style.display = showAscii ? "" : "none";
    });

    for (const msg of rows) {
      const dir = (msg.direction || "rx").toLowerCase();
      const type = normalizeType(msg);
      const isHdr = type === "tcp_header";
      const hex = isHdr ? "—" : (msg.hex || "—");
      const ascii = isHdr ? "—" : asciiOf(msg);
      const tr = document.createElement("tr");
      tr.className = `cap-${dir}`;
      tr.innerHTML =
        `<td class="mono">${esc(formatTs(msg.ts))}</td>` +
        `<td><span class="dir-badge dir-${dir}">${esc(dir.toUpperCase())}</span></td>` +
        `<td><span class="type-badge type-${esc(type)}">${esc(type.toUpperCase())}</span></td>` +
        `<td class="mono hex col-hex" style="display:${showHex ? "" : "none"}">${esc(hex)}</td>` +
        `<td class="mono ascii col-ascii" style="display:${showAscii ? "" : "none"}">${esc(ascii)}</td>` +
        `<td class="mono val">${esc(isHdr ? "—" : decimalOf(msg))}</td>` +
        `<td class="mono muted">${esc(formatHeader(msg.tcp_header))}</td>` +
        `<td class="mono muted">${esc(msg.addr || msg.ip || "")}</td>`;
      els.historyBody.appendChild(tr);
    }
  }

  async function loadHistory() {
    els.historyMeta.textContent = "Cargando histórico…";
    try {
      const q = selected
        ? `addr=${encodeURIComponent(selected.addr)}&limit=500`
        : "limit=500";
      const r = await fetch(`${API}/api/history?${q}`);
      const data = await r.json();
      history = data.messages || [];
      renderHistory();
      els.historyMeta.textContent = `Histórico · ${data.total ?? history.length} en DB · mostrando ${history.length}`;
    } catch (e) {
      els.historyMeta.textContent = String(e);
    }
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
    all.innerHTML = `<div class="ip">Todos</div><div class="meta">Ver todos los equipos</div>`;
    all.addEventListener("click", () => selectDevice(null));
    els.deviceList.appendChild(all);

    for (const d of devices) {
      const li = document.createElement("li");
      li.dataset.addr = d.addr;
      if (selected && selected.addr === d.addr) li.classList.add("active");
      const hdr = d.tcp_header
        ? `${d.tcp_header.src_ip}:${d.tcp_header.src_port}`
        : d.addr;
      li.innerHTML =
        `<div class="ip">${esc(d.ip || d.addr)}</div>` +
        `<div class="meta">${esc(hdr)} · idle ${esc(d.idle_s ?? "—")}s</div>`;
      li.addEventListener("click", () => selectDevice(d));
      els.deviceList.appendChild(li);
    }

    if (selected && !devices.some((d) => d.addr === selected.addr)) {
      selected = null;
      els.serialTitle.textContent = "Serial en vivo";
      els.historyTitle.textContent = "Tramas históricas";
      els.sendHint.textContent = "Selecciona un dispositivo para enviar.";
    }
  }

  async function selectDevice(d) {
    selected = d ? { addr: d.addr, ip: d.ip } : null;
    els.serialTitle.textContent = selected
      ? `Serial · ${selected.addr}`
      : "Serial en vivo";
    els.historyTitle.textContent = selected
      ? `Histórico · ${selected.addr}`
      : "Tramas históricas";
    els.sendHint.textContent = selected
      ? `Enviando a ${selected.addr}`
      : "Selecciona un dispositivo para enviar.";

    [...els.deviceList.children].forEach((li, i) => {
      if (i === 0) li.classList.toggle("active", !selected);
      else li.classList.toggle("active", !!(selected && li.dataset.addr === selected.addr));
    });

    await refreshSerial();
    if (activeTab === "history") await loadHistory();
    else renderHistory();
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
      els.sendHint.textContent = `TX ${data.bytes} B · HEX ${data.hex} · DEC ${data.decimal || "—"}`;
    } catch (err) {
      els.sendHint.textContent = String(err);
    }
  });

  els.btnClearSerial.addEventListener("click", () => {
    live = [];
    renderSerial();
  });
  els.btnRefreshSerial.addEventListener("click", refreshSerial);
  els.btnRefreshHistory.addEventListener("click", loadHistory);
  els.filterDir.addEventListener("change", renderHistory);
  els.filterType.addEventListener("change", renderHistory);
  if (els.serialView) {
    els.serialView.addEventListener("change", renderSerial);
  }
  if (els.historyView) {
    els.historyView.addEventListener("change", renderHistory);
  }

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
    els.addCrLf.disabled = false;
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
