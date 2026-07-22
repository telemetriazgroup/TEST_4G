(() => {
  // Por defecto mismo origen (nginx proxy /api y /ws). Override con meta api-base.
  const meta = document.querySelector('meta[name="api-base"]');
  const API = (meta && meta.content) || location.origin;

  const els = {
    wsDot: document.getElementById("wsDot"),
    wsLabel: document.getElementById("wsLabel"),
    deviceList: document.getElementById("deviceList"),
    emptyDevices: document.getElementById("emptyDevices"),
    devCount: document.getElementById("devCount"),
    term: document.getElementById("term"),
    monitorTitle: document.getElementById("monitorTitle"),
    sendForm: document.getElementById("sendForm"),
    message: document.getElementById("message"),
    encoding: document.getElementById("encoding"),
    addCrLf: document.getElementById("addCrLf"),
    sendHint: document.getElementById("sendHint"),
    btnClear: document.getElementById("btnClear"),
    btnSweep: document.getElementById("btnSweep"),
  };

  let selected = null; // { addr, ip }
  let viewMode = "both"; // both | text | hex
  let ws;

  function setWsState(ok) {
    els.wsDot.classList.toggle("on", ok);
    els.wsDot.classList.toggle("off", !ok);
    els.wsLabel.textContent = ok ? "WS conectado" : "WS desconectado";
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatTs(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("es-PE", { hour12: false }) +
        "." + String(d.getMilliseconds()).padStart(3, "0");
    } catch {
      return ts || "";
    }
  }

  function appendLine(msg) {
    if (selected && msg.addr && msg.addr !== selected.addr) return;

    const dir = (msg.direction || "rx").toLowerCase();
    const line = document.createElement("div");
    line.className = `line ${dir}`;

    const textPart = `<span class="payload text-part">${esc(msg.text || "")}</span>`;
    const hexPart = `<span class="hex-part"> [${esc(msg.hex || "")}]</span>`;

    let payload = "";
    if (viewMode === "text") payload = textPart;
    else if (viewMode === "hex") payload = `<span class="hex-part">${esc(msg.hex || "")}</span>`;
    else payload = textPart + hexPart;

    line.innerHTML =
      `<span class="ts">${esc(formatTs(msg.ts))}</span> ` +
      `<span class="dir">${dir.toUpperCase()}</span> ` +
      payload;

    // Aplicar visibilidad de segmentos
    if (viewMode === "text") line.querySelectorAll(".hex-part").forEach((n) => n.classList.add("hidden-view"));
    if (viewMode === "hex") line.querySelectorAll(".text-part").forEach((n) => n.classList.add("hidden-view"));

    els.term.appendChild(line);
    els.term.scrollTop = els.term.scrollHeight;
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

    // Si el seleccionado ya no está, limpiar selección
    if (selected && !devices.some((d) => d.addr === selected.addr)) {
      selected = null;
      els.monitorTitle.textContent = "Terminal";
      els.sendHint.textContent = "Selecciona un dispositivo para enviar.";
    }
  }

  async function selectDevice(d) {
    selected = { addr: d.addr, ip: d.ip };
    els.monitorTitle.textContent = `Terminal · ${d.addr}`;
    els.sendHint.textContent = `Enviando a ${d.addr}`;
    [...els.deviceList.children].forEach((li) => {
      li.classList.toggle("active", li.dataset.addr === d.addr);
    });
    els.term.innerHTML = "";
    try {
      const r = await fetch(`${API}/api/messages?addr=${encodeURIComponent(d.addr)}&limit=300`);
      const data = await r.json();
      for (const m of data.messages || []) appendLine(m);
    } catch (e) {
      console.warn(e);
    }
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
        if (msg.type === "message") appendLine(msg);
        if (msg.type === "connect" || msg.type === "disconnect" || msg.type === "disconnect_all" || msg.type === "sweep") {
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
      els.sendHint.textContent = `Enviado ${data.bytes} bytes → ${data.addr}`;
    } catch (err) {
      els.sendHint.textContent = String(err);
    }
  });

  els.btnClear.addEventListener("click", () => {
    els.term.innerHTML = "";
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

  document.querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      viewMode = btn.dataset.view;
      // Re-aplicar a líneas existentes
      els.term.querySelectorAll(".line").forEach((line) => {
        const text = line.querySelector(".text-part");
        const hex = line.querySelector(".hex-part");
        if (viewMode === "both") {
          text && text.classList.remove("hidden-view");
          hex && hex.classList.remove("hidden-view");
        } else if (viewMode === "text") {
          text && text.classList.remove("hidden-view");
          hex && hex.classList.add("hidden-view");
        } else {
          text && text.classList.add("hidden-view");
          hex && hex.classList.remove("hidden-view");
        }
      });
    });
  });

  connectWs();
  loadDevices();
  setInterval(loadDevices, 10000);
})();
