import { useState, useRef, useEffect } from "react";

type Role = "admin" | "operator" | "readonly";
type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  units: string[];
  lastAccess: string;
  active: boolean;
  initials: string;
  notifications: { critical: boolean; co2: boolean; offline: boolean };
};

const DEMO_USERS: User[] = [
  {
    id: "u1",
    name: "Javier Garza",
    email: "jgarza@frigotrans.mx",
    role: "admin",
    units: ["Unidad 1", "Unidad 2", "Unidad 3"],
    lastAccess: "hace 2 h",
    active: true,
    initials: "JG",
    notifications: { critical: true, co2: true, offline: true },
  },
  {
    id: "u2",
    name: "María Rodríguez",
    email: "mrodriguez@frigotrans.mx",
    role: "operator",
    units: ["Unidad 1"],
    lastAccess: "hace 4 h",
    active: true,
    initials: "MR",
    notifications: { critical: true, co2: false, offline: true },
  },
  {
    id: "u3",
    name: "Carlos Mendoza",
    email: "cmendoza@frigotrans.mx",
    role: "operator",
    units: ["Unidad 2", "Unidad 3"],
    lastAccess: "hace 1 día",
    active: true,
    initials: "CM",
    notifications: { critical: true, co2: false, offline: false },
  },
  {
    id: "u4",
    name: "Laura Torres",
    email: "ltorres@frigotrans.mx",
    role: "readonly",
    units: ["Unidad 1"],
    lastAccess: "hace 3 días",
    active: true,
    initials: "LT",
    notifications: { critical: false, co2: false, offline: false },
  },
  {
    id: "u5",
    name: "Raúl Vega",
    email: "rvega@frigotrans.mx",
    role: "readonly",
    units: ["Unidad 1"],
    lastAccess: "hace 2 sem",
    active: false,
    initials: "RV",
    notifications: { critical: false, co2: false, offline: false },
  },
];

const ACTIVITY = [
  { time: "10:42", desc: "Javier Garza cambió consigna de temperatura de 24.5 a 24.0 °C" },
  { time: "10:38", desc: "Sistema: alarma de Zona 3 activada (25.4 °C)" },
  { time: "10:31", desc: "María Rodríguez encendió Contactor K2" },
  { time: "09:58", desc: "Javier Garza editó regla «Sobretemperatura zona»" },
  { time: "09:22", desc: "María Rodríguez silenció la alarma durante 10 min" },
];

const ALL_UNITS = ["Unidad 1", "Unidad 2", "Unidad 3"];

function roleLabel(role: Role) {
  if (role === "admin") return "Administrador";
  if (role === "operator") return "Operador";
  return "Solo lectura";
}

function roleDesc(role: Role) {
  if (role === "admin") return "Acceso completo, incluida configuración avanzada y gestión de usuarios.";
  if (role === "operator") return "Puede cambiar consignas y accionar contactores. Sin acceso a admin.";
  return "Solo puede ver el panel principal y el histórico.";
}

function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: "var(--nav-pill)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text)",
      }}
    >
      {initials}
    </div>
  );
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--nav-pill)",
        color: "var(--text)",
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 6,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {roleLabel(role)}
    </span>
  );
}

function InactiveChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "rgba(255,59,48,0.10)",
        color: "var(--c-red)",
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 6,
        padding: "2px 8px",
        marginLeft: 4,
        whiteSpace: "nowrap",
      }}
    >
      Inactiva
    </span>
  );
}

function IOSSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 51,
        height: 31,
        borderRadius: 15.5,
        background: value ? "var(--c-green)" : "var(--sep)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
        minWidth: 51,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: value ? 22 : 2,
          width: 27,
          height: 27,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
          transition: "left 0.2s",
          display: "block",
        }}
      />
    </button>
  );
}

type PanelFormState = {
  name: string;
  email: string;
  role: Role;
  units: string[];
  forcePasswordChange: boolean;
  notifications: { critical: boolean; co2: boolean; offline: boolean };
};

function emptyForm(): PanelFormState {
  return {
    name: "",
    email: "",
    role: "readonly",
    units: [],
    forcePasswordChange: true,
    notifications: { critical: false, co2: false, offline: false },
  };
}

function userToForm(u: User): PanelFormState {
  return {
    name: u.name,
    email: u.email,
    role: u.role,
    units: [...u.units],
    forcePasswordChange: false,
    notifications: { ...u.notifications },
  };
}

function UserPanel({
  editUser,
  isNew,
  onClose,
  onSave,
  isMobile,
}: {
  editUser: User | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (form: PanelFormState) => void;
  isMobile: boolean;
}) {
  const [form, setForm] = useState<PanelFormState>(
    editUser ? userToForm(editUser) : emptyForm()
  );

  useEffect(() => {
    setForm(editUser ? userToForm(editUser) : emptyForm());
  }, [editUser, isNew]);

  function toggleUnit(u: string) {
    setForm((f) => ({
      ...f,
      units: f.units.includes(u) ? f.units.filter((x) => x !== u) : [...f.units, u],
    }));
  }

  const roles: Role[] = ["admin", "operator", "readonly"];

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: "auto",
        maxHeight: "92dvh",
        borderRadius: "16px 16px 0 0",
        background: "var(--surface)",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        zIndex: 300,
        overflow: "hidden",
      }
    : {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        background: "var(--surface)",
        boxShadow: "-4px 0 32px rgba(0,0,0,0.14)",
        display: "flex",
        flexDirection: "column",
        zIndex: 300,
        overflow: "hidden",
      };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          zIndex: 299,
        }}
      />
      <div style={panelStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--sep)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>
            {isNew ? "Añadir cuenta" : "Editar cuenta"}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-2)",
              fontSize: 22,
              lineHeight: 1,
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--text-2)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Nombre
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre completo"
              style={{
                width: "100%",
                height: 44,
                borderRadius: 10,
                border: "1px solid var(--sep)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: 15,
                padding: "0 12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--text-2)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Correo electrónico
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="correo@empresa.com"
              style={{
                width: "100%",
                height: 44,
                borderRadius: 10,
                border: "1px solid var(--sep)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: 15,
                padding: "0 12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--text-2)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Rol
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roles.map((r) => {
                const selected = form.role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      background: selected ? "rgba(0,113,227,0.07)" : "var(--bg)",
                      border: selected ? "1.5px solid var(--accent)" : "1.5px solid var(--sep)",
                      borderLeft: selected ? "3px solid var(--accent)" : "1.5px solid var(--sep)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: "pointer",
                      textAlign: "left",
                      minHeight: 44,
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                      {roleLabel(r)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                      {roleDesc(r)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--text-2)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Unidades
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ALL_UNITS.map((u) => {
                const checked = form.units.includes(u);
                return (
                  <label
                    key={u}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      minHeight: 44,
                      padding: "0 2px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnit(u)}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent)" }}
                    />
                    <span style={{ fontSize: 14, color: "var(--text)" }}>{u}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 44,
              marginBottom: 16,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 14, color: "var(--text)", flex: 1 }}>
              Exigir cambio de contraseña en primer acceso
            </span>
            <IOSSwitch
              value={form.forcePasswordChange}
              onChange={(v) => setForm((f) => ({ ...f, forcePasswordChange: v }))}
            />
          </div>
          {!isNew && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--text-2)",
                  marginBottom: 10,
                }}
              >
                Notificaciones en el celular
              </div>
              {[
                { key: "critical" as const, label: "Temperatura crítica en zona" },
                { key: "co2" as const, label: "CO₂ por encima del límite" },
                { key: "offline" as const, label: "Pérdida de conexión con la unidad" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    minHeight: 44,
                    padding: "0 2px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.notifications[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        notifications: { ...f.notifications, [key]: e.target.checked },
                      }))
                    }
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text)" }}>{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 16px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid var(--sep)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              border: "1px solid var(--sep)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </>
  );
}

function ThreeDotsMenu({
  user,
  onEdit,
  onReset,
  onToggleActive,
}: {
  user: User;
  onEdit: () => void;
  onReset: () => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-2)",
          fontSize: 18,
          minWidth: 44,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        }}
        aria-label="Opciones"
      >
        ⋯
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            background: "var(--surface)",
            border: "1px solid var(--sep)",
            borderRadius: 10,
            boxShadow: "var(--card-shadow)",
            minWidth: 180,
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {[
            {
              label: "Editar",
              action: () => {
                setOpen(false);
                onEdit();
              },
            },
            {
              label: "Restablecer contraseña",
              action: () => {
                setOpen(false);
                onReset();
              },
            },
            {
              label: user.active ? "Desactivar" : "Activar",
              action: () => {
                setOpen(false);
                onToggleActive();
              },
            },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: "block",
                width: "100%",
                background: "none",
                border: "none",
                padding: "11px 16px",
                textAlign: "left",
                fontSize: 14,
                color: "var(--text)",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SwipeRow({
  user,
  onTap,
  onToggleActive,
  onReset,
  isLast,
}: {
  user: User;
  onTap: () => void;
  onToggleActive: () => void;
  onReset: () => void;
  isLast: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
    dragging.current = true;
    moved.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) > 4) moved.current = true;
    const next = Math.max(-140, Math.min(0, startOffset.current + dx));
    setOffset(next);
  }

  function onTouchEnd() {
    dragging.current = false;
    if (offset < -70) {
      setOffset(-140);
    } else {
      setOffset(0);
    }
  }

  function handleClick() {
    if (moved.current) {
      return;
    }
    if (offset !== 0) {
      setOffset(0);
    } else {
      onTap();
    }
  }

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          width: 140,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOffset(0);
            onToggleActive();
          }}
          style={{
            flex: 1,
            background: "var(--c-amber)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            minHeight: 44,
          }}
        >
          {user.active ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOffset(0);
            onReset();
          }}
          style={{
            flex: 1,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            minHeight: 44,
          }}
        >
          Restablecer
        </button>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? "none" : "transform 0.2s",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          minHeight: 64,
          borderBottom: isLast ? "none" : "1px solid var(--sep)",
          cursor: "pointer",
          opacity: user.active ? 1 : 0.5,
        }}
      >
        <Avatar initials={user.initials} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user.email}
          </div>
        </div>
        <RoleChip role={user.role} />
      </div>
    </div>
  );
}

export default function Administracion() {
  const [users, setUsers] = useState<User[]>(DEMO_USERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function openAdd() {
    setEditingUser(null);
    setIsNew(true);
    setPanelOpen(true);
  }

  function openEdit(u: User) {
    setEditingUser(u);
    setIsNew(false);
    setPanelOpen(true);
  }

  function handleSave(form: PanelFormState) {
    if (isNew) {
      const newUser: User = {
        id: `u${Date.now()}`,
        name: form.name,
        email: form.email,
        role: form.role,
        units: form.units,
        lastAccess: "Nunca",
        active: true,
        initials: form.name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0] || "")
          .join("")
          .toUpperCase(),
        notifications: form.notifications,
      };
      setUsers((u) => [...u, newUser]);
    } else if (editingUser) {
      setUsers((us) =>
        us.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: form.name,
                email: form.email,
                role: form.role,
                units: form.units,
                notifications: form.notifications,
                initials: form.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0] || "")
                  .join("")
                  .toUpperCase(),
              }
            : u
        )
      );
    }
    setPanelOpen(false);
  }

  function toggleActive(id: string) {
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-2)",
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 14,
    border: "1px solid var(--sep)",
    backgroundColor: "var(--surface)",
    boxShadow: "var(--shadow)",
    overflow: "hidden",
  };

  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100dvh",
        fontFamily: "Inter, system-ui, sans-serif",
        paddingBottom: isMobile
          ? "calc(env(safe-area-inset-bottom, 0px) + 49px + 12px + 52px + 12px)"
          : 32,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: isMobile ? "20px 16px 16px" : "28px 24px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: isMobile ? 20 : 24,
                fontWeight: 700,
                color: "var(--text)",
                margin: 0,
              }}
            >
              Administración
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "4px 0 0" }}>
              Gestión de usuarios y accesos
            </p>
          </div>
          {!isMobile && (
            <button
              onClick={openAdd}
              style={{
                height: 44,
                padding: "0 18px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Añadir cuenta
            </button>
          )}
        </div>

        {isMobile ? (
          <div style={cardStyle}>
            {users.map((user, i) => (
              <SwipeRow
                key={user.id}
                user={user}
                onTap={() => openEdit(user)}
                onToggleActive={() => toggleActive(user.id)}
                onReset={() => {}}
                isLast={i === users.length - 1}
              />
            ))}
          </div>
        ) : (
          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--sep)" }}>
                  {["Usuario", "Rol", "Unidades", "Último acceso", ""].map((col) => (
                    <th
                      key={col}
                      style={{
                        ...sectionLabel,
                        padding: "12px 16px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: i < users.length - 1 ? "1px solid var(--sep)" : "none",
                      opacity: user.active ? 1 : 0.5,
                    }}
                  >
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar initials={user.initials} size={36} />
                        <div>
                          <div
                            style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}
                          >
                            {user.name}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <RoleChip role={user.role} />
                        {!user.active && <InactiveChip />}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        color: "var(--text-2)",
                        maxWidth: 200,
                      }}
                    >
                      {user.units.join(", ")}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        color: "var(--text-2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.lastAccess}
                    </td>
                    <td style={{ padding: "10px 8px 10px 0", textAlign: "right" }}>
                      <ThreeDotsMenu
                        user={user}
                        onEdit={() => openEdit(user)}
                        onReset={() => {}}
                        onToggleActive={() => toggleActive(user.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={sectionLabel}>Actividad reciente</span>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--accent)",
                padding: 0,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
              }}
            >
              Ver todo
            </button>
          </div>
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--sep)",
              boxShadow: "var(--shadow)",
              overflow: "hidden",
            }}
          >
            {ACTIVITY.map((ev, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "11px 16px",
                  borderBottom: i < ACTIVITY.length - 1 ? "1px solid var(--sep)" : "none",
                  minHeight: 44,
                }}
              >
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 12,
                    color: "var(--text-2)",
                    minWidth: 72,
                    flexShrink: 0,
                  }}
                >
                  {ev.time}
                </span>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{ev.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isMobile && (
        <button
          onClick={openAdd}
          aria-label="Añadir cuenta"
          style={{
            position: "fixed",
            right: 16,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 49px + 12px)",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,113,227,0.35)",
            zIndex: 100,
          }}
        >
          +
        </button>
      )}

      {panelOpen && (
        <UserPanel
          editUser={editingUser}
          isNew={isNew}
          onClose={() => setPanelOpen(false)}
          onSave={handleSave}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
