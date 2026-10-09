// Mutate in place: in the bundled build this runs after prismjs has already set globalThis.Prism.
const g = globalThis as { Prism?: { manual?: boolean } }
;(g.Prism ??= {}).manual = true
export {}
