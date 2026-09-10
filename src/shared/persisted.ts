// Automatic Persisted Queries send a hash in place of the document, so a
// request can arrive with nothing to match on: no query text, and — for clients
// that omit it — no operation name either.
//
// The name is learnable all the same. A hash is registered by sending the
// document and the hash together, which happens on the first use of an
// operation and again whenever the server has forgotten it. Watching for that
// pairing gives a hash a name, and every later request carrying only that hash
// can be identified from it.
//
// What this cannot do is name a hash it has never seen paired. If the server
// already knew the hash when the page loaded, the document never crosses the
// wire and the request stays unidentified. Such a request passes through.

export interface PersistedQueryCache {
  remember: (hash: string, operationName: string) => void
  resolve: (hash: string) => string
}

// A page can run for hours and every distinct operation adds an entry, so the
// map is capped. Entries are dropped oldest-first; a hash that falls out is
// relearned the next time its document is sent.
export const DEFAULT_LIMIT = 500

export function createPersistedQueryCache(limit: number = DEFAULT_LIMIT): PersistedQueryCache {
  const names = new Map<string, string>()

  function remember(hash: string, operationName: string): void {
    if (!hash || !operationName || names.get(hash) === operationName) {
      return
    }

    if (names.size >= limit) {
      const oldest = names.keys().next()

      if (!oldest.done) {
        names.delete(oldest.value)
      }
    }

    names.set(hash, operationName)
  }

  function resolve(hash: string): string {
    return names.get(hash) ?? ''
  }

  return { remember, resolve }
}
