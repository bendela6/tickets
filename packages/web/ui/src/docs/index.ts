// How the library documents itself: the machinery that collects demos, and the
// pages that show what the token layer actually ships.
//
// Nothing in library/ or style/ imports this. The one exception is deliberate:
// *.demo.tsx files sit beside their component and import definePlayground from
// here, because a demo IS documentation that happens to live next to its
// subject.
export * from './gallery';
export * from './gallery/demos';
export * from './gallery/demo-sources';
export * from './pages';
