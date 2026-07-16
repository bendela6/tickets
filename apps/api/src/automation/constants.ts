// Depth beyond which the worker stops dispatching automations for an event —
// bounds chains and any accidental cycle.
export const DEPTH_CAP = 8;

// Fixed namespace for deriving deterministic automation command ids (uuid v5).
export const AUTOMATION_NS = 'f4e2c1a0-1b3d-4c5e-8a9f-0d1e2f3a4b5c';
