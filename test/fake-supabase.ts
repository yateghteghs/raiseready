/**
 * In-memory stand-in for the subset of the Supabase query builder our services
 * use, for unit tests. Supports select/insert/update/delete with eq, in, is,
 * gte, order, limit, single/maybeSingle, head counts and unique turn indexes.
 */
type Row = Record<string, unknown>;

export function createFakeDb() {
  const tables: Record<string, Row[]> = {};
  let counter = 0;

  function from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    let limitN: number | null = null;
    let head = false;
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let affected: Row[] = [];
    let failure: { message: string; code?: string } | null = null;

    const matching = () => {
      let out = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (order) {
        const { col, asc } = order;
        out = [...out].sort((a, b) => {
          const x = a[col] as string | number;
          const y = b[col] as string | number;
          return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
        });
      }
      return limitN === null ? out : out.slice(0, limitN);
    };

    const run = () => {
      if (mode === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload]) as Row[];
        affected = [];
        for (const row of rows) {
          const full: Row = {
            id: `${table}-${++counter}`,
            created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, counter)).toISOString(),
            updated_at: new Date(Date.UTC(2026, 9, 1, 0, 0, counter)).toISOString(),
            evaluation: null,
            red_flags: null,
            ended_at: null,
            status: table === "simulations" ? "active" : undefined,
            mode: table === "simulations" ? "full" : undefined,
            ...row,
          };
          const clash =
            table === "simulation_turns" &&
            (tables[table] ?? []).some((r) => r.simulation_id === full.simulation_id && r.turn_index === full.turn_index);
          if (clash) {
            failure = { message: "duplicate key", code: "23505" };
            return;
          }
          (tables[table] ??= []).push(full);
          affected.push(full);
        }
      } else if (mode === "update") {
        affected = matching();
        for (const r of affected) Object.assign(r, payload);
      } else if (mode === "delete") {
        const doomed = new Set(matching());
        tables[table] = (tables[table] ?? []).filter((r) => !doomed.has(r));
        affected = [...doomed];
      } else {
        affected = matching();
      }
    };

    const result = () => {
      run();
      return failure;
    };

    const builder = {
      select(_cols?: string, opts?: { head?: boolean; count?: string }) {
        head = Boolean(opts?.head);
        return builder;
      },
      insert(rows: Row | Row[]) {
        mode = "insert";
        payload = rows;
        return builder;
      },
      update(values: Row) {
        mode = "update";
        payload = values;
        return builder;
      },
      delete() {
        mode = "delete";
        return builder;
      },
      eq(col: string, v: unknown) {
        filters.push((r) => r[col] === v);
        return builder;
      },
      in(col: string, vs: unknown[]) {
        filters.push((r) => vs.includes(r[col]));
        return builder;
      },
      is(col: string, v: unknown) {
        filters.push((r) => (r[col] ?? null) === v);
        return builder;
      },
      gte(col: string, v: string) {
        filters.push((r) => String(r[col]) >= v);
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        order = { col, asc: opts?.ascending ?? true };
        return builder;
      },
      limit(n: number) {
        limitN = n;
        return builder;
      },
      async maybeSingle() {
        const error = result();
        return { data: error ? null : (affected[0] ?? null), error };
      },
      async single() {
        const error = result();
        return { data: error ? null : (affected[0] ?? null), error: error ?? (affected[0] ? null : { message: "no rows" }) };
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try {
          const error = result();
          resolve({ data: head ? null : affected, count: affected.length, error });
        } catch (e) {
          reject?.(e);
        }
      },
    };
    return builder;
  }

  /** The SQL functions in supabase/migrations/*_billing.sql. */
  async function rpc(name: string, args: Record<string, unknown>) {
    const profile = (tables.profiles ?? []).find((p) => p.id === args.p_user_id);
    if (name === "add_credits") {
      if (!profile || (args.p_amount as number) <= 0) return { data: null, error: null };
      profile.credits = (profile.credits as number) + (args.p_amount as number);
      return { data: profile.credits, error: null };
    }
    if (name === "consume_credit") {
      if (!profile || (profile.credits as number) <= 0) return { data: null, error: null };
      profile.credits = (profile.credits as number) - 1;
      return { data: profile.credits, error: null };
    }
    return { data: null, error: { message: `unknown function ${name}` } };
  }

  return { tables, client: { from, rpc } };
}
