// Token JSON is read by path (foundation/spec.ts, foundation/colors) and
// tokens.css by the ./tokens.css export — neither goes through a barrel, so
// pulling ~2500 lines of JSON into the package barrel would be pure cost.
export {};
