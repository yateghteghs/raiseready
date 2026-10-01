/** A database read failed. Carries the Postgres/PostgREST error code, which is safe to show. */
export class DataLoadError extends Error {
  constructor(
    readonly what: string,
    readonly code: string,
    detail: string,
  ) {
    super(`Could not load ${what}: [${code}] ${detail}`);
    this.name = "DataLoadError";
  }
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; code: string };

/**
 * Runs a data load and turns a DataLoadError into a value, so pages can show
 * the error code instead of an opaque crash reference. Other errors (including
 * Next.js redirects) are re-thrown.
 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DataLoadError) {
      console.error(error.message);
      return { ok: false, code: error.code };
    }
    throw error;
  }
}
