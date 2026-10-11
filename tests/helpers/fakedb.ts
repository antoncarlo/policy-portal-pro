/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias -- test double: mirrors the loosely typed Supabase query builder */
// In-memory stand-in for the Supabase client: just the query-builder surface the server code uses,
// plus the unique indexes and the status-change trigger that matter to the workflow.
type Row = Record<string, any>;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  objects: Record<string, Map<string, { bytes: Buffer; contentType?: string }>> = {};
  failNextUpload = false;
  defaults: Record<string, Row> = { outbound_deliveries: { attempts: 0, status: "pending" }, notification_events: { attempts: 0, payload: {} } };
  /** auth.uid() seen by the triggers (null: the service role). */
  actor: string | null = null;
  private seq = 0;

  uuid() {
    this.seq += 1;
    const hex = this.seq.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  }
  rows(table: string) {
    return (this.tables[table] ??= []);
  }
  seed(table: string, row: Row) {
    const full = { id: this.uuid(), created_at: new Date().toISOString(), ...row };
    this.rows(table).push(full);
    return full;
  }

  from(table: string) {
    return new Query(this, table);
  }
  get storage() {
    const db = this;
    return {
      from(bucket: string) {
        const store = (db.objects[bucket] ??= new Map());
        return {
          async upload(path: string, bytes: Buffer, opts: { contentType?: string; upsert?: boolean } = {}) {
            if (db.failNextUpload) {
              db.failNextUpload = false;
              return { data: null, error: { message: "storage down" } };
            }
            if (store.has(path) && !opts.upsert) return { data: null, error: { message: "The resource already exists" } };
            store.set(path, { bytes: Buffer.from(bytes), contentType: opts.contentType });
            return { data: { path }, error: null };
          },
          async download(path: string) {
            const entry = store.get(path);
            if (!entry) return { data: null, error: { message: "Object not found" } };
            return { data: { arrayBuffer: async () => entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.length) }, error: null };
          },
          async remove(paths: string[]) {
            for (const path of paths) store.delete(path);
            return { data: [], error: null };
          },
          async createSignedUrl(path: string, ttl: number) {
            return { data: { signedUrl: `https://fake.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=t&ttl=${ttl}` }, error: null };
          },
          async createSignedUploadUrl(path: string) {
            return { data: { signedUrl: `https://fake.supabase.co/storage/v1/object/upload/sign/${bucket}/${path}?token=u`, token: "u", path }, error: null };
          },
          async list(prefix: string) {
            const entries = [...store.entries()]
              .filter(([key]) => key.startsWith(`${prefix}/`) && !key.slice(prefix.length + 1).includes("/"))
              .map(([key, value]) => ({ name: key.slice(prefix.length + 1), metadata: { size: value.bytes.length } }));
            return { data: entries, error: null };
          },
        };
      },
    };
  }

  // Triggers public.queue_practice_created / queue_document_added
  afterInsert(table: string, row: Row) {
    if (table === "practices") {
      this.seed("notification_events", { event_type: "practice_created", practice_id: row.id, actor_id: this.actor, attempts: 0, payload: {} });
    }
    if (table === "practice_documents") {
      if (row.document_type === "bozza_deliberata" || row.document_type === "polizza_emessa") return;
      const actor = this.actor ?? row.uploaded_by ?? null;
      const recent = this.rows("notification_events").some(
        (e) => e.practice_id === row.practice_id && e.event_type === "practice_created" && Date.now() - Date.parse(e.created_at) < 30 * 60 * 1000 && (actor === null || e.actor_id === actor),
      );
      if (recent) return;
      this.seed("notification_events", { event_type: "documents_added", practice_id: row.practice_id, actor_id: actor, attempts: 0, payload: { file_name: row.file_name, document_type: row.document_type ?? null } });
    }
  }

  // Trigger public.log_practice_status_change and public.queue_practice_changed
  afterUpdate(table: string, before: Row, after: Row) {
    if (table === "practices") {
      if (before.status !== after.status || (before.financial_status ?? null) !== (after.financial_status ?? null)) {
        this.seed("notification_events", {
          event_type: "status_changed", practice_id: after.id, actor_id: this.actor, attempts: 0,
          payload: { old_status: before.status, new_status: after.status, old_financial_status: before.financial_status ?? null, new_financial_status: after.financial_status ?? null },
        });
      }
      if ((before.notes ?? null) !== (after.notes ?? null)) {
        this.seed("notification_events", { event_type: "note_changed", practice_id: after.id, actor_id: this.actor, attempts: 0, payload: {} });
      }
    }
    if (table === "practices" && before.status !== after.status) {
      this.seed("practice_events", { practice_id: after.id, event_type: "status_change", description: `Stato cambiato da ${before.status} a ${after.status}`, created_by: after.user_id });
      this.seed("notifications", { user_id: after.user_id, practice_id: after.id, type: "status_change" });
    }
  }
  unique(table: string, row: Row, ignoreId?: string): boolean {
    const clash = (other: Row) => other.id !== ignoreId;
    if (table === "integration_events" && row.direction === "inbound" && row.external_event_id) {
      return this.rows(table).some((o) => clash(o) && o.direction === "inbound" && o.portal_id === row.portal_id && o.external_event_id === row.external_event_id);
    }
    if (table === "email_suppressions") {
      return this.rows(table).some((o) => clash(o) && o.email === row.email);
    }
    if (table === "vies_intake_lots") {
      return this.rows(table).some((o) => clash(o) && o.source_portal === row.source_portal && o.source_reference === row.source_reference);
    }
    return false;
  }
}

class Query implements PromiseLike<any> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: Array<(r: Row) => boolean> = [];
  private payload: any;
  private onConflict?: string;
  private orderBy?: { col: string; asc: boolean };
  private max?: number;
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private db: FakeDb, private table: string) {}

  private cols: string[] | null = null;
  private headCount = false;
  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    this.returning = true;
    if (opts?.head && opts.count) this.headCount = true;
    // Like PostgREST: only the columns asked for come back (plain lists; embeds are not simulated).
    if (cols && cols.trim() !== "*" && !cols.includes("(")) this.cols = cols.split(",").map((c) => c.trim()).filter(Boolean);
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row, opts: { onConflict?: string } = {}) {
    this.op = "upsert";
    this.payload = payload;
    this.onConflict = opts.onConflict;
    return this;
  }
  eq(col: string, value: any) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  neq(col: string, value: any) {
    this.filters.push((r) => r[col] !== value);
    return this;
  }
  lt(col: string, value: any) {
    this.filters.push((r) => r[col] !== undefined && r[col] !== null && r[col] < value);
    return this;
  }
  gt(col: string, value: any) {
    this.filters.push((r) => r[col] !== undefined && r[col] !== null && r[col] > value);
    return this;
  }
  ilike(col: string, pattern: string) {
    const expression = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
    this.filters.push((r) => typeof r[col] === "string" && expression.test(r[col]));
    return this;
  }
  lte(col: string, value: any) {
    this.filters.push((r) => r[col] !== undefined && r[col] !== null && r[col] <= value);
    return this;
  }
  gte(col: string, value: any) {
    this.filters.push((r) => r[col] !== undefined && r[col] !== null && r[col] >= value);
    return this;
  }
  delete() {
    this.op = "delete" as any;
    return this;
  }
  in(col: string, values: any[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  is(col: string, value: null) {
    this.filters.push((r) => (value === null ? r[col] === null || r[col] === undefined : r[col] === value));
    return this;
  }
  or(expression: string) {
    const clauses = expression.split(",").map((clause) => {
      const [col, op, ...rest] = clause.split(".");
      const value = rest.join(".");
      return (r: Row) => (op === "eq" ? String(r[col]) === value : op === "is" && value === "null" ? r[col] == null : false);
    });
    this.filters.push((r) => clauses.some((c) => c(r)));
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderBy = { col, asc: opts.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private matching() {
    let rows = this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r)));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.max !== undefined) rows = rows.slice(0, this.max);
    return rows;
  }
  private finish(rows: Row[]) {
    const cols = this.cols;
    const copy = rows.map((r) => (cols ? Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, structuredClone(r[c])])) : structuredClone(r)));
    if (this.mode === "many") return { data: copy, error: null };
    if (this.mode === "maybe") return copy.length > 1 ? { data: null, error: { message: "multiple rows" } } : { data: copy[0] ?? null, error: null };
    return copy.length === 1 ? { data: copy[0], error: null } : { data: null, error: { message: "single row expected", code: "PGRST116" } };
  }
  private run(): { data: any; error: any } {
    const db = this.db;
    if (this.op === "select") {
      if (this.headCount) return { data: null, count: this.matching().length, error: null } as { data: any; error: any };
      return this.finish(this.matching());
    }
    if (this.op === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: Row[] = [];
      for (const item of items) {
        const row = { id: db.uuid(), created_at: new Date().toISOString(), ...(db.defaults[this.table] ?? {}), ...item };
        if (db.unique(this.table, row)) return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint on ${this.table}` } };
        db.rows(this.table).push(row);
        db.afterInsert(this.table, row);
        inserted.push(row);
      }
      return this.returning ? this.finish(inserted) : { data: null, error: null };
    }
    if (this.op === "update") {
      const rows = this.matching();
      const updated: Row[] = [];
      for (const row of rows) {
        const before = { ...row };
        Object.assign(row, this.payload);
        db.afterUpdate(this.table, before, row);
        updated.push(row);
      }
      return this.returning ? this.finish(updated) : { data: null, error: null };
    }
    if (this.op === "delete") {
      const doomed = this.matching();
      db.tables[this.table] = db.rows(this.table).filter((r) => !doomed.includes(r));
      return { data: null, error: null };
    }
    // upsert on a single conflict column, one row or many
    const key = this.onConflict ?? "id";
    const items = Array.isArray(this.payload) ? this.payload : [this.payload];
    const out: Row[] = [];
    for (const item of items) {
      const existing = db.rows(this.table).find((r) => r[key] === item[key]);
      if (existing) {
        Object.assign(existing, item);
        out.push(existing);
        continue;
      }
      const row = { created_at: new Date().toISOString(), ...item };
      if (key !== "practice_id") row.id = db.uuid();
      db.rows(this.table).push(row);
      out.push(row);
    }
    return this.returning ? this.finish(out) : { data: null, error: null };
  }
  then<T1 = any, T2 = never>(onfulfilled?: ((value: any) => T1 | PromiseLike<T1>) | null, onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve().then(() => this.run()).then(onfulfilled, onrejected);
  }
}
