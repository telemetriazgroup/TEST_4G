import { useState } from "react";

interface OutputRow {
  out: string;
  fn: string;
  error: string | null;
}

interface ConditionRow {
  variable: string;
  operator: string;
  value: string;
  unit: string;
}

interface ActionRow {
  output: string;
  mode: "activar" | "desactivar";
}

interface Rule {
  id: number;
  name: string;
  enabled: boolean;
  conditions: ConditionRow[];
  joins: ("Y" | "O")[];
  duration: string;
  durationUnit: "s" | "min";
  actions: ActionRow[];
  lastTrigger: string;
}

interface EditorState {
  id: number | null;
  name: string;
  conditions: ConditionRow[];
  joins: ("Y" | "O")[];
  duration: string;
  durationUnit: "s" | "min";
  actions: ActionRow[];
  hysteresis: string;
  hysteresisUnit: string;
}

const ALL_FNS = [
  "Sin asignar",
  "Electroválvula de agua",
  "Electroválvula de aire",
  "Ventila abrir",
  "Ventila cerrar",
  "Compuerta abrir",
  "Compuerta cerrar",
  "Acceso de aire abrir",
  "Acceso de aire cerrar",
];

const GROUP1 = ["Electroválvula de agua", "Electroválvula de aire"];
const GROUP2 = ["Ventila abrir", "Ventila cerrar", "Compuerta abrir", "Compuerta cerrar", "Acceso de aire abrir", "Acceso de aire cerrar"];

const VARIABLES = [
  "Temperatura suministro", "Temperatura retorno", "Setpoint",
  "Zona 1", "Zona 2", "Zona 3", "Zona 4",
  "Humedad", "CO₂", "Ventilación", "Vel. motores",
  "K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9", "K10",
];

const OPERATORS = ["mayor que", "menor que", "igual a", "distinto de", "entre"];

const OP_SYMBOLS: Record<string, string> = {
  "mayor que": ">", "menor que": "<", "igual a": "=", "distinto de": "≠", "entre": "entre",
};

const OUTPUT_OPTIONS = [
  "Ventila abrir", "Ventila cerrar", "Compuerta abrir", "Compuerta cerrar",
  "Acceso de aire abrir", "Acceso de aire cerrar", "Electroválvula de agua", "Electroválvula de aire",
];

const INIT_OUTPUTS: OutputRow[] = [
  { out: "OUT1", fn: "Electroválvula de agua", error: null },
  { out: "OUT2", fn: "Electroválvula de aire", error: null },
  { out: "OUT3", fn: "Ventila abrir", error: null },
  { out: "OUT4", fn: "Ventila cerrar", error: null },
  { out: "OUT5", fn: "Compuerta abrir", error: null },
  { out: "OUT6", fn: "Compuerta cerrar", error: null },
  { out: "OUT7", fn: "Acceso de aire abrir", error: null },
  { out: "OUT8", fn: "Acceso de aire cerrar", error: null },
  { out: "OUT9", fn: "Sin asignar", error: null },
  { out: "OUT10", fn: "Sin asignar", error: null },
];

const INIT_RULES: Rule[] = [
  {
    id: 1, name: "Renovación por CO₂", enabled: true, lastTrigger: "hace 25 min",
    conditions: [{ variable: "CO₂", operator: "mayor que", value: "2800", unit: "ppm" }],
    joins: [], duration: "3", durationUnit: "min",
    actions: [{ output: "Ventila abrir", mode: "activar" }],
  },
  {
    id: 2, name: "Sobretemperatura zona", enabled: true, lastTrigger: "hace 6 min",
    conditions: [{ variable: "Zona 3", operator: "mayor que", value: "25.5", unit: "°C" }],
    joins: [], duration: "2", durationUnit: "min",
    actions: [{ output: "Acceso de aire abrir", mode: "activar" }],
  },
  {
    id: 3, name: "Refuerzo de humedad", enabled: false, lastTrigger: "nunca",
    conditions: [
      { variable: "Humedad", operator: "menor que", value: "50", unit: "%" },
      { variable: "Temperatura retorno", operator: "mayor que", value: "26", unit: "°C" },
    ],
    joins: ["Y"], duration: "0", durationUnit: "s",
    actions: [{ output: "Electroválvula de agua", mode: "activar" }],
  },
];

function newEditor(rule?: Rule): EditorState {
  if (rule) {
    return {
      id: rule.id,
      name: rule.name,
      conditions: rule.conditions.map(c => ({ ...c })),
      joins: [...rule.joins],
      duration: rule.duration,
      durationUnit: rule.durationUnit,
      actions: rule.actions.map(a => ({ ...a })),
      hysteresis: "0",
      hysteresisUnit: "%",
    };
  }
  return {
    id: null, name: "", conditions: [{ variable: "CO₂", operator: "mayor que", value: "", unit: "ppm" }],
    joins: [], duration: "0", durationUnit: "min",
    actions: [{ output: "Ventila abrir", mode: "activar" }],
    hysteresis: "0", hysteresisUnit: "%",
  };
}

function buildPreview(s: EditorState): string {
  if (s.conditions.length === 0) return "Define condiciones para ver la vista previa.";
  const condStr = s.conditions.map((c, i) => {
    const op = OP_SYMBOLS[c.operator] ?? c.operator;
    const prefix = i === 0 ? "Si " : ` ${s.joins[i - 1]} `;
    return `${prefix}${c.variable} ${op} ${c.value}${c.unit ? " " + c.unit : ""}`;
  }).join("");
  const dur = s.duration && s.duration !== "0"
    ? ` durante ${s.duration} ${s.durationUnit}`
    : "";
  const acts = s.actions.length > 0
    ? `, entonces ${s.actions.map(a => `${a.mode} ${a.output}`).join(", ")}`
    : "";
  return condStr + dur + acts + ".";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2"
      style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-2)" }}
    >
      {children}
    </div>
  );
}

function IOSSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 51, height: 31, borderRadius: 31, padding: 0, border: "none", flexShrink: 0,
        backgroundColor: on ? "var(--c-green)" : "var(--sep)",
        position: "relative", transition: "background-color 0.18s", cursor: "pointer",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 22 : 2,
        width: 27, height: 27, borderRadius: "50%", display: "block",
        backgroundColor: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.25)", transition: "left 0.18s",
      }} />
    </button>
  );
}

function DragHandle() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="none" style={{ color: "var(--sep)", flexShrink: 0 }}>
      {[0, 6, 12].map(y => (
        <g key={y}>
          <circle cx="3" cy={y + 3} r="1.5" fill="currentColor" />
          <circle cx="9" cy={y + 3} r="1.5" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function ConditionDisplay({ conditions, joins, duration, durationUnit }: {
  conditions: ConditionRow[];
  joins: ("Y" | "O")[];
  duration: string;
  durationUnit: string;
}) {
  return (
    <span style={{ fontSize: 13, color: "var(--text-2)" }}>
      {conditions.map((c, i) => (
        <span key={i}>
          {i === 0 ? "Si " : <span style={{ fontWeight: 500 }}> {joins[i - 1]} </span>}
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{c.variable}</span>
          {" "}{OP_SYMBOLS[c.operator] ?? c.operator}{" "}{c.value} {c.unit}
        </span>
      ))}
      {duration && duration !== "0" && (
        <span> durante <span style={{ fontWeight: 600, color: "var(--text)" }}>{duration} {durationUnit}</span></span>
      )}
    </span>
  );
}

function ActuatorDiagram({ outputs }: { outputs: OutputRow[] }) {
  const assigned = new Set(outputs.filter(o => o.fn !== "Sin asignar").map(o => o.fn));
  const has = (fns: string[]) => fns.some(f => assigned.has(f));

  const sp = (fns: string[]) => ({
    stroke: has(fns) ? "#1D1D1F" : "#C0C0C5",
    strokeWidth: has(fns) ? 1.5 : 1,
    strokeDasharray: has(fns) ? undefined : "4 3",
  });
  const tc = (fns: string[]) => has(fns) ? "#1D1D1F" : "#8E8E93";

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox="0 0 320 140" width="100%" style={{ maxHeight: 180, minWidth: 260 }}>
        <rect x="10" y="15" width="300" height="110" rx="8" fill="none" stroke="#1D1D1F" strokeWidth="1.5" />
        <rect x="10" y="15" width="46" height="110" rx="8" fill="none" stroke="#D2D2D7" strokeWidth="0.5" />
        <line x1="10" y1="40" x2="56" y2="40" stroke="#D2D2D7" strokeWidth="0.5" />
        <line x1="10" y1="90" x2="56" y2="90" stroke="#D2D2D7" strokeWidth="0.5" />
        <text x="33" y="72" textAnchor="middle" fontSize="8" fill="#8E8E93" fontFamily="Inter,sans-serif">CAB</text>
        <line x1="56" y1="15" x2="56" y2="125" stroke="#D2D2D7" strokeWidth="0.8" />
        <line x1="56" y1="70" x2="310" y2="70" stroke="#E5E5EA" strokeWidth="0.5" strokeDasharray="4 3" />
        <line x1="183" y1="15" x2="183" y2="125" stroke="#E5E5EA" strokeWidth="0.5" strokeDasharray="4 3" />

        <rect x="160" y="7" width="46" height="13" rx="3" fill="none" {...sp(["Ventila abrir", "Ventila cerrar"])} />
        <text x="183" y="17" textAnchor="middle" fontSize="8" fill={tc(["Ventila abrir", "Ventila cerrar"])} fontFamily="Inter,sans-serif">Ventila</text>

        <rect x="299" y="42" width="12" height="36" rx="3" fill="none" {...sp(["Compuerta abrir", "Compuerta cerrar"])} />
        <text x="295" y="57" textAnchor="end" fontSize="8" fill={tc(["Compuerta abrir", "Compuerta cerrar"])} fontFamily="Inter,sans-serif">Comp.</text>
        <text x="295" y="67" textAnchor="end" fontSize="8" fill={tc(["Compuerta abrir", "Compuerta cerrar"])} fontFamily="Inter,sans-serif">puerta</text>

        <rect x="56" y="42" width="12" height="36" rx="3" fill="none" {...sp(["Acceso de aire abrir", "Acceso de aire cerrar"])} />
        <text x="72" y="55" textAnchor="start" fontSize="8" fill={tc(["Acceso de aire abrir", "Acceso de aire cerrar"])} fontFamily="Inter,sans-serif">Acceso</text>
        <text x="72" y="65" textAnchor="start" fontSize="8" fill={tc(["Acceso de aire abrir", "Acceso de aire cerrar"])} fontFamily="Inter,sans-serif">de aire</text>

        <rect x="96" y="100" width="44" height="16" rx="3" fill="none" {...sp(["Electroválvula de agua"])} />
        <text x="118" y="111" textAnchor="middle" fontSize="8" fill={tc(["Electroválvula de agua"])} fontFamily="Inter,sans-serif">EV agua</text>

        <rect x="168" y="100" width="44" height="16" rx="3" fill="none" {...sp(["Electroválvula de aire"])} />
        <text x="190" y="111" textAnchor="middle" fontSize="8" fill={tc(["Electroválvula de aire"])} fontFamily="Inter,sans-serif">EV aire</text>
      </svg>
    </div>
  );
}

function RuleEditorPanel({ editor, setEditor, onSave, onCancel }: {
  editor: EditorState;
  setEditor: (s: EditorState) => void;
  onSave: (s: EditorState) => void;
  onCancel: () => void;
}) {
  const setField = <K extends keyof EditorState>(k: K, v: EditorState[K]) =>
    setEditor({ ...editor, [k]: v });

  const setCond = (i: number, updates: Partial<ConditionRow>) =>
    setEditor({ ...editor, conditions: editor.conditions.map((c, j) => j === i ? { ...c, ...updates } : c) });

  const addCond = () =>
    setEditor({
      ...editor,
      conditions: [...editor.conditions, { variable: "CO₂", operator: "mayor que", value: "", unit: "ppm" }],
      joins: [...editor.joins, "Y"],
    });

  const removeCond = (i: number) => {
    const conds = editor.conditions.filter((_, j) => j !== i);
    const joins = editor.joins.filter((_, j) => j !== (i === 0 ? 0 : i - 1));
    setEditor({ ...editor, conditions: conds, joins: joins.slice(0, conds.length - 1) });
  };

  const setAction = (i: number, updates: Partial<ActionRow>) =>
    setEditor({ ...editor, actions: editor.actions.map((a, j) => j === i ? { ...a, ...updates } : a) });

  const addAction = () =>
    setEditor({ ...editor, actions: [...editor.actions, { output: "Ventila abrir", mode: "activar" }] });

  const removeAction = (i: number) =>
    setEditor({ ...editor, actions: editor.actions.filter((_, j) => j !== i) });

  const selectSt = {
    borderColor: "var(--sep)", backgroundColor: "var(--surface)",
    color: "var(--text)", borderRadius: 8, padding: "4px 6px", fontSize: 13,
    border: "1px solid var(--sep)",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--sep)" }}>
        <span className="font-semibold text-[17px] flex-1" style={{ color: "var(--text)" }}>
          {editor.id === null ? "Nueva regla" : "Editar regla"}
        </span>
        <button onClick={onCancel} style={{ color: "var(--accent)", fontWeight: 500, fontSize: 15, minHeight: 44, minWidth: 44 }}>Cancelar</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>NOMBRE</div>
          <input
            type="text"
            value={editor.name}
            onChange={e => setField("name", e.target.value)}
            placeholder="Nombre de la regla"
            className="w-full rounded-xl border px-3 py-2 font-medium text-[15px]"
            style={{ borderColor: "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>SI</div>
          <div className="flex flex-col gap-2">
            {editor.conditions.map((cond, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex gap-1 mb-2">
                    {(["Y", "O"] as const).map(op => (
                      <button
                        key={op}
                        onClick={() => setEditor({ ...editor, joins: editor.joins.map((j, k) => k === i - 1 ? op : j) })}
                        className="px-3 py-1 rounded-full text-sm font-semibold min-h-[32px]"
                        style={{
                          backgroundColor: editor.joins[i - 1] === op ? "var(--accent)" : "var(--nav-pill)",
                          color: editor.joins[i - 1] === op ? "white" : "var(--text-2)",
                        }}
                      >{op}</button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <select value={cond.variable} onChange={e => setCond(i, { variable: e.target.value })} style={selectSt}>
                    {VARIABLES.map(v => <option key={v}>{v}</option>)}
                  </select>
                  <select value={cond.operator} onChange={e => setCond(i, { operator: e.target.value })} style={selectSt}>
                    {OPERATORS.map(op => <option key={op}>{op}</option>)}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={cond.value}
                    onChange={e => setCond(i, { value: e.target.value })}
                    placeholder="Valor"
                    className="rounded-lg border text-center font-semibold"
                    style={{ width: 72, height: 32, ...selectSt }}
                  />
                  <input
                    type="text"
                    value={cond.unit}
                    onChange={e => setCond(i, { unit: e.target.value })}
                    placeholder="ud."
                    className="rounded-lg border text-center"
                    style={{ width: 52, height: 32, ...selectSt }}
                  />
                  {editor.conditions.length > 1 && (
                    <button
                      onClick={() => removeCond(i)}
                      className="flex items-center justify-center rounded-full min-h-[32px] min-w-[32px]"
                      style={{ backgroundColor: "var(--nav-pill)", color: "var(--c-red)", fontSize: 18, fontWeight: 700 }}
                    >×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addCond}
            className="mt-2 text-sm font-medium min-h-[36px]"
            style={{ color: "var(--accent)" }}
          >+ Añadir condición</button>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>DURANTE</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={editor.duration}
              onChange={e => setField("duration", e.target.value)}
              className="rounded-xl border text-center font-semibold"
              style={{ width: 80, height: 40, borderColor: "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)", fontSize: 15 }}
            />
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--sep)" }}>
              {(["s", "min"] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setField("durationUnit", u)}
                  className="px-3 font-semibold text-sm min-h-[40px]"
                  style={{
                    backgroundColor: editor.durationUnit === u ? "var(--accent)" : "var(--surface)",
                    color: editor.durationUnit === u ? "white" : "var(--text-2)",
                  }}
                >{u}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>ENTONCES</div>
          <div className="flex flex-col gap-2">
            {editor.actions.map((act, i) => (
              <div key={i} className="flex flex-wrap gap-1.5 items-center">
                <select value={act.output} onChange={e => setAction(i, { output: e.target.value })} style={selectSt}>
                  {OUTPUT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <select value={act.mode} onChange={e => setAction(i, { mode: e.target.value as "activar" | "desactivar" })} style={selectSt}>
                  <option value="activar">Activar</option>
                  <option value="desactivar">Desactivar</option>
                </select>
                {editor.actions.length > 1 && (
                  <button
                    onClick={() => removeAction(i)}
                    className="flex items-center justify-center rounded-full min-h-[32px] min-w-[32px]"
                    style={{ backgroundColor: "var(--nav-pill)", color: "var(--c-red)", fontSize: 18, fontWeight: 700 }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addAction}
            className="mt-2 text-sm font-medium min-h-[36px]"
            style={{ color: "var(--accent)" }}
          >+ Añadir acción</button>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>HISTÉRESIS</div>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              inputMode="decimal"
              value={editor.hysteresis}
              onChange={e => setField("hysteresis", e.target.value)}
              className="rounded-xl border text-center font-semibold"
              style={{ width: 80, height: 40, borderColor: "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)", fontSize: 15 }}
            />
            <input
              type="text"
              value={editor.hysteresisUnit}
              onChange={e => setField("hysteresisUnit", e.target.value)}
              className="rounded-xl border text-center"
              style={{ width: 52, height: 40, borderColor: "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)", fontSize: 14 }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            Margen antes de volver a evaluar la condición tras activarse.
          </div>
        </div>

        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: "var(--nav-pill)", borderRadius: 12 }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>VISTA PREVIA</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{buildPreview(editor)}</p>
        </div>
      </div>

      <div
        className="px-5 py-3 flex gap-2"
        style={{ borderTop: "1px solid var(--sep)" }}
      >
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl font-semibold text-sm min-h-[44px]"
          style={{ backgroundColor: "var(--nav-pill)", color: "var(--text)" }}
        >Cancelar</button>
        <button
          onClick={() => onSave(editor)}
          className="flex-1 rounded-xl font-semibold text-sm min-h-[44px] text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >Guardar regla</button>
      </div>
    </div>
  );
}

export default function ConfiguracionAvanzada({ onBack }: { onBack: () => void }) {
  const [evAire, setEvAire] = useState(30);
  const [evAgua, setEvAgua] = useState(15);
  const [outputs, setOutputs] = useState<OutputRow[]>(INIT_OUTPUTS.map(o => ({ ...o })));
  const [rules, setRules] = useState<Rule[]>(INIT_RULES.map(r => ({ ...r, conditions: r.conditions.map(c => ({ ...c })), joins: [...r.joins], actions: r.actions.map(a => ({ ...a })) })));
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [mobileSelectIdx, setMobileSelectIdx] = useState<number | null>(null);
  const [applyFeedback, setApplyFeedback] = useState(false);
  const [appliedEv, setAppliedEv] = useState({ aire: 30, agua: 15 });
  const [appliedOutputs] = useState<OutputRow[]>(INIT_OUTPUTS.map(o => ({ ...o })));
  const [appliedRules] = useState<Rule[]>(INIT_RULES.map(r => ({ ...r })));

  const isEvDirty = evAire !== appliedEv.aire || evAgua !== appliedEv.agua;
  const isOutputsDirty = outputs.some((o, i) => o.fn !== appliedOutputs[i].fn);
  const isRulesDirty = rules.length !== appliedRules.length || rules.some((r, i) => r.enabled !== appliedRules[i]?.enabled || r.name !== appliedRules[i]?.name);
  const anyDirty = isEvDirty || isOutputsDirty || isRulesDirty;

  const handleApply = () => {
    setAppliedEv({ aire: evAire, agua: evAgua });
    setApplyFeedback(true);
    setTimeout(() => setApplyFeedback(false), 2000);
  };

  const handleDiscard = () => {
    setEvAire(appliedEv.aire);
    setEvAgua(appliedEv.agua);
    setOutputs(appliedOutputs.map(o => ({ ...o })));
    setRules(appliedRules.map(r => ({ ...r, conditions: r.conditions.map(c => ({ ...c })), joins: [...r.joins], actions: r.actions.map(a => ({ ...a })) })));
  };

  const getConflict = (idx: number, fn: string) => {
    if (fn === "Sin asignar") return null;
    const conflict = outputs.find((o, i) => i !== idx && o.fn === fn);
    return conflict ? conflict.out : null;
  };

  const handleOutputChange = (idx: number, fn: string) => {
    const conflict = getConflict(idx, fn);
    setOutputs(prev => prev.map((o, i) => i === idx
      ? { ...o, fn, error: conflict ? `Libera primero ${conflict}` : null }
      : o
    ));
    if (!conflict) {
      setOutputs(prev => prev.map((o, i) => i === idx ? { ...o, fn, error: null } : o));
    }
  };

  const handleSaveRule = (s: EditorState) => {
    if (s.id !== null) {
      setRules(prev => prev.map(r => r.id === s.id ? { ...r, name: s.name, conditions: s.conditions, joins: s.joins, duration: s.duration, durationUnit: s.durationUnit, actions: s.actions } : r));
    } else {
      const newId = Math.max(0, ...rules.map(r => r.id)) + 1;
      setRules(prev => [...prev, { id: newId, name: s.name || "Nueva regla", enabled: true, conditions: s.conditions, joins: s.joins, duration: s.duration, durationUnit: s.durationUnit, actions: s.actions, lastTrigger: "nunca" }]);
    }
    setEditor(null);
  };

  const inputSt: React.CSSProperties = {
    borderColor: "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)",
    borderRadius: 10, height: 40, fontSize: 15, textAlign: "center", fontWeight: 600,
    border: "1px solid var(--sep)", width: 72, padding: "0 8px",
  };

  const isActive = (out: string) => out === "OUT1" || out === "OUT2";

  return (
    <div
      style={{ backgroundColor: "var(--bg)", minHeight: "100vh" }}
      className={anyDirty ? "pb-[120px] md:pb-[88px]" : "pb-4"}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="max-w-[900px] mx-auto px-4 pt-4">

        <div className="flex items-center gap-1 mb-3" style={{ fontSize: 14 }}>
          <button onClick={onBack} className="min-h-[44px] font-medium" style={{ color: "var(--accent)" }}>Configuración</button>
          <span style={{ color: "var(--text-2)" }}>›</span>
          <span style={{ color: "var(--text)" }} className="font-medium">Avanzada</span>
        </div>

        <div
          className="rounded-[10px] p-3 mb-4"
          style={{ backgroundColor: "#FFF8E6", color: "#8A6100" }}
        >
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>
            Atención: los cambios en esta sección modifican el comportamiento físico del equipo con carga viva a bordo.
          </p>
        </div>

        <SectionLabel>Tiempos de electroválvula</SectionLabel>
        <div
          className="rounded-[14px] border mb-6"
          style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
        >
          {[
            { label: "Electroválvula de aire", value: evAire, set: setEvAire, listId: "ticks-aire" },
            { label: "Electroválvula de agua", value: evAgua, set: setEvAgua, listId: "ticks-agua" },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className="px-4 md:px-5 py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--sep)" : undefined }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-medium text-[15px] flex-1 min-w-[140px]" style={{ color: "var(--text)" }}>{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.value}
                    min={0}
                    max={900}
                    onChange={e => { const v = Math.max(0, Math.min(900, parseInt(e.target.value) || 0)); row.set(v); }}
                    style={inputSt}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>s</span>
                </div>
                <div className="w-full md:w-auto md:flex-1 min-w-[140px]">
                  <div className="slider-touch">
                    <input
                      type="range"
                      className="w-full"
                      min={0}
                      max={900}
                      step={1}
                      value={row.value}
                      onChange={e => row.set(Number(e.target.value))}
                      list={row.listId}
                    />
                    <datalist id={row.listId}>
                      <option value="0" /><option value="300" /><option value="600" /><option value="900" />
                    </datalist>
                  </div>
                  <div className="flex justify-between mt-0.5" style={{ fontSize: 10, color: "var(--text-2)" }}>
                    <span>0</span><span>300</span><span>600</span><span>900 s</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SectionLabel>Asignación de salidas</SectionLabel>
        <div
          className="rounded-[14px] border mb-4 hidden md:block"
          style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
        >
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sep)" }}>
                {["Salida", "Función asignada", "Estado actual"].map(h => (
                  <th key={h} className="px-4 py-2 text-left" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outputs.map((row, i) => (
                <tr key={row.out} style={{ borderBottom: i < outputs.length - 1 ? "1px solid var(--sep)" : undefined }}>
                  <td className="px-4 py-3 font-semibold text-[14px]" style={{ color: "var(--text)", width: 72 }}>{row.out}</td>
                  <td className="px-4 py-3">
                    <div>
                      <select
                        value={row.fn}
                        onChange={e => handleOutputChange(i, e.target.value)}
                        className="rounded-lg border"
                        style={{ borderColor: row.error ? "var(--c-red)" : "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)", fontSize: 14, padding: "4px 6px" }}
                      >
                        <option value="Sin asignar">Sin asignar</option>
                        <optgroup label="Electroválvulas">
                          {GROUP1.map(fn => {
                            const conflict = getConflict(i, fn);
                            return (
                              <option key={fn} value={fn} disabled={!!conflict && row.fn !== fn}>
                                {fn}{conflict && row.fn !== fn ? ` (en ${conflict})` : ""}
                              </option>
                            );
                          })}
                        </optgroup>
                        <optgroup label="Actuadores">
                          {GROUP2.map(fn => {
                            const conflict = getConflict(i, fn);
                            return (
                              <option key={fn} value={fn} disabled={!!conflict && row.fn !== fn}>
                                {fn}{conflict && row.fn !== fn ? ` (en ${conflict})` : ""}
                              </option>
                            );
                          })}
                        </optgroup>
                      </select>
                      {row.error && <div style={{ fontSize: 12, color: "var(--c-red)", marginTop: 2 }}>{row.error}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", backgroundColor: isActive(row.out) && row.fn !== "Sin asignar" ? "var(--c-green)" : "var(--c-gray)", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                        {isActive(row.out) && row.fn !== "Sin asignar" ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden flex flex-col gap-2 mb-4">
          {outputs.map((row, i) => (
            <div
              key={row.out}
              className="rounded-[14px] border px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
            >
              <div className="flex-1">
                <div className="font-bold text-[15px]" style={{ color: "var(--text)" }}>{row.out}</div>
                <div className="text-sm" style={{ color: row.fn === "Sin asignar" ? "var(--text-2)" : "var(--text)" }}>
                  {row.fn}
                </div>
              </div>
              <button
                onClick={() => setMobileSelectIdx(i)}
                className="flex items-center gap-1 min-h-[44px] min-w-[44px] justify-end"
                style={{ color: "var(--accent)" }}
              >
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                  <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-2)", marginBottom: 8 }}>
            Diagrama de actuadores
          </div>
          <div
            className="rounded-[14px] border px-3 py-3"
            style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
          >
            <ActuatorDiagram outputs={outputs} />
            <div className="flex gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5">
                <span style={{ width: 20, height: 1.5, display: "inline-block", backgroundColor: "#1D1D1F" }} />
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>Asignado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ width: 20, height: 1, display: "inline-block", borderTop: "1px dashed #8E8E93" }} />
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>Sin asignar</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Reglas de funcionamiento</SectionLabel>
          <button
            onClick={() => setEditor(newEditor())}
            className="text-sm font-semibold min-h-[36px] px-3 rounded-xl"
            style={{ backgroundColor: "var(--accent)", color: "white", marginBottom: 8 }}
          >
            Nueva regla
          </button>
        </div>

        {rules.length === 0 ? (
          <div
            className="rounded-[14px] border px-4 py-10 flex flex-col items-center gap-3"
            style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
          >
            <p className="text-[15px]" style={{ color: "var(--text-2)" }}>No hay reglas configuradas.</p>
            <button
              onClick={() => setEditor(newEditor())}
              className="rounded-xl font-semibold text-sm min-h-[44px] px-5 text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >Crear la primera regla</button>
          </div>
        ) : (
          <>
            <div
              className="rounded-[14px] border hidden md:block"
              style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
            >
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sep)" }}>
                    <th style={{ width: 24 }} />
                    {["", "Nombre", "Condición", "Acción", "Última vez"].map((h, j) => (
                      <th key={j} className="px-3 py-2 text-left" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, i) => (
                    <tr
                      key={rule.id}
                      className="cursor-pointer hover:bg-[color:var(--nav-pill)]"
                      onClick={() => setEditor(newEditor(rule))}
                      style={{ borderBottom: i < rules.length - 1 ? "1px solid var(--sep)" : undefined, transition: "background 0.1s" }}
                    >
                      <td className="pl-3 pr-1 py-3">
                        <DragHandle />
                      </td>
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        <IOSSwitch
                          on={rule.enabled}
                          onClick={() => setRules(prev => prev.map((r, j) => j === i ? { ...r, enabled: !r.enabled } : r))}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-[14px]" style={{ color: "var(--text)" }}>{rule.name}</span>
                      </td>
                      <td className="px-3 py-3">
                        <ConditionDisplay conditions={rule.conditions} joins={rule.joins} duration={rule.duration} durationUnit={rule.durationUnit} />
                      </td>
                      <td className="px-3 py-3">
                        <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                          {rule.actions.map(a => `${a.mode === "activar" ? "Activar" : "Desactivar"} ${a.output}`).join(", ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span style={{ fontSize: 12, color: "var(--text-2)" }}>{rule.lastTrigger}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex flex-col gap-2">
              {rules.map((rule, i) => (
                <div
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditor(newEditor(rule))}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditor(newEditor(rule)) }}
                  className="rounded-[14px] border px-4 py-3 cursor-pointer"
                  style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>{rule.name}</span>
                    <div onClick={e => { e.stopPropagation(); setRules(prev => prev.map((r, j) => j === i ? { ...r, enabled: !r.enabled } : r)); }}>
                      <IOSSwitch on={rule.enabled} onClick={() => {}} />
                    </div>
                  </div>
                  <ConditionDisplay conditions={rule.conditions} joins={rule.joins} duration={rule.duration} durationUnit={rule.durationUnit} />
                  <div className="mt-1" style={{ fontSize: 12, color: "var(--text-2)" }}>Última vez: {rule.lastTrigger}</div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {mobileSelectIdx !== null && (
        <>
          <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setMobileSelectIdx(null)} />
          <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: "var(--bg)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--sep)", backgroundColor: "var(--surface)" }}>
              <button onClick={() => setMobileSelectIdx(null)} style={{ color: "var(--accent)", fontWeight: 500, fontSize: 16, minHeight: 44, minWidth: 44 }}>‹ Volver</button>
              <span className="font-semibold text-[17px] flex-1 text-center" style={{ color: "var(--text)" }}>
                {outputs[mobileSelectIdx].out} — Función
              </span>
              <div style={{ width: 44 }} />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
              {ALL_FNS.map(fn => {
                const takenBy = outputs.find((o, j) => j !== mobileSelectIdx && o.fn === fn);
                const isCurrent = outputs[mobileSelectIdx].fn === fn;
                return (
                  <button
                    key={fn}
                    onClick={() => {
                      if (!takenBy || isCurrent) {
                        handleOutputChange(mobileSelectIdx, fn);
                        setMobileSelectIdx(null);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 min-h-[44px]"
                    style={{
                      backgroundColor: isCurrent ? "var(--accent)" : "var(--surface)",
                      opacity: takenBy && !isCurrent ? 0.45 : 1,
                    }}
                  >
                    <span className="font-medium text-[15px]" style={{ color: isCurrent ? "white" : "var(--text)" }}>{fn}</span>
                    {takenBy && !isCurrent && (
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>en {takenBy.out}</span>
                    )}
                    {isCurrent && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><path d="M3 8l4 4 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {editor !== null && (
        <>
          <div className="fixed inset-0 z-40 hidden md:block" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setEditor(null)} />
          <div
            className="fixed inset-y-0 right-0 z-50 hidden md:flex flex-col overflow-hidden"
            style={{ width: 520, backgroundColor: "var(--surface)", borderLeft: "1px solid var(--sep)", boxShadow: "-4px 0 32px rgba(0,0,0,0.12)" }}
          >
            <RuleEditorPanel editor={editor} setEditor={setEditor} onSave={handleSaveRule} onCancel={() => setEditor(null)} />
          </div>
          <div className="fixed inset-0 z-40 md:hidden" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setEditor(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col rounded-t-[20px] overflow-hidden"
            style={{ maxHeight: "92vh", backgroundColor: "var(--surface)", boxShadow: "0 -4px 32px rgba(0,0,0,0.15)" }}
          >
            <RuleEditorPanel editor={editor} setEditor={setEditor} onSave={handleSaveRule} onCancel={() => setEditor(null)} />
          </div>
        </>
      )}

      {anyDirty && editor === null && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 confirm-bar"
          style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", backgroundColor: "var(--surface-blur)", borderTop: "1px solid var(--sep)" }}
        >
          <div className="max-w-[900px] mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center gap-2">
            <span className="text-[13px]" style={{ color: "var(--text-2)" }}>Cambios sin guardar</span>
            <div className="flex gap-2 md:ml-auto">
              <button
                onClick={handleDiscard}
                className="flex-1 md:flex-none rounded-xl font-semibold text-sm min-h-[44px] px-4"
                style={{ backgroundColor: "var(--nav-pill)", color: "var(--text)" }}
              >Descartar</button>
              <button
                onClick={handleApply}
                className="flex-1 md:flex-none rounded-xl font-semibold text-sm min-h-[44px] px-4 text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {applyFeedback ? "Cambios aplicados" : "Aplicar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
