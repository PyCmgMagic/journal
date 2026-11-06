import { Vector3 } from "three";

/** Per-visit render values. GSAP owns these scalar targets; useFrame owns camera and uniforms. */
export function createMotionRuntime() {
  return {
    scrollProgress: 0,
    sceneRevision: 0,
    charge: 0,
    waveRadius: -1,
    awake: 0,
    returnToWorld: 0,
    pointerX: 0,
    pointerY: 0,
    focusX: 0,
    focusZoom: 0,
    readingBlend: 0,
    stoneLight: 0,
    lamp0: 0,
    lamp1: 0,
    lamp2: 0,
    stars: 0,
    hoverIndex: -1,
    selectedIndex: -1,
    time: 0,
    wind: 1,
    paused: false,
    quiet: false,
    currentPosition: new Vector3(0, 0, 12),
    currentTarget: new Vector3(0, 0, 0),
    invalidate: () => {},
  };
}
