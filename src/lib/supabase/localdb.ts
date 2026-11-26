// Cliente local exclusivo para entorno demo (NEXT_PUBLIC_DEMO_MODE=true).
// No contiene credenciales reales ni debe usarse en produccion.

const DB_KEY = "arriendaya_demo_db";
const SESSION_KEY = "arriendaya_demo_session";
const STORAGE_KEY = "arriendaya_demo_storage";

type DemoRow = Record<string, unknown>;
type DemoUser = {
  id: string;
  email: string;
  password: string;
  user_metadata: Record<string, unknown>;
};

type DemoDb = {
  users: DemoUser[];
  profiles: DemoRow[];
  properties: DemoRow[];
  property_images: DemoRow[];
  rental_requests: DemoRow[];
  request_documents: DemoRow[];
  contracts: DemoRow[];
  notifications: DemoRow[];
  saved_properties: DemoRow[];
  saved_lists: DemoRow[];
  saved_list_items: DemoRow[];
  payments: DemoRow[];
  expenses: DemoRow[];
  visits: DemoRow[];
  reservations: DemoRow[];
  calendar_events: DemoRow[];
  conversations: DemoRow[];
  messages: DemoRow[];
  quick_replies: DemoRow[];
  activity_log: DemoRow[];
  owner_verifications: DemoRow[];
  reports: DemoRow[];
  reviews: DemoRow[];
  request_notes: DemoRow[];
  owner_invitations: DemoRow[];
  property_views: DemoRow[];
  [key: string]: DemoRow[] | DemoUser[];
};

let _dbCache: DemoDb | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _storageCache: Record<string, string> | null = null;
let _storageTimer: ReturnType<typeof setTimeout> | null = null;

function emptyDb(): DemoDb {
  return {
    users: [],
    profiles: [],
    properties: [],
    property_images: [],
    rental_requests: [],
    request_documents: [],
    contracts: [],
    notifications: [],
    saved_properties: [],
    saved_lists: [],
    saved_list_items: [],
    payments: [],
    expenses: [],
    visits: [],
    reservations: [],
    calendar_events: [],
    conversations: [],
    messages: [],
    quick_replies: [],
    activity_log: [],
    owner_verifications: [],
    reports: [],
    reviews: [],
    request_notes: [],
    owner_invitations: [],
    property_views: [],
  };
}

function uid() {
  return "demo-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function scheduleSave(db: DemoDb) {
  _dbCache = db;
  if (typeof window === "undefined") return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(_dbCache));
    } catch {}
    _saveTimer = null;
  }, 150);
}

function seedDb(db: DemoDb): DemoDb {
  const now = new Date().toISOString();
  const demoUsers: Array<{ id: string; email: string; name: string; role: "owner" | "tenant" | "admin"; pass: string }> = [
    { id: "demo-owner-1", email: "demo.propietario@arriendaya.test", name: "Propietario Demo", role: "owner", pass: "DemoOwner!2026" },
    { id: "demo-tenant-1", email: "demo.inquilino@arriendaya.test", name: "Inquilino Demo", role: "tenant", pass: "DemoTenant!2026" },
    { id: "demo-admin-1", email: "demo.admin@arriendaya.test", name: "Admin Demo", role: "admin", pass: "DemoAdmin!2026" },
  ];

  for (const u of demoUsers) {
    db.users.push({
      id: u.id,
      email: u.email,
      password: u.pass,
      user_metadata: { full_name: u.name, phone: "3000000000", accepted_terms: true },
    });
    db.profiles.push({
      id: u.id,
      email: u.email,
      full_name: u.name,
      phone: "3000000000",
      role: u.role,
      avatar_url: null,
      accepted_terms: true,
      created_at: now,
      updated_at: now,
    });
    if (u.role === "owner") {
      db.owner_invitations.push({ email: u.email, invited_by: null, created_at: now, used_at: now });
    }
  }

  const examples: Array<DemoRow & { img: string }> = [
    {
      id: "ex-1",
      name: "Apartamento Vista Verde",
      type: "Apartamento",
      max_people: 4,
      area_sqm: 65,
      location: "Medellín, El Poblado",
      address: "Medellín, El Poblado",
      latitude: 6.2088,
      longitude: -75.5748,
      description: "2 habitaciones, 2 baños, balcón, cocina integral.",
      rental_type: "vivienda",
      max_rental_days: 365,
      price: 1800000,
      price_period: "mes",
      contact_phone: "3000000101",
      contact_email: "demo.propietario@arriendaya.test",
      contact_social: "@arriendaya",
      discount_percent: 15,
      discount_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: "published",
      owner_id: "demo-owner-1",
      img: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
      includes_administration: true,
      administration_fee: 350000,
      parking: 1,
      floor_area: 65,
      condition: "usada",
      stratum: 5,
      nearby_centers: "Centro Comercial Santafé",
      available_from: now.slice(0, 10),
      requires_cosigner: true,
      deposit_months: 1,
      renter_type: "dueño directo",
      renter_name: "Propietario Demo",
      furnished: "amoblado",
      pets_allowed: false,
      for_new: false,
      video_url: "",
      whatsapp_contact: "573000000101",
    },
    {
      id: "ex-2",
      name: "Cabaña El Bosque",
      type: "Cabaña",
      max_people: 6,
      area_sqm: 120,
      location: "Guatapé, Antioquia",
      address: "Guatapé, Antioquia",
      latitude: 6.2333,
      longitude: -75.1667,
      description: "3 habitaciones, chimenea, vista al lago, BBQ.",
      rental_type: "recreativo",
      max_rental_days: 7,
      price: 350000,
      price_period: "dia",
      contact_phone: "3000000102",
      contact_email: "demo.propietario@arriendaya.test",
      contact_social: "@cabanaelbosque",
      discount_percent: 0,
      discount_until: null,
      status: "published",
      owner_id: "demo-owner-1",
      img: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800",
      includes_administration: false,
      parking: 2,
      condition: "nueva",
      stratum: 3,
      available_from: now.slice(0, 10),
      renter_type: "inmobiliaria",
      renter_name: "Inmobiliaria Demo",
      furnished: "sin amoblar",
      pets_allowed: true,
      for_new: true,
      whatsapp_contact: "573000000102",
    },
    {
      id: "ex-3",
      name: "Estudio Moderno Centro",
      type: "Estudio",
      max_people: 2,
      area_sqm: 40,
      location: "Bogotá, Chapinero",
      address: "Bogotá, Chapinero",
      latitude: 4.6486,
      longitude: -74.0628,
      description: "1 habitación, 1 baño, amoblado, cerca al transporte.",
      rental_type: "vivienda",
      max_rental_days: 180,
      price: 1200000,
      price_period: "mes",
      contact_phone: "3000000103",
      contact_email: "demo.propietario@arriendaya.test",
      contact_social: "",
      discount_percent: 10,
      discount_until: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: "published",
      owner_id: "demo-owner-1",
      img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
      includes_administration: true,
      administration_fee: 200000,
      parking: 0,
      condition: "usada",
      stratum: 4,
      available_from: now.slice(0, 10),
      renter_type: "dueño directo",
      renter_name: "Propietario Demo",
      furnished: "amoblado",
      pets_allowed: false,
      whatsapp_contact: "573000000103",
    },
  ];

  for (const e of examples) {
    const { img, ...p } = e;
    db.properties.push({ ...p, created_at: now, updated_at: now });
    db.property_images.push({ id: uid(), property_id: e.id, url: img, sort_order: 0, label: "Fachada" });
  }
  return db;
}

function loadDb(): DemoDb {
  if (typeof window === "undefined") return emptyDb();
  if (_dbCache) return _dbCache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      _dbCache = JSON.parse(raw) as DemoDb;
      return _dbCache;
    }
  } catch {}
  _dbCache = seedDb(emptyDb());
  scheduleSave(_dbCache);
  return _dbCache;
}

function loadStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  if (_storageCache) return _storageCache;
  try {
    _storageCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
    return _storageCache;
  } catch {
    _storageCache = {};
    return _storageCache;
  }
}

function saveStorage(s: Record<string, string>) {
  _storageCache = s;
  if (typeof window === "undefined") return;
  if (_storageTimer) clearTimeout(_storageTimer);
  _storageTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_storageCache));
    } catch {}
    _storageTimer = null;
  }, 150);
}

type AuthListener = (event: string, session: { user: { id: string; email: string; user_metadata: Record<string, unknown> } } | null) => void;
const authListeners: AuthListener[] = [];

function notifyAuth(event: string, session: { user: { id: string; email: string; user_metadata: Record<string, unknown> } } | null) {
  for (const cb of authListeners) cb(event, session);
}

function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

function getSessionUser(db: DemoDb) {
  const id = getSessionUserId();
  if (!id) return null;
  const u = db.users.find((x) => x.id === id);
  if (!u) return null;
  return { id: u.id, email: u.email, user_metadata: u.user_metadata || {} };
}

type Filter =
  | { type: "eq" | "neq" | "gte" | "lte"; col: string; val: unknown }
  | { type: "ilike"; col: string; pattern: string }
  | { type: "in"; col: string; vals: unknown[] }
  | { type: "or"; str: string };

function matches(row: DemoRow, f: Filter): boolean {
  switch (f.type) {
    case "eq":
      return row[f.col] === f.val;
    case "neq":
      return row[f.col] !== f.val;
    case "gte":
      return String(row[f.col] ?? "") >= String(f.val ?? "");
    case "lte":
      return String(row[f.col] ?? "") <= String(f.val ?? "");
    case "ilike": {
      const pat = f.pattern.replace(/%/g, "").toLowerCase();
      return String(row[f.col] ?? "").toLowerCase().includes(pat);
    }
    case "in":
      return (f.vals || []).includes(row[f.col]);
    case "or": {
      const parts = f.str.split(",");
      return parts.some((part) => {
        const m = part.match(/^([a-zA-Z_]+)\.(eq|ilike|gte|lte)\.(.+)$/);
        if (!m) return false;
        const [, col, op, rawVal] = m;
        const val = rawVal.replace(/%/g, "");
        if (op === "ilike") return String(row[col] ?? "").toLowerCase().includes(val.toLowerCase());
        if (op === "eq") return row[col] === val;
        if (op === "gte") return String(row[col] ?? "") >= val;
        if (op === "lte") return String(row[col] ?? "") <= val;
        return false;
      });
    }
  }
}

function attach(table: string, row: DemoRow, db: DemoDb): DemoRow {
  const propImages = db.property_images as DemoRow[];
  const props = db.properties as DemoRow[];
  const profiles = db.profiles as DemoRow[];
  if (table === "properties") {
    row.property_images = propImages
      .filter((i) => i.property_id === row.id)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  }
  if (table === "rental_requests") {
    const p = props.find((x) => x.id === row.property_id) || null;
    row.property = p ? { ...p, property_images: propImages.filter((i) => i.property_id === p.id) } : null;
    row.tenant = profiles.find((x) => x.id === row.tenant_id) || null;
  }
  if (table === "contracts") {
    const p = props.find((x) => x.id === row.property_id) || null;
    row.property = p ? { ...p, property_images: propImages.filter((i) => i.property_id === p.id) } : null;
    row.tenant = profiles.find((x) => x.id === row.tenant_id) || null;
    row.owner = profiles.find((x) => x.id === row.owner_id) || null;
  }
  return row;
}

function from(table: string) {
  const state: {
    op: "select" | "insert" | "update" | "delete";
    payload: DemoRow | DemoRow[] | null;
    filters: Filter[];
    order: { col: string; asc: boolean } | null;
    limitCount: number | null;
    range: { from: number; to: number } | null;
  } = {
    op: "select",
    payload: null,
    filters: [],
    order: null,
    limitCount: null,
    range: null,
  };

  function execute(singleMode: boolean, strict: boolean): Promise<{ data: unknown; error: { message: string } | null }> {
    return new Promise((resolve) => {
      const db = loadDb();
      const sessionUser = getSessionUser(db);
      const currentProfile = sessionUser ? (db.profiles as DemoRow[]).find((p) => p.id === sessionUser.id) : null;
      const isAdmin = currentProfile?.role === "admin";
      let data: unknown = null;
      let error: { message: string } | null = null;

      try {
        const list = (db[table] as DemoRow[]) || [];
        if (state.op === "select") {
          let rows = [...list];
          for (const f of state.filters) rows = rows.filter((r) => matches(r, f));
          if (state.order) {
            const { col, asc } = state.order;
            rows.sort((a, b) => (String(a[col] ?? "") > String(b[col] ?? "") ? 1 : -1) * (asc ? 1 : -1));
          }
          rows = rows.map((r) => attach(table, { ...r }, db));
          if (state.range) {
            rows = rows.slice(state.range.from, state.range.to + 1);
          }
          if (state.limitCount !== null) {
            rows = rows.slice(0, state.limitCount);
          }
          if (singleMode) {
            if (rows.length === 0) {
              data = null;
              if (strict) error = { message: "No rows found" };
            } else {
              data = rows[0];
            }
          } else {
            data = rows;
          }
        } else if (state.op === "insert") {
          const rows = Array.isArray(state.payload) ? state.payload : [state.payload!];
          const inserted: DemoRow[] = [];
          for (const r of rows) {
            if (table === "payments") {
              const contract = (db.contracts as DemoRow[]).find((c) => c.id === r.contract_id);
              if (Number(r.amount ?? 0) <= 0) {
                throw new Error("El monto del pago debe ser mayor a cero");
              }
              if (contract && r.tenant_id !== contract.tenant_id) {
                throw new Error("El pago debe corresponder al inquilino del contrato");
              }
              if (currentProfile?.role !== "owner" && !isAdmin && r.status === "confirmado") {
                throw new Error("Solo el propietario puede confirmar pagos");
              }
            }
            if (table === "conversations" && !isAdmin && currentProfile) {
              const oId = r.owner_id;
              const tId = r.tenant_id;
              if (!oId || !tId || oId === tId || (currentProfile.id !== oId && currentProfile.id !== tId)) {
                throw new Error("No autorizado para crear esta conversacion");
              }
              const propIdsOfOwner = new Set(
                (db.properties as DemoRow[]).filter((p) => p.owner_id === oId).map((p) => p.id)
              );
              const hasRel =
                (db.rental_requests as DemoRow[]).some((rq) => propIdsOfOwner.has(rq.property_id) && rq.tenant_id === tId) ||
                (db.contracts as DemoRow[]).some((c) => c.owner_id === oId && c.tenant_id === tId) ||
                (db.visits as DemoRow[]).some((v) => propIdsOfOwner.has(v.property_id) && v.tenant_id === tId) ||
                (db.reservations as DemoRow[]).some((rs) => propIdsOfOwner.has(rs.property_id) && rs.tenant_id === tId);
              if (!hasRel) {
                throw new Error("Solo puedes iniciar conversaciones con usuarios relacionados");
              }
            }
            if (
              table === "saved_list_items" &&
              list.some((x) => x.list_id === r.list_id && x.property_id === r.property_id)
            ) {
              throw new Error("La propiedad ya está en esa lista");
            }
            const newRow: DemoRow = { ...r };
            if (!newRow.id) newRow.id = uid();
            if (!newRow.created_at) newRow.created_at = new Date().toISOString();
            if (table === "rental_requests" && !newRow.first_deadline) {
              newRow.first_deadline = new Date(Date.now() + 5 * 86400000).toISOString();
            }
            if (table === "properties" && !newRow.updated_at) newRow.updated_at = new Date().toISOString();
            list.push(newRow);
            inserted.push({ ...newRow });
          }
          db[table] = list;
          scheduleSave(db);
          data = Array.isArray(state.payload) ? inserted : inserted[0];
        } else if (state.op === "update") {
          const payload = (state.payload as DemoRow) || {};
          const targets = list.filter((r) => state.filters.every((f) => matches(r, f)));
          const updated: DemoRow[] = [];
          for (const t of targets) {
            const nextPayload: DemoRow = { ...payload };
            if (table === "profiles" && !isAdmin && nextPayload.role && nextPayload.role !== t.role) {
              throw new Error("No tienes permisos para cambiar el rol del perfil");
            }
            if (table === "contracts" && !isAdmin) {
              if (
                (nextPayload.owner_id !== undefined && nextPayload.owner_id !== t.owner_id) ||
                (nextPayload.tenant_id !== undefined && nextPayload.tenant_id !== t.tenant_id) ||
                (nextPayload.property_id !== undefined && nextPayload.property_id !== t.property_id) ||
                (nextPayload.request_id !== undefined && nextPayload.request_id !== t.request_id)
              ) {
                throw new Error("No es posible modificar las partes ni el inmueble de un contrato");
              }
              if (t.owner_signature_url && nextPayload.owner_signature_url !== undefined && nextPayload.owner_signature_url !== t.owner_signature_url) {
                throw new Error("La firma del propietario no puede modificarse");
              }
              if (t.tenant_signature_url && nextPayload.tenant_signature_url !== undefined && nextPayload.tenant_signature_url !== t.tenant_signature_url) {
                throw new Error("La firma del inquilino no puede modificarse");
              }
              if (nextPayload.owner_signature_url !== undefined && nextPayload.owner_signature_url !== t.owner_signature_url) {
                if (currentProfile && currentProfile.id !== t.owner_id) {
                  throw new Error("Solo el propietario puede registrar su firma");
                }
                if (t.status !== "pending_signatures" || !String(nextPayload.owner_signature_url || "").trim()) {
                  throw new Error("Firma del propietario invalida o contrato cerrado");
                }
              }
              if (nextPayload.tenant_signature_url !== undefined && nextPayload.tenant_signature_url !== t.tenant_signature_url) {
                if (currentProfile && currentProfile.id !== t.tenant_id) {
                  throw new Error("Solo el inquilino puede registrar su firma");
                }
                if (t.status !== "pending_signatures" || !String(nextPayload.tenant_signature_url || "").trim()) {
                  throw new Error("Firma del inquilino invalida o contrato cerrado");
                }
              }
              if (nextPayload.signed_at !== undefined && nextPayload.signed_at !== t.signed_at) {
                throw new Error("La fecha de firma se asigna automaticamente al completarse ambas firmas");
              }
              const isValidRenewal =
                (!currentProfile || currentProfile.id === t.owner_id) &&
                (t.status === "active" || t.status === "expiring") &&
                (nextPayload.status === undefined || nextPayload.status === "active" || nextPayload.status === "renewed") &&
                Boolean(nextPayload.end_date) &&
                (!t.end_date || String(nextPayload.end_date) > String(t.end_date)) &&
                nextPayload.reminder_month_sent === false &&
                nextPayload.reminder_week_sent === false;
              if (
                ((nextPayload.reminder_month_sent !== undefined && nextPayload.reminder_month_sent !== t.reminder_month_sent) ||
                  (nextPayload.reminder_week_sent !== undefined && nextPayload.reminder_week_sent !== t.reminder_week_sent)) &&
                !isValidRenewal
              ) {
                throw new Error("Los indicadores de recordatorio solo pueden gestionarse desde el servidor o al renovar");
              }
              if (t.status === "pending_signatures") {
                if (nextPayload.status !== undefined && nextPayload.status !== t.status) {
                  throw new Error("El contrato no puede cambiar de estado manualmente; se activa al completarse ambas firmas");
                }
                const hasAnySig = Boolean(t.signed_at || t.owner_signature_url || t.tenant_signature_url);
                if (hasAnySig) {
                  if (nextPayload.terms !== undefined && nextPayload.terms !== t.terms) {
                    throw new Error("No se pueden modificar los términos de un contrato firmado");
                  }
                  if (nextPayload.start_date !== undefined && nextPayload.start_date !== t.start_date) {
                    throw new Error("No se puede modificar la fecha de inicio de un contrato firmado");
                  }
                  if (nextPayload.end_date !== undefined && nextPayload.end_date !== t.end_date) {
                    throw new Error("No se puede modificar la fecha de fin de un contrato firmado");
                  }
                }
              } else {
                if (nextPayload.terms !== undefined && nextPayload.terms !== t.terms) {
                  throw new Error("No se pueden modificar los términos de un contrato firmado");
                }
                if (nextPayload.start_date !== undefined && nextPayload.start_date !== t.start_date) {
                  throw new Error("No se puede modificar la fecha de inicio de un contrato firmado");
                }
              }
            }
            if (table === "payments" && !isAdmin) {
              if (t.status === "confirmado") {
                throw new Error("Un pago confirmado no puede modificarse");
              }
              if (
                (nextPayload.contract_id !== undefined && nextPayload.contract_id !== t.contract_id) ||
                (nextPayload.tenant_id !== undefined && nextPayload.tenant_id !== t.tenant_id) ||
                (nextPayload.amount !== undefined && nextPayload.amount !== t.amount) ||
                (nextPayload.concept !== undefined && nextPayload.concept !== t.concept) ||
                (nextPayload.date !== undefined && nextPayload.date !== t.date)
              ) {
                throw new Error("No se pueden alterar el contrato, inquilino, monto, concepto o fecha de un pago existente");
              }
              if (currentProfile?.id === t.tenant_id) {
                if (nextPayload.status && nextPayload.status !== "pendiente" && nextPayload.status !== "comprobante_enviado") {
                  throw new Error("Solo el propietario puede confirmar o rechazar un pago");
                }
                if (
                  t.status === "comprobante_enviado" &&
                  ((nextPayload.status !== undefined && nextPayload.status !== "comprobante_enviado") ||
                    (nextPayload.receipt_url !== undefined && !String(nextPayload.receipt_url || "").trim()))
                ) {
                  throw new Error("No puedes eliminar el comprobante ni revertir a pendiente un pago ya enviado");
                }
                if (nextPayload.receipt_url && nextPayload.receipt_url !== t.receipt_url) {
                  nextPayload.status = "comprobante_enviado";
                }
              } else {
                if (nextPayload.receipt_url !== undefined && nextPayload.receipt_url !== t.receipt_url) {
                  throw new Error("El propietario no puede modificar el comprobante del inquilino");
                }
              }
            }
            if (table === "request_documents" && !isAdmin) {
              if (nextPayload.file_url !== undefined && !String(nextPayload.file_url || "").trim()) {
                throw new Error("La ruta del archivo es obligatoria");
              }
              if (nextPayload.request_id !== undefined && nextPayload.request_id !== t.request_id) {
                throw new Error("No se puede trasladar un documento a otra solicitud");
              }
              if (nextPayload.doc_type !== undefined && nextPayload.doc_type !== t.doc_type) {
                throw new Error("No se puede modificar el tipo de documento");
              }
              const reqRow = (db.rental_requests as DemoRow[]).find((r) => r.id === t.request_id);
              const propRow = reqRow ? (db.properties as DemoRow[]).find((p) => p.id === reqRow.property_id) : null;
              if (currentProfile && reqRow && currentProfile.id === reqRow.tenant_id) {
                if (nextPayload.file_url !== undefined && nextPayload.file_url !== t.file_url) {
                  if (t.status !== "pendiente" && t.status !== "rechazado") {
                    throw new Error("Solo puedes reemplazar documentos pendientes o rechazados");
                  }
                  if (reqRow.status !== "first_accepted" && reqRow.status !== "returned") {
                    throw new Error("La solicitud no permite reemplazar documentos en su estado actual");
                  }
                  nextPayload.status = "pendiente";
                  nextPayload.uploaded_at = new Date().toISOString();
                } else if (nextPayload.status !== undefined && nextPayload.status !== t.status) {
                  throw new Error("El inquilino no puede modificar el estado de aprobacion");
                }
              } else if (currentProfile && propRow && currentProfile.id === propRow.owner_id) {
                if (nextPayload.file_url !== undefined && nextPayload.file_url !== t.file_url) {
                  throw new Error("El propietario no puede reemplazar el archivo del inquilino");
                }
              }
            }
            const wasPending = t.status === "pending_signatures";
            Object.assign(t, nextPayload);
            if (table === "contracts" && wasPending && t.owner_signature_url && t.tenant_signature_url) {
              t.status = "active";
              t.signed_at = new Date().toISOString();
            }
            if (t.updated_at !== undefined) t.updated_at = new Date().toISOString();
            updated.push({ ...t });
          }
          scheduleSave(db);
          data = updated.length === 1 && !Array.isArray(state.payload) ? updated[0] : updated;
          if (updated.length === 0) data = null;
        } else if (state.op === "delete") {
          db[table] = list.filter((r) => !state.filters.every((f) => matches(r, f)));
          scheduleSave(db);
          data = null;
        }
      } catch (e) {
        error = { message: e instanceof Error ? e.message : "Error local" };
      }
      resolve({ data, error });
    });
  }

  const builder = {
    select: () => builder,
    insert: (row: DemoRow | DemoRow[]) => {
      state.op = "insert";
      state.payload = row;
      return builder;
    },
    update: (row: DemoRow) => {
      state.op = "update";
      state.payload = row;
      return builder;
    },
    delete: () => {
      state.op = "delete";
      return builder;
    },
    eq: (col: string, val: unknown) => {
      state.filters.push({ type: "eq", col, val });
      return builder;
    },
    neq: (col: string, val: unknown) => {
      state.filters.push({ type: "neq", col, val });
      return builder;
    },
    gte: (col: string, val: unknown) => {
      state.filters.push({ type: "gte", col, val });
      return builder;
    },
    lte: (col: string, val: unknown) => {
      state.filters.push({ type: "lte", col, val });
      return builder;
    },
    ilike: (col: string, pattern: string) => {
      state.filters.push({ type: "ilike", col, pattern });
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      state.filters.push({ type: "in", col, vals });
      return builder;
    },
    or: (str: string) => {
      state.filters.push({ type: "or", str });
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      state.order = { col, asc: opts?.ascending !== false };
      return builder;
    },
    limit: (n: number) => {
      state.limitCount = n;
      return builder;
    },
    range: (fromIdx: number, toIdx: number) => {
      state.range = { from: fromIdx, to: toIdx };
      return builder;
    },
    maybeSingle: () => execute(true, false),
    single: () => execute(true, true),
    then: <TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => execute(false, false).then(onfulfilled, onrejected),
  };

  return builder;
}

const auth = {
  async getUser() {
    const db = loadDb();
    const user = getSessionUser(db);
    return { data: { user }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const db = loadDb();
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
    localStorage.setItem(SESSION_KEY, u.id);
    const sessionUser = { id: u.id, email: u.email, user_metadata: u.user_metadata };
    notifyAuth("SIGNED_IN", { user: sessionUser });
    return { data: { user: sessionUser, session: { user: sessionUser } }, error: null };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    const db = loadDb();
    if (db.users.find((x) => x.email.toLowerCase() === email.toLowerCase())) {
      return { data: { user: null, session: null }, error: { message: "User already registered" } };
    }
    const id = uid();
    const meta = options?.data || {};
    db.users.push({ id, email, password, user_metadata: meta });
    const invited = (db.owner_invitations as DemoRow[]).some(
      (o) => String(o.email ?? "").toLowerCase() === email.toLowerCase() && !o.used_at
    );
    const role = invited ? "owner" : "tenant";
    const now = new Date().toISOString();
    db.profiles.push({
      id,
      email,
      full_name: meta.full_name || "",
      phone: meta.phone || null,
      role,
      avatar_url: null,
      accepted_terms: Boolean(meta.accepted_terms),
      created_at: now,
      updated_at: now,
    });
    scheduleSave(db);
    localStorage.setItem(SESSION_KEY, id);
    const sessionUser = { id, email, user_metadata: meta };
    notifyAuth("SIGNED_IN", { user: sessionUser });
    return { data: { user: sessionUser, session: { user: sessionUser } }, error: null };
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    notifyAuth("SIGNED_OUT", null);
    return { error: null };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },
  async updateUser({ password }: { password?: string }) {
    const db = loadDb();
    const id = getSessionUserId();
    const u = db.users.find((x) => x.id === id);
    if (!u) return { data: { user: null }, error: { message: "No authenticated user" } };
    if (password) u.password = password;
    scheduleSave(db);
    return { data: { user: { id: u.id, email: u.email, user_metadata: u.user_metadata } }, error: null };
  },
  async exchangeCodeForSession() {
    return { data: { user: null, session: null }, error: null };
  },
  onAuthStateChange(cb: AuthListener) {
    authListeners.push(cb);
    setTimeout(() => {
      const db = loadDb();
      const user = getSessionUser(db);
      cb("INITIAL_SESSION", user ? { user } : null);
    }, 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = authListeners.indexOf(cb);
            if (i >= 0) authListeners.splice(i, 1);
          },
        },
      },
    };
  },
};

const storage = {
  from() {
    return {
      async upload(path: string, file: Blob) {
        return new Promise<{ data: { path: string } | null; error: { message: string } | null }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = loadStorage();
            s[path] = String(reader.result || "");
            saveStorage(s);
            resolve({ data: { path }, error: null });
          };
          reader.onerror = () => resolve({ data: null, error: { message: "Upload failed" } });
          reader.readAsDataURL(file);
        });
      },
      getPublicUrl(path: string) {
        const s = loadStorage();
        return { data: { publicUrl: s[path] || path } };
      },
      async createSignedUrl(path: string) {
        const s = loadStorage();
        return { data: { signedUrl: s[path] || path }, error: null };
      },
    };
  },
};

export function createClient() {
  loadDb();
  return { from, auth, storage };
}

export function createBrowserClient() {
  return createClient();
}
