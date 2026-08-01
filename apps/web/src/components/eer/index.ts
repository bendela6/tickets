// Standalone form: one component, its own outline sidebar.
export { EerDiagram } from './view/eer-viewer/eer-viewer';
// Composable form, for a host that renders the outline in its own chrome
// (see routes/schema-route.tsx).
export { EerCanvas, EerDiagramProvider } from './view/eer-viewer/eer-viewer';
export { Outline as EerOutline } from './view/outline';
export { schemaGraphToModel } from './adapter/schema-graph-to-model';
