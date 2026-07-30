// One pure pass per scene change: pin fans first (endpoints depend on them),
// then routed polylines for the modes that use them.

import { pinSlots, type EdgeSlots } from '../../geometry/compute-pin-slots';
import { routeEdges } from '../compute-routes';
import type { Model, Point, RoutingMode } from '../../model/types';

export interface EdgeGeometry {
  slots: Map<string, EdgeSlots>;
  pinSpan: Map<string, number>;
  routes: Map<string, Point[] | null>;
}

export function computeEdgeGeometry(model: Model, routing: RoutingMode): EdgeGeometry {
  const { slots, pinSpan } = pinSlots(model);
  if (routing === 'curved') return { slots, pinSpan, routes: new Map() };
  const { routes, slots: adjusted } = routeEdges(model, slots);
  return { slots: adjusted, pinSpan, routes };
}
