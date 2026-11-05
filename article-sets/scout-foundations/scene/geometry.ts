import * as THREE from 'three';

export const colors = {
  stone: '#ebd8b7', light: '#f4e5ca', edge: '#d3b98d', shadow: '#ba9474',
  teal: '#538d87', darkTeal: '#315b59', clay: '#bc6c50', dark: '#293f3d',
  brass: '#d5ad65', green: '#7d9767', apple: '#c4533e', carrot: '#e79748',
};
const materials = new Map<string, THREE.MeshStandardMaterial>();
export function material(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
  return materials.get(color)!;
}
export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material(color));
  object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
export const box = (p: THREE.Object3D, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => mesh(p, new THREE.BoxGeometry(w, h, d), color, x, y, z);
export const cylinder = (p: THREE.Object3D, r: number, h: number, color: string, x = 0, y = 0, z = 0, top = r, sides = 24) => mesh(p, new THREE.CylinderGeometry(top, r, h, sides), color, x, y, z);
export const sphere = (p: THREE.Object3D, r: number, color: string, x = 0, y = 0, z = 0) => mesh(p, new THREE.SphereGeometry(r, 16, 12), color, x, y, z);

export function slab(p: THREE.Object3D, w: number, d: number, h: number, color: string, x: number, y: number, z: number) {
  const cut = Math.min(w, d) * 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + cut, -d / 2); shape.lineTo(w / 2 - cut, -d / 2);
  shape.lineTo(w / 2, -d / 2 + cut); shape.lineTo(w / 2, d / 2 - cut);
  shape.lineTo(w / 2 - cut, d / 2); shape.lineTo(-w / 2 + cut, d / 2);
  shape.lineTo(-w / 2, d / 2 - cut); shape.lineTo(-w / 2, -d / 2 + cut); shape.closePath();
  const object = mesh(p, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }), color, x, y, z);
  object.rotation.x = -Math.PI / 2;
  return object;
}

function archShape(w: number, h: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(-w / 2, h - w / 2);
  shape.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
  shape.lineTo(w / 2, 0); shape.closePath();
  return shape;
}
export function arch(p: THREE.Object3D, w: number, h: number, depth: number, color: string, x: number, y: number, z: number, thickness = 0) {
  const shape = archShape(w, h);
  if (thickness) shape.holes.push(archShape(w - thickness * 2, h - thickness));
  return mesh(p, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }), color, x, y, z);
}

export function itemMesh(item: 'apple' | 'carrot') {
  const g = new THREE.Group();
  if (item === 'apple') {
    const a = sphere(g, 0.15, colors.apple, 0, 0.12, 0); a.scale.set(1, 0.9, 1);
    sphere(g, 0.09, '#d86950', 0.055, 0.15, 0.035);
    cylinder(g, 0.017, 0.13, colors.dark, 0, 0.28, 0);
    const leaf = sphere(g, 0.07, colors.green, 0.065, 0.3, 0); leaf.scale.set(1.4, 0.2, 0.6); leaf.rotation.z = 0.4;
  } else {
    const root = mesh(g, new THREE.ConeGeometry(0.09, 0.38, 12), colors.carrot, 0, 0.08, 0);
    root.rotation.z = Math.PI - 0.25;
    for (let i = 0; i < 3; i++) {
      const leaf = box(g, 0.028, 0.19, 0.035, colors.green, (i - 1) * 0.04, 0.34, 0);
      leaf.rotation.z = (i - 1) * -0.4;
    }
  }
  return g;
}

export function plant(p: THREE.Object3D, x: number, y: number, z: number, size = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(size); p.add(g);
  cylinder(g, 0.22, 0.36, colors.clay, 0, 0.18, 0, 0.28);
  cylinder(g, 0.29, 0.08, '#cf8b69', 0, 0.36, 0);
  for (let i = 0; i < 5; i++) {
    const leaf = sphere(g, 0.22, i % 2 ? colors.green : '#90a47c', Math.sin(i * 2.4) * 0.13, 0.56 + (i % 2) * 0.16, Math.cos(i * 2.4) * 0.13);
    leaf.scale.set(0.5, 1.5, 0.6); leaf.rotation.z = Math.sin(i * 2.4) * 0.6;
  }
  return g;
}
