import * as THREE from 'three';
import {
  arch,
  box,
  colors as c,
  cylinder,
  itemMesh,
  plant,
  slab,
  sphere,
} from './geometry.ts';
import type { Snapshot } from '../types.ts';

export function buildVillage(scene: THREE.Scene) {
  const village = new THREE.Group();
  scene.add(village);
  // Two carved stone islands joined by a short pedestrian bridge.
  slab(village, 8.1, 9.5, 0.7, c.shadow, -2.4, -0.65, -0.5);
  slab(village, 8.3, 9.7, 0.16, c.edge, -2.4, 0.05, -0.5);
  slab(village, 8.2, 9.6, 0.24, c.stone, -2.4, 0.21, -0.5);
  slab(village, 3.05, 5.8, 0.68, c.shadow, 4.8, -0.63, 1.8);
  slab(village, 3.25, 6, 0.15, c.edge, 4.8, 0.05, 1.8);
  slab(village, 3.15, 5.9, 0.25, c.stone, 4.8, 0.2, 1.8);
  // Quiet blue water beneath the bridge, inset into the floating composition.
  box(village, 1.15, 0.06, 5.7, '#8bb1a6', 2.52, -0.28, 1.8);
  for (let i = 0; i < 4; i++)
    box(village, 0.52, 0.015, 0.022, '#bad0bd', 2.55, -0.24, 0.3 + i * 0.9);
  box(village, 1.9, 0.22, 1.5, c.light, 2.5, 0.34, 1.6);
  for (const z of [0.86, 2.34]) {
    box(village, 2.0, 0.12, 0.1, c.edge, 2.5, 0.86, z);
    for (const x of [1.64, 2.5, 3.35])
      box(village, 0.09, 0.5, 0.09, c.light, x, 0.61, z);
  }
  // Low retaining walls, courses, and paving give the scene a handmade scale.
  for (let i = 0; i < 8; i++) {
    box(village, 0.035, 0.012, 8.5, '#ddc8a7', -5.7 + i * 1.05, 0.456, -0.25);
  }
  for (let i = 0; i < 7; i++)
    box(village, 8.1, 0.012, 0.024, '#ddc8a7', -2, 0.46, -4.3 + i * 1.23);
  box(village, 0.21, 0.56, 6.9, c.stone, -6.15, 0.7, -0.8);
  box(village, 0.32, 0.1, 7.0, c.light, -6.15, 1.02, -0.8);
  box(village, 4.9, 0.5, 0.21, c.stone, -3.6, 0.7, -5.04);

  // Pantry: a stepped civic storehouse with an open arched counter.
  slab(village, 5.2, 3.8, 0.8, c.edge, -0.8, 0.45, -3.2);
  slab(village, 5.35, 3.85, 0.12, c.light, -0.8, 1.13, -3.2);
  for (let i = 0; i < 5; i++) {
    box(
      village,
      1.7,
      (i + 1) * 0.16,
      0.3,
      i % 2 ? c.light : c.stone,
      -0.8,
      0.45 + (i + 1) * 0.08,
      -0.05 - i * 0.3,
    );
  }
  box(village, 3.8, 2.8, 2.05, c.stone, -0.8, 2.65, -3.8);
  box(village, 4.05, 0.18, 2.3, c.light, -0.8, 4.0, -3.8);
  box(village, 3.7, 0.3, 2.0, c.teal, -0.8, 4.22, -3.8);
  box(village, 3.9, 0.12, 2.2, c.darkTeal, -0.8, 4.42, -3.8);
  arch(village, 1.68, 2.23, 0.06, c.darkTeal, -0.8, 1.25, -2.735);
  arch(village, 2.12, 2.48, 0.22, c.light, -0.8, 1.25, -2.76, 0.22);
  box(village, 1.55, 0.12, 0.5, c.clay, -0.8, 1.93, -2.46);
  box(village, 1.55, 0.05, 0.5, '#d8966f', -0.8, 2.015, -2.46);
  for (const x of [-2.3, 0.7]) {
    arch(village, 0.45, 0.93, 0.07, c.teal, x, 2.55, -2.735);
    box(village, 0.6, 0.09, 0.3, c.edge, x, 2.55, -2.65);
  }
  // The little sun dial is the pantry's original architectural signature.
  const dial = cylinder(village, 0.27, 0.06, c.brass, -0.8, 3.82, -2.66);
  dial.rotation.x = Math.PI / 2;
  box(village, 0.025, 0.26, 0.08, c.darkTeal, -0.8, 3.84, -2.6).rotation.z =
    -0.55;
  const finial = new THREE.Group();
  village.add(finial);
  finial.position.set(-0.8, 4.52, -3.8);
  cylinder(finial, 0.15, 0.5, c.brass, 0, 0.25, 0, 0.1);
  sphere(finial, 0.16, c.clay, 0, 0.59, 0);
  plant(village, -2.75, 1.25, -2.0, 0.95);
  plant(village, 1.13, 1.25, -2.05, 0.85);
  const pantryItems = new THREE.Group();
  pantryItems.position.set(-0.8, 2.04, -2.4);
  village.add(pantryItems);

  // Terracotta wind tower and a shaded side arcade.
  box(village, 1.45, 3.7, 1.7, c.clay, -4.65, 2.3, -3.8);
  box(village, 1.72, 0.14, 1.95, '#d88a67', -4.65, 4.15, -3.8);
  box(village, 1.35, 0.85, 1.55, c.clay, -4.65, 4.6, -3.8);
  arch(village, 0.55, 0.67, 0.04, '#744e40', -4.65, 4.24, -2.99);
  box(village, 1.8, 0.17, 2.0, c.light, -4.65, 5.08, -3.8);
  for (let i = 0; i < 3; i++) {
    cylinder(village, 0.13, 1.6, c.light, -5.1 + i * 0.72, 1.25, -1.8);
    arch(
      village,
      0.73,
      0.68,
      0.22,
      c.light,
      -4.74 + i * 0.72,
      1.45,
      -1.91,
      0.12,
    );
  }
  box(village, 2.65, 0.16, 0.9, c.teal, -4.45, 2.16, -1.85);
  plant(village, -5.3, 0.45, 3.2, 1.1);
  plant(village, 0.8, 0.45, 3.3, 0.9);

  // Noticeboard: wide pale paper, brass fasteners, and a tiled teal canopy.
  const board = new THREE.Group();
  board.position.set(-4.1, 0.45, 0.6);
  village.add(board);
  for (const x of [-0.64, 0.64])
    box(board, 0.12, 1.75, 0.13, c.darkTeal, x, 0.87, 0);
  box(board, 1.75, 1.15, 0.15, c.darkTeal, 0, 1.18, 0);
  box(board, 1.5, 0.93, 0.02, c.light, 0, 1.18, 0.09);
  for (const x of [-0.6, 0.6]) sphere(board, 0.04, c.brass, x, 1.52, 0.12);
  for (let i = 0; i < 4; i++)
    box(
      board,
      0.9 - i * 0.1,
      0.026,
      0.015,
      '#ae9b7d',
      -0.1,
      1.38 - i * 0.13,
      0.115,
    );
  const canopy = box(board, 2.05, 0.13, 0.65, c.teal, 0, 1.89, 0);
  canopy.rotation.x = 0.12;
  cylinder(board, 0.12, 0.05, c.clay, 0.5, 0.89, 0.13).rotation.x = Math.PI / 2;

  // A posted notice lights the board. Reading is a world event, not a renderer decision.
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: '#806647',
    emissive: '#e8a438',
    emissiveIntensity: 0,
  });
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    lampMaterial,
  );
  lamp.position.set(0, 2.12, 0);
  board.add(lamp);
  cylinder(board, 0.17, 0.06, c.brass, 0, 1.99, 0);
  let unread = false;

  // Picnic rug and basket on the smaller island.
  box(village, 2.4, 0.02, 1.7, '#cb8267', 4.45, 0.46, 3.1);
  for (let i = 0; i < 7; i++)
    box(village, 0.12, 0.005, 1.7, '#e4b598', 3.42 + i * 0.34, 0.475, 3.1);
  for (const z of [2.42, 2.8, 3.18, 3.56])
    box(village, 2.4, 0.006, 0.055, '#edd0ae', 4.45, 0.48, z);
  const basket = new THREE.Group();
  basket.position.set(4.5, 0.5, 3.1);
  village.add(basket);
  box(basket, 0.95, 0.12, 0.65, '#ac7847', 0, 0.06, 0);
  for (const x of [-0.47, 0.47])
    box(basket, 0.07, 0.38, 0.7, '#b98651', x, 0.23, 0);
  for (const z of [-0.33, 0.33])
    box(basket, 0.94, 0.38, 0.07, '#c8995f', 0, 0.23, z);
  for (let i = 0; i < 4; i++)
    box(basket, 1.02, 0.025, 0.035, '#e0b77a', 0, 0.12 + i * 0.085, 0.373);
  const handle = meshHandle();
  basket.add(handle);
  function meshHandle() {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.037, 8, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#8a603d' }),
    );
    m.position.y = 0.35;
    m.rotation.y = Math.PI / 2;
    return m;
  }
  const basketItems = new THREE.Group();
  basketItems.position.y = 0.44;
  basket.add(basketItems);
  plant(village, 5.7, 0.45, 0.0, 1.2);
  // A cypress and a slim shade canopy balance the pantry's height.
  cylinder(village, 0.09, 1.7, '#8a7354', 5.95, 1.3, 2.8);
  const tree = sphere(village, 0.5, '#7e9474', 5.95, 2.2, 2.8);
  tree.scale.set(0.8, 2.0, 0.8);
  cylinder(village, 0.07, 2.2, c.darkTeal, 3.15, 1.55, 4.1);
  const sail = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.27, 4, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#e2c48f',
      side: THREE.DoubleSide,
    }),
  );
  sail.position.set(3.15, 2.65, 4.1);
  sail.rotation.y = Math.PI / 4;
  sail.castShadow = true;
  village.add(sail);

  function displayItems(
    group: THREE.Group,
    apple: number,
    carrot: number,
    spacing: number,
  ) {
    group.clear();
    const list = [
      ...Array(Math.min(apple, 6)).fill('apple'),
      ...Array(Math.min(carrot, 6)).fill('carrot'),
    ] as ('apple' | 'carrot')[];
    list.forEach((item, i) => {
      const m = itemMesh(item);
      m.position.set((i - (list.length - 1) / 2) * spacing, 0, 0);
      group.add(m);
    });
  }
  let counts = '';
  return {
    animate(time: number) {
      lampMaterial.emissiveIntensity = unread
        ? 1.1 + Math.sin(time * 4) * 0.6
        : 0;
      lampMaterial.color.set(unread ? '#edb74d' : '#806647');
    },
    update(state: Snapshot) {
      unread = !!state.unread;
      const key = JSON.stringify([state.pantry, state.basket]);
      if (key === counts) return;
      counts = key;
      displayItems(pantryItems, state.pantry.apple, state.pantry.carrot, 0.3);
      displayItems(basketItems, state.basket.apple, state.basket.carrot, 0.23);
    },
  };
}
