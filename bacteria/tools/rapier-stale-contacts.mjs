// Minimal reproduction: in @dimforge/rapier2d-compat 0.21.0, growing a collider at rest
// (setHalfHeight / setShape) does not update its existing contacts. A capsule whose tip grows into
// a fixed box is never pushed out: the contact keeps reporting zero depth. Replacing the collider
// (remove + create) gives correct contacts, but leaks WebAssembly memory (~13 MB per 1000 steps
// with 1700 cells replaced every 25 steps; the 4 GB heap ran out after ~230 000 steps). Turning
// the resized collider by π on its body (same shape for a capsule) also gives correct contacts,
// without allocating: that is what rapier-simulation.ts does (rapierRefreshContacts).
//
// usage (from the repository root): node bacteria/tools/rapier-stale-contacts.mjs
import RAPIER from "@dimforge/rapier2d-compat";

await RAPIER.init();

function trial(label, grow) {
  const world = new RAPIER.World({ x: 0, y: 0 });
  world.timestep = 1 / 60;
  const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const wallCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(5, 1).setTranslation(0, 3), wall); // y in [2, 4]
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false));
  const desc = (halfHeight) => RAPIER.ColliderDesc.capsule(halfHeight, 0.4); // tip at y = halfHeight + 0.4
  let collider = world.createCollider(desc(1.0), body);
  let halfHeight = 1.0;
  for (let k = 0; k < 60; k++) { // grow 0.025 every 25 steps: the tip passes the wall face (y = 2) at k = 24
    halfHeight += 0.025;
    collider = grow(world, body, collider, desc, halfHeight);
    for (let i = 0; i < 25; i++) { world.step(); }
  }
  let reported = 0;
  world.contactPair(collider, wallCollider, (manifold) => {
    for (let i = 0; i < manifold.numContacts(); i++) { reported = Math.max(reported, -manifold.contactDist(i)); }
  });
  const penetration = body.translation().y + halfHeight + 0.4 - 2;
  console.log(`${label.padEnd(34)} actual penetration ${Math.max(0, penetration).toFixed(3)}, ` +
    `contact reports ${reported.toFixed(3)}, capsule centre y ${body.translation().y.toFixed(3)}`);
}

trial("setHalfHeight", (w, b, c, d, h) => { c.setHalfHeight(h); return c; });
trial("setShape(new Capsule)", (w, b, c, d, h) => { c.setShape(new RAPIER.Capsule(h, 0.4)); return c; });
trial("remove + create collider", (w, b, c, d, h) => { w.removeCollider(c, false); return w.createCollider(d(h), b); });
let flipped = false;
trial("setHalfHeight + turn collider by pi", (w, b, c, d, h) => { c.setHalfHeight(h); flipped = !flipped; c.setRotationWrtParent(flipped ? Math.PI : 0); return c; });
// Expected: penetration ~0 in all cases (the capsule is pushed down as it grows).
// Observed with 0.21.0: 0.900 for setHalfHeight and setShape (capsule never moves), 0.000 for
// remove + create and for the turn by pi.
