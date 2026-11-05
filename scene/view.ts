import * as THREE from 'three';
import { buildVillage } from './village.ts';
import { buildScout } from './scout.ts';
import { places } from '../runtime/types.ts';
import type { TraceEvent } from '../runtime/types.ts';

export function createView(container: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e8df');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.setAttribute('aria-label', 'Isometric village: noticeboard, pantry and picnic basket, with Scout the courier.');
  renderer.domElement.setAttribute('role', 'img');
  container.prepend(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
  camera.position.set(13, 13, 18); camera.lookAt(0, 1.4, -0.2);
  scene.add(new THREE.HemisphereLight('#fff7df', '#b1bdae', 2.2));
  const sun = new THREE.DirectionalLight('#fff0d3', 3.4);
  sun.position.set(-6, 12, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025; sun.shadow.radius = 4; scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#e9e8df', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.93; floor.receiveShadow = true; scene.add(floor);
  const village = buildVillage(scene), scout = buildScout(scene);
  const labels = [...container.querySelectorAll<HTMLElement>('[data-place]')];
  const projected = new THREE.Vector3();
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    const aspect = width / height;
    const span = Math.max(6.3, 8.4 / aspect);
    camera.left = -span * aspect; camera.right = span * aspect;
    camera.top = span; camera.bottom = -span;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
    for (const label of labels) {
      const place = label.dataset.place as keyof typeof places;
      const point = [...places[place]];
      if (place === 'noticeboard') { point[1] += 2.15; point[2] -= 0.9; }
      if (place === 'pantry') { point[1] += 3.6; point[2] -= 1.4; }
      if (place === 'picnic_basket') { point[0] += 1.4; point[1] += 0.5; point[2] += 1.2; }
      projected.fromArray(point).project(camera);
      label.style.left = `${(projected.x + 1) / 2 * width}px`;
      label.style.top = `${(-projected.y + 1) / 2 * height}px`;
    }
  }
  new ResizeObserver(resize).observe(container); resize();
  let paused = false, idle = true, previous = performance.now();
  let onFrame: (dt: number) => void = () => {};
  renderer.setAnimationLoop(now => {
    const dt = Math.max(0, (now - previous) / 1000); previous = now;
    onFrame(dt);
    scout.update(dt, paused, idle); renderer.render(scene, camera);
  });
  return {
    apply(event: TraceEvent, elapsed = 0) { village.update(event.state); scout.apply(event, elapsed); },
    pause(value: boolean) { paused = value; },
    idle(value: boolean) { idle = value; },
    onFrame(callback: (dt: number) => void) { onFrame = callback; },
  };
}
