import * as THREE from 'three';
import { buildVillage } from '../article-sets/scout-foundations/scene/village.ts';
import { buildScout } from '../article-sets/scout-foundations/scene/scout.ts';
import type { TraceEvent } from '../article-sets/scout-foundations/types.ts';

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
  const noticeLabel = container.querySelector<HTMLElement>('#notice-light-label')!;
  const projected = new THREE.Vector3();
  const bubble = container.querySelector<HTMLElement>('#scout-bubble')!;
  let thinking = false, confused = false, recorded = false;
  function bubbleState() {
    bubble.hidden = !thinking && !confused;
    bubble.classList.toggle('confused', !thinking && confused);
    container.querySelector('#bubble-label')!.textContent = thinking ? recorded ? 'Recorded thinking activity' : 'Scout is thinking · provider call pending' : confused ? 'Scout needs a tool that is not available' : '';
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    const aspect = width / height;
    const span = Math.max(6.3, 8.4 / aspect);
    camera.left = -span * aspect; camera.right = span * aspect;
    camera.top = span; camera.bottom = -span;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); renderer.setSize(width, height);
    // Put the label on a plane parallel to the noticeboard, using this camera's projection.
    projected.set(-4.1, 2.85, .6).project(camera);
    noticeLabel.style.left = `${(projected.x + 1) / 2 * width}px`;
    noticeLabel.style.top = `${(-projected.y + 1) / 2 * height}px`;
    const right = new THREE.Vector3(-3.1, 2.85, .6).project(camera).sub(projected);
    const down = new THREE.Vector3(-4.1, 1.85, .6).project(camera).sub(projected);
    const x = right.x * width / 2, y = -right.y * height / 2, scale = Math.hypot(x, y);
    noticeLabel.style.setProperty('--isometric-plane', `matrix(${x / scale},${y / scale},${down.x * width / 2 / scale},${-down.y * height / 2 / scale},0,0)`);

  }
  new ResizeObserver(resize).observe(container); resize();
  let paused = false, idle = true, previous = performance.now();
  let onFrame: (dt: number) => void = () => {};
  renderer.setAnimationLoop(now => {
    const dt = Math.max(0, (now - previous) / 1000); previous = now;
    onFrame(dt);
    scout.update(dt, paused, idle);
    projected.copy(scout.position).add(new THREE.Vector3(.15, 2.05, 0)).project(camera);
    bubble.style.left = `${(projected.x + 1) / 2 * container.clientWidth}px`;
    bubble.style.top = `${(-projected.y + 1) / 2 * container.clientHeight}px`;
    village.animate(now / 1000); renderer.render(scene, camera);
  });
  return {
    apply(event: TraceEvent, elapsed = 0) {
      if (event.kind === 'checkpoint') { thinking = false; confused = false; }
      if (event.kind === 'model_start') { thinking = true; confused = false; }
      if (['model_end','run_end','error'].includes(event.kind)) thinking = false;
      if (event.kind === 'capability_missing' || (event.kind === 'tool_result' && event.result?.reason === 'tool_unavailable')) confused = true;
      if (['lesson_approval','capability_available'].includes(event.kind)) confused = false;
      bubbleState(); village.update(event.state); noticeLabel.hidden = !event.state.unread; scout.apply(event, elapsed); },
    recorded(value: boolean) { recorded = value; bubbleState(); },
    pause(value: boolean) { paused = value; },
    idle(value: boolean) { idle = value; },
    onFrame(callback: (dt: number) => void) { onFrame = callback; },
  };
}
