// @ts-nocheck
// Local, offline Supabase-compatible client backed by localStorage.

const DB_KEY = "arriendaya_db";
const SESSION_KEY = "arriendaya_session";
const STORAGE_KEY = "arriendaya_storage";

const OWNER_EMAILS = [
  "lina.torres@gmail.com",
  "alejandro.henao@gmail.com",
  "cristian.camilo@gmail.com",
  "amy.vargas@gmail.com",
];

function isOwnerEmail(email) {
  return OWNER_EMAILS.includes((email || "").toLowerCase());
}

let _dbCache: any = null;
let _saveTimer: any = null;

function loadDb() {
  if (typeof window === "undefined") return emptyDb();
  if (_dbCache) return _dbCache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      _dbCache = JSON.parse(raw);
      for (const p of _dbCache.properties || []) {
        if (p.address === undefined) p.address = p.location || null;
        if (p.latitude === undefined) p.latitude = null;
        if (p.longitude === undefined) p.longitude = null;
      }
      return _dbCache;
    }
  } catch {}
  _dbCache = seedDb(emptyDb());
  scheduleSave(_dbCache);
  return _dbCache;
}

function scheduleSave(db: any) {
  _dbCache = db;
  if (typeof window === "undefined") return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(_dbCache)); } catch {}
    _saveTimer = null;
  }, 300);
}

function saveDb(db: any) {
  scheduleSave(db);
}

function emptyDb() {
  return { users: [], profiles: [], properties: [], property_images: [], rental_requests: [], request_documents: [], contracts: [], notifications: [], saved_properties: [], saved_lists: [], payments: [], visits: [], reservations: [], calendar_events: [], conversations: [], messages: [], quick_replies: [], activity_log: [], reports: [], reviews: [], request_notes: [], owner_invitations: [] };
}

let _storageCache: any = null;
let _storageTimer: any = null;
function loadStorage() {
  if (typeof window === "undefined") return {};
  if (_storageCache) return _storageCache;
  try {
    _storageCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return _storageCache;
  } catch {
    _storageCache = {};
    return _storageCache;
  }
}
function saveStorage(s: any) {
  _storageCache = s;
  if (typeof window === "undefined") return;
  if (_storageTimer) clearTimeout(_storageTimer);
  _storageTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_storageCache)); } catch {}
    _storageTimer = null;
  }, 300);
}

function uid() {
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function seedDb(db) {
  for (const email of ["lina.torres@gmail.com", "alejandro.henao@gmail.com", "cristian.camilo@gmail.com", "amy.vargas@gmail.com"]) {
    const id = "owner-" + email.split("@")[0].replace(/\./g, "-");
    db.owner_invitations.push({ email, invited_by: null, created_at: new Date().toISOString() });
    db.users.push({ id, email, password: "Propietario1234", user_metadata: { full_name: "Propietario", phone: "3000000000", accepted_terms: true } });
    db.profiles.push({ id, email, full_name: "Propietario", phone: "3000000000", role: "owner", avatar_url: null, accepted_terms: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  const examples = [
    { id: "ex-1", name: "Apartamento Vista Verde", type: "Apartamento", max_people: 4, area_sqm: 65, location: "Medellín, El Poblado", address: "Medellín, El Poblado", latitude: 6.2088, longitude: -75.5748, description: "2 habitaciones, 2 baños, balcón, cocina integral.", rental_type: "vivienda", max_rental_days: 365, price: 1800000, price_period: "mes", contact_phone: "3001234567", contact_email: "lina.torres@gmail.com", contact_social: "@arriendaya", discount_percent: 15, discount_until: new Date(Date.now() + 7 * 86400000).toISOString(), status: "published", owner_id: "owner-lina-torres", img: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", includes_administration: true, administration_fee: 350000, parking: 1, floor_area: 65, condition: "usada", stratum: 5, nearby_centers: "Centro Comercial Santafé", available_from: new Date().toISOString().slice(0, 10), requires_cosigner: true, deposit_months: 1, renter_type: "dueño directo", renter_name: "Lina Torres", renter_photo_url: "https://i.pravatar.cc/100?img=1", furnished: "amoblado", pets_allowed: false, for_new: false, video_url: "", reviews: [{ author: "Carlos", rating: 5, comment: "Excelente apartamento, muy bien ubicado.", date: new Date().toISOString() }], whatsapp_contact: "573001234567" },
    { id: "ex-2", name: "Cabaña El Bosque", type: "Cabaña", max_people: 6, area_sqm: 120, location: "Guatapé, Antioquia", address: "Guatapé, Antioquia", latitude: 6.2333, longitude: -75.1667, description: "3 habitaciones, chimenea, vista al lago, BBQ.", rental_type: "recreativo", max_rental_days: 7, price: 350000, price_period: "dia", contact_phone: "3109876543", contact_email: "amy.vargas@gmail.com", contact_social: "@cabanaelbosque", discount_percent: 0, discount_until: null, status: "published", owner_id: "owner-amy-vargas", img: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800", includes_administration: false, parking: 2, condition: "nueva", stratum: 3, available_from: new Date().toISOString().slice(0, 10), renter_type: "inmobiliaria", renter_name: "Amy Vargas Inmobiliaria", furnished: "sin amoblar", pets_allowed: true, for_new: true, reviews: [{ author: "Ana", rating: 4, comment: "Hermosa cabaña, ideal para descansar.", date: new Date().toISOString() }], whatsapp_contact: "573109876543" },
    { id: "ex-3", name: "Estudio Moderno Centro", type: "Estudio", max_people: 2, area_sqm: 40, location: "Bogotá, Chapinero", address: "Bogotá, Chapinero", latitude: 4.6486, longitude: -74.0628, description: "1 habitación, 1 baño, amoblado, cerca al transporte.", rental_type: "vivienda", max_rental_days: 180, price: 1200000, price_period: "mes", contact_phone: "3204567890", contact_email: "cristian.camilo@gmail.com", contact_social: "", discount_percent: 10, discount_until: new Date(Date.now() + 3 * 86400000).toISOString(), status: "published", owner_id: "owner-cristian-camilo", img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", includes_administration: true, administration_fee: 200000, parking: 0, condition: "usada", stratum: 4, available_from: new Date().toISOString().slice(0, 10), renter_type: "dueño directo", renter_name: "Cristian Camilo", furnished: "amoblado", pets_allowed: false, whatsapp_contact: "573204567890" },
  ];
  for (const e of examples) {
    const { img, ...p } = e;
    db.properties.push({ ...p, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    db.property_images.push({ id: uid(), property_id: e.id, url: img, sort_order: 0, label: "Fachada" });
  }
  return db;
}

const authListeners: any[] = [];
function notifyAuth(event, session) {
  for (const cb of authListeners) cb(event, session);
}
function getSessionUserId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}
function getSessionUser(db) {
  const id = getSessionUserId();
  if (!id) return null;
  const u = db.users.find((x) => x.id === id);
  if (!u) return null;
  return { id: u.id, email: u.email, user_metadata: u.user_metadata || {} };
}

function from(table): any {
  const state: any = { op: "select", payload: null, filters: [], order: null, select: "*", range: null };
  const builder: any = {};
  const addFilter = (f) => state.filters.push(f);
  builder.select = (cols) => { state.select = cols || "*"; return builder; };
  builder.insert = (row) => { state.op = "insert"; state.payload = row; return builder; };
  builder.update = (row) => { state.op = "update"; state.payload = row; return builder; };
  builder.delete = () => { state.op = "delete"; return builder; };
  builder.eq = (col, val) => { addFilter({ type: "eq", col, val }); return builder; };
  builder.neq = (col, val) => { addFilter({ type: "neq", col, val }); return builder; };
  builder.gte = (col, val) => { addFilter({ type: "gte", col, val }); return builder; };
  builder.lte = (col, val) => { addFilter({ type: "lte", col, val }); return builder; };
  builder.ilike = (col, pattern) => { addFilter({ type: "ilike", col, pattern }); return builder; };
  builder.in = (col, vals) => { addFilter({ type: "in", col, vals }); return builder; };
  builder.or = (str) => { addFilter({ type: "or", str }); return builder; };
  builder.order = (col, opts) => { state.order = { col, asc: opts?.ascending !== false }; return builder; };
  builder.range = (from, to) => { state.range = { from, to }; return builder; };
  builder.maybeSingle = () => execute(true, true);
  builder.single = () => execute(true, false);

  function matches(row, f) {
    switch (f.type) {
      case "eq": return row[f.col] === f.val;
      case "neq": return row[f.col] !== f.val;
      case "gte": return row[f.col] >= f.val;
      case "lte": return row[f.col] <= f.val;
      case "ilike": { const pat = String(f.pattern).replace(/%/g, "").toLowerCase(); return String(row[f.col] || "").toLowerCase().includes(pat); }
      case "in": return (f.vals || []).includes(row[f.col]);
      case "or": {
        const parts = f.str.split(",");
        return parts.some((part) => {
          const m = part.match(/^([a-zA-Z_]+)\.(eq|ilike|gte|lte)\.(.+)$/);
          if (!m) return false;
          const [, col, op, rawVal] = m;
          const val = rawVal.replace(/%/g, "");
          if (op === "ilike") return String(row[col] || "").toLowerCase().includes(val.toLowerCase());
          if (op === "eq") return row[col] === val;
          if (op === "gte") return row[col] >= val;
          if (op === "lte") return row[col] <= val;
          return false;
        });
      }
      default: return true;
    }
  }

  function attach(row, db) {
    if (table === "properties") {
      row.property_images = db.property_images.filter((i) => i.property_id === row.id).sort((a, b) => a.sort_order - b.sort_order);
    }
    if (table === "rental_requests") {
      row.property = db.properties.find((p) => p.id === row.property_id) || null;
      if (row.property) row.property.property_images = db.property_images.filter((i) => i.property_id === row.property.id);
      row.tenant = db.profiles.find((p) => p.id === row.tenant_id) || null;
    }
    if (table === "contracts") {
      row.property = db.properties.find((p) => p.id === row.property_id) || null;
      if (row.property) row.property.property_images = db.property_images.filter((i) => i.property_id === row.property.id);
      row.tenant = db.profiles.find((p) => p.id === row.tenant_id) || null;
      row.owner = db.profiles.find((p) => p.id === row.owner_id) || null;
    }
    return row;
  }

  function execute(singleMode, strict) {
    return new Promise((resolve) => {
      const db = loadDb();
      let data = null;
      let error = null;
      try {
        if (state.op === "select") {
          let rows = [...(db[table] || [])];
          for (const f of state.filters) rows = rows.filter((r) => matches(r, f));
          if (state.order) {
            const { col, asc } = state.order;
            rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
          }
          rows = rows.map((r) => attach({ ...r }, db));
          if (state.range) {
            const { from, to } = state.range;
            rows = rows.slice(from, to + 1);
          }
          if (singleMode) {
            if (rows.length === 0) { data = null; if (strict) error = { message: "No rows found" }; }
            else data = rows[0];
          } else data = rows;
        } else if (state.op === "insert") {
          const rows = Array.isArray(state.payload) ? state.payload : [state.payload];
          const inserted = [];
          for (const r of rows) {
            const newRow = { ...r };
            if (!newRow.id) newRow.id = uid();
            if (table === "properties") {
              if (!newRow.created_at) newRow.created_at = new Date().toISOString();
              if (!newRow.updated_at) newRow.updated_at = new Date().toISOString();
            }
            db[table].push(newRow);
            inserted.push({ ...newRow });
          }
          saveDb(db);
          data = Array.isArray(state.payload) ? inserted : inserted[0];
        } else if (state.op === "update") {
          const targets = (db[table] || []).filter((r) => state.filters.every((f) => matches(r, f)));
          const updated = [];
          for (const t of targets) {
            Object.assign(t, state.payload);
            if (t.updated_at !== undefined) t.updated_at = new Date().toISOString();
            updated.push({ ...t });
          }
          saveDb(db);
          data = updated.length === 1 && !Array.isArray(state.payload) ? updated[0] : updated;
          if (updated.length === 0) data = null;
        } else if (state.op === "delete") {
          db[table] = (db[table] || []).filter((r) => !state.filters.every((f) => matches(r, f)));
          saveDb(db);
          data = null;
        }
      } catch (e) {
        error = { message: (e as any).message };
      }
      resolve({ data, error });
    });
  }

  builder.then = (resolve, reject) => execute(false, false).then(resolve, reject);
  return builder;
}

const auth = {
  async getUser() {
    const db = loadDb();
    const user = getSessionUser(db);
    return { data: { user } };
  },
  async signInWithPassword({ email, password }) {
    const db = loadDb();
    const u = db.users.find((x) => x.email === email && x.password === password);
    if (!u) return { error: { message: "Invalid login credentials" } };
    localStorage.setItem(SESSION_KEY, u.id);
    notifyAuth("SIGNED_IN", { user: { id: u.id, email: u.email, user_metadata: u.user_metadata } });
    return { error: null };
  },
  async signUp({ email, password, options }) {
    const db = loadDb();
    if (db.users.find((x) => x.email === email)) return { error: { message: "User already registered" } };
    const id = uid();
    const meta = options?.data || {};
    db.users.push({ id, email, password, user_metadata: meta });
    const db2 = loadDb();
    const role = (db2.owner_invitations || []).some((o: any) => o.email?.toLowerCase() === email.toLowerCase()) ? "owner" : "tenant";
    db.profiles.push({ id, email, full_name: meta.full_name || "", phone: meta.phone || null, role, avatar_url: null, accepted_terms: meta.accepted_terms || false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    saveDb(db);
    localStorage.setItem(SESSION_KEY, id);
    notifyAuth("SIGNED_IN", { user: { id, email, user_metadata: meta } });
    return { error: null };
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    notifyAuth("SIGNED_OUT", null);
    return { error: null };
  },
  onAuthStateChange(cb) {
    authListeners.push(cb);
    setTimeout(() => {
      const db = loadDb();
      const user = getSessionUser(db);
      cb("INITIAL_SESSION", user ? { user } : null);
    }, 0);
    return { data: { subscription: { unsubscribe: () => { const i = authListeners.indexOf(cb); if (i >= 0) authListeners.splice(i, 1); } } } };
  },
};

const storage = {
  from(bucket) {
    return {
      async upload(path, file) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = loadStorage();
            s[path] = reader.result;
            saveStorage(s);
            resolve({ error: null });
          };
          reader.onerror = () => resolve({ error: { message: "Upload failed" } });
          if (file instanceof Blob) reader.readAsDataURL(file);
          else resolve({ error: { message: "Invalid file" } });
        });
      },
      getPublicUrl(path) {
        const s = loadStorage();
        const url = s[path] || path;
        return { data: { publicUrl: url } };
      },
      async createSignedUrl(path) {
        const s = loadStorage();
        const url = s[path] || path;
        return { data: { signedUrl: url } };
      },
    };
  },
};

export function createClient(): any {
  loadDb();
  return { from, auth, storage };
}
export function createBrowserClient() { return createClient(); }
export const createServerClient = () => createClient();
