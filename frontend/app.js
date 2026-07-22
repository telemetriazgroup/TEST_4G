(() => {
  const meta = document.querySelector('meta[name="api-base"]');
  const API = (meta && meta.content) || location.origin;

  const els = {
    wsDot: document.getElementById("wsDot"),
    wsLabel: document.getElementById("wsLabel"),
    deviceList: document.getElementById("deviceList"),
    emptyDevices: document.getElementById("emptyDevices"),
    emptyCaptures: document.getElementById("emptyCaptures"),
    devCount: document.getElementById("devCount"),
    captureBody: document.getElementById("captureBody"),
    monitorTitle: document.getElementById("monitorTitle"),
    sendForm: document.getElementById("sendForm"),
    message: document.getElementById("message"),
    encoding: document.getElementById("encoding"),
    addCrLf: document.getElementById("addCrLf"),
    sendHint: document.getElementById("sendHint"),
    btnClear: document.getElementById("btnClear"),
    btnSweep: document.getElementById("btnSweep"),
    filterDir: document.getElementById("filterDir"),
    filterType: document.getElementById("filterType"),
  };

  let selected = null;
  /** @type {Array<object>} */
  let captures = [];
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

  function normalizeType(msg) {
    let t = (msg.value_type || msg.encoding || "").toLowerCase();
    if (t === "hexadecimal") t = "hex";
    if (t === "text") t = "string";
    if (!t || t === "utf-8") {
      // Inferencia local si el mensaje es antiguo
      const text = (msg.text || "").trim();
      if (/^[+-]?\d+$/.test(text)) t = "int";
      else if (/^[0-9a-fA-F]+$/.test((msg.hex || "").replace(/\s/g, "")) && /[a-fA-F]/.test(msg.hex || ""))
        t = "hex";
      else if (text.startsWith("{")) t = "json";
      else t = "string";
    }
    return t;
  }

  function displayValue(msg, type) {
    if (type === "int" && msg.int_value != null) return String(msg.int_value);
    return msg.text ?? "";
  }

  function passesFilters(msg) {
    const dir = (msg.direction || "rx").toLowerCase();
    const type = normalizeType(msg);
    if (selected && msg.addr && msg.addr !== selected.addr) return false;
    if (els.filterDir.value !== "all" && dir !== els.filterDir.value) return false;
    if (els.filterType.value !== "all" && type !== els.filterType.value) return false;
    return true;
  }

  function typeBadge(type) {
    const label = type.toUpperCase();
    return `<span class="type-badge type-${esc(type)}">${esc(label)}</span>`;
  }

  function renderCaptures() {
    const rows = captures.filter(passesFilters);
    els.captureBody.innerHTML = "";
    els.emptyCaptures.classList.toggle("show", rows.length === 0);

    for (const msg of rows) {
      const dir = (msg.direction || "rx").toLowerCase();
      const type = normalizeType(msg);
      const tr = document.createElement("tr");
      tr.className = `cap-${dir}`;
      tr.innerHTML =
        `<td class="mono">${esc(formatTs(msg.ts))}</td>` +
        `<td><span class="dir-badge dir-${dir}">${esc(dir.toUpperCase())}</span></td>` +
        `<td>${typeBadge(type)}</td>` +
        `<td class="mono val">${esc(displayValue(msg, type))}</td>` +
        `<td class="mono hex">${esc(msg.hex || "")}</td>` +
        `<td class="mono">${msg.int_value != null ? esc(msg.int_value) : "—"}</td>` +
        `<td class="mono muted">${esc(msg.addr || msg.ip || "")}</td>`;
      els.captureBody.appendChild(tr);
    }

    const wrap = els.captureBody.closest(".capture-wrap");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }

  function pushCapture(msg) {
    if (!msg || msg.type === "hello") return;
    // WS events tipados como message
    const row = {
      addr: msg.addr,
      ip: msg.ip,
      direction: msg.direction || "rx",
      text: msg.text || "",
      hex: msg.hex || "",
      value_type: msg.value_type || msg.encoding || "string",
      int_value: msg.int_value ?? null,
      ts: msg.ts || new Date().toISOString(),
    };
    captures.push(row);
    if (captures.length > 1000) captures = captures.slice(-800);
    renderCaptures();
  }

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

    // Opción "todos"
    const all = document.createElement("li");
    all.className = selected ? "" : "active";
    all.innerHTML = `<div class="ip">Todos</div><div class="meta">Ver capturas de todos los equipos</div>`;
    all.addEventListener("click", () => selectDevice(null));
    els.deviceList.appendChild(all);

    for (const d of devices) {
      const li = document.createElement("li");
      li.dataset.addr = d.addr;
      if (selected && selected.addr === d.addr) li.classList.add("active");
      li.innerHTML =
        `<div class="ip">${esc(d.ip || d.addr)}</div>` +
        `<div class="meta">${esc(d.addr)}${d.imei ? " · " + esc(d.imei) : ""} · idle ${esc(d.idle_s ?? "—")}s</div>`;
      li.addEventListener("click", () => selectDevice(d));
      els.deviceList.appendChild(li);
    }

    if (selected && !devices.some((d) => d.addr === selected.addr)) {
      selected = null;
      els.monitorTitle.textContent = "Capturas RX / TX";
      els.sendHint.textContent = "Selecciona un dispositivo para enviar.";
      renderCaptures();
    }
  }

  async function selectDevice(d) {
    selected = d ? { addr: d.addr, ip: d.ip } : null;
    els.monitorTitle.textContent = selected
      ? `Capturas · ${selected.addr}`
      : "Capturas RX / TX";
    els.sendHint.textContent = selected
      ? `Enviando a ${selected.addr}`
      : "Selecciona un dispositivo para enviar.";

    [...els.deviceList.children].forEach((li, i) => {
      if (i === 0) li.classList.toggle("active", !selected);
      else li.classList.toggle("active", selected && li.dataset.addr === selected.addr);
    });

    captures = [];
    try {
      const q = selected
        ? `addr=${encodeURIComponent(selected.addr)}&limit=300`
        : "limit=300";
      const r = await fetch(`${API}/api/messages?${q}`);
      const data = await r.json();
      captures = (data.messages || []).map((m) => ({
        ...m,
        value_type: m.value_type || m.encoding || "string",
      }));
    } catch (e) {
      console.warn(e);
    }
    renderCaptures();
  }

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
        if (msg.type === "message") pushCapture(msg);
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
    if (encoding === "int" && !/^[+-]?\d+$/.test(message.trim())) {
      els.sendHint.textContent = "Int requiere un número entero.";
      return;
    }

    try {
      const r = await fetch(`${API}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addr: selected.addr,
          message,
          encoding,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        els.sendHint.textContent = data.detail || data.error || "Error al enviar";
        return;
      }
      els.message.value = "";
      els.sendHint.textContent = `Enviado ${data.bytes} bytes (${data.value_type || encoding}) → ${data.addr}`;
    } catch (err) {
      els.sendHint.textContent = String(err);
    }
  });

  els.btnClear.addEventListener("click", () => {
    captures = [];
    renderCaptures();
  });

  els.btnSweep.addEventListener("click", async () => {
    els.sendHint.textContent = "Limpiando huérfanas…";
    try {
      const r = await fetch(`${API}/api/sweep`, { method: "POST" });
      const data = await r.json();
      els.sendHint.textContent =
        `Huérfanas: bridge=${data.bridge_removed}, db=${data.db_orphans_cleared}`;
      renderDevices(data.devices || []);
    } catch (e) {
      els.sendHint.textContent = String(e);
    }
  });

  els.filterDir.addEventListener("change", renderCaptures);
  els.filterType.addEventListener("change", renderCaptures);

  els.encoding.addEventListener("change", () => {
    els.addCrLf.disabled = els.encoding.value !== "string";
    if (els.encoding.value === "hex") {
      els.message.placeholder = "Hex… ej. 48656C6C6F";
    } else if (els.encoding.value === "int") {
      els.message.placeholder = "Entero… ej. 42";
      els.addCrLf.checked = false;
    } else {
      els.message.placeholder = "Mensaje string…";
    }
  });

  connectWs();
  loadDevices();
  selectDevice(null);
  setInterval(loadDevices, 10000);
})();
