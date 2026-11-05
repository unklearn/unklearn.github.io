import * as THREE from 'three';
import { box, colors as c, cylinder, itemMesh, sphere } from './geometry.ts';
import { distance } from '../types.ts';
import type { Item, Movement, Point, TraceEvent } from '../types.ts';

export function buildScout(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);
  const coat = cylinder(body, 0.26, 0.56, c.teal, 0, 0.76, 0, 0.22, 12);
  box(body, 0.31, 0.06, 0.34, c.darkTeal, 0, 0.49, 0);
  const head = sphere(body, 0.225, '#edc399', 0, 1.23, 0.02);
  head.scale.set(1, 1.08, 0.92);
  cylinder(body, 0.235, 0.09, c.light, 0, 1.42, 0.02, 0.19);
  box(body, 0.29, 0.045, 0.24, c.light, 0, 1.44, 0.17);
  box(body, 0.055, 0.06, 0.04, c.clay, 0, 1.48, 0.19);
  for (const x of [-0.075, 0.075]) sphere(body, 0.023, c.dark, x, 1.25, 0.213);
  const scarf = cylinder(body, 0.21, 0.11, '#e8ba71', 0, 1.045, 0, 0.18);
  box(body, 0.11, 0.26, 0.06, '#e8ba71', -0.11, 0.94, 0.22).rotation.z = -0.2;
  const strap = box(body, 0.065, 0.63, 0.035, '#c59c62', 0, 0.78, 0.245);
  strap.rotation.z = -0.65;
  const satchel = new THREE.Group();
  satchel.position.set(0.31, 0.65, -0.06);
  body.add(satchel);
  box(satchel, 0.23, 0.34, 0.31, c.clay);
  box(satchel, 0.25, 0.13, 0.33, '#d18b5d', 0, 0.12, 0);
  sphere(satchel, 0.043, c.brass, 0.13, 0.045, 0.02).scale.set(0.3, 1, 1);
  const legs = [-0.115, 0.115].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.48, 0);
    body.add(g);
    box(g, 0.13, 0.3, 0.15, '#3f5550', 0, -0.15, 0);
    box(g, 0.15, 0.1, 0.24, c.dark, 0, -0.34, 0.05);
    return g;
  });
  const arms = [-0.29, 0.29].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.94, 0);
    body.add(g);
    cylinder(g, 0.07, 0.34, c.teal, 0, -0.14, 0, 0.08, 12);
    sphere(g, 0.073, '#edc399', 0, -0.32, 0);
    return g;
  });
  const carried = new THREE.Group();
  carried.position.set(0, 0.65, 0.42);
  carried.scale.setScalar(1.5);
  body.add(carried);
  let currentItem: Item | null = null;
  let motion: (Movement & { elapsed: number }) | null = null;
  let yaw = 0,
    targetYaw = 0,
    time = 0;
  let gesture = '';
  root.position.set(-4.1, 0.45, 1.6);

  function apply(event: TraceEvent, elapsed = 0) {
    if (
      !motion ||
      [
        'walk_start',
        'walk_end',
        'walk_cancelled',
        'checkpoint',
        'patrol_pass',
      ].includes(event.kind)
    )
      root.position.fromArray(event.state.position);
    if (event.kind === 'walk_start' && event.movement)
      motion = { ...event.movement, elapsed };
    else if (
      ['walk_end', 'walk_cancelled', 'checkpoint', 'patrol_pass'].includes(
        event.kind,
      )
    )
      motion = null;
    gesture = event.kind;
    if (['read', 'inspect'].includes(event.kind)) targetYaw = Math.PI;
    if (event.kind === 'delivery') targetYaw = 0;
    if (currentItem !== event.state.carried) {
      currentItem = event.state.carried;
      carried.clear();
      if (currentItem) carried.add(itemMesh(currentItem));
    }
  }
  function update(dt: number, paused: boolean, idle: boolean) {
    if (paused) return;
    time += dt;
    let walking = false;
    if (motion) {
      motion.elapsed += dt * 1000;
      const total = motion.path
        .slice(1)
        .reduce((n, p, i) => n + distance(motion!.path[i], p), 0);
      let travel = Math.min(1, motion.elapsed / motion.duration) * total;
      for (let i = 1; i < motion.path.length; i++) {
        const a = motion.path[i - 1],
          b = motion.path[i];
        const segment = distance(a, b);
        if (travel <= segment || i === motion.path.length - 1) {
          const t = segment ? Math.min(1, travel / segment) : 1;
          root.position.set(...(a.map((v, k) => v + (b[k] - v) * t) as Point));
          targetYaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
          break;
        }
        travel -= segment;
      }
      walking = motion.elapsed < motion.duration;
    }
    if (idle) targetYaw = 0.3 + Math.sin(time * 0.55) * 0.4;
    const diff = Math.atan2(
      Math.sin(targetYaw - yaw),
      Math.cos(targetYaw - yaw),
    );
    yaw += diff * Math.min(1, dt * 10);
    root.rotation.y = yaw;
    body.position.y = walking
      ? Math.abs(Math.sin(time * 10)) * 0.065
      : Math.sin(time * 2) * 0.012;
    legs.forEach((leg, i) => {
      leg.rotation.x = walking ? Math.sin(time * 10 + i * Math.PI) * 0.55 : 0;
    });
    arms.forEach((arm, i) => {
      arm.rotation.x = currentItem
        ? -0.85
        : walking
          ? Math.sin(time * 10 + (i + 1) * Math.PI) * 0.45
          : gesture === 'inspect'
            ? -0.5
            : 0;
    });
    coat.rotation.z = walking ? Math.sin(time * 10) * 0.025 : 0;
    scarf.rotation.z = walking ? Math.sin(time * 8) * 0.06 : 0;
  }
  return { apply, update, position: root.position };
}
