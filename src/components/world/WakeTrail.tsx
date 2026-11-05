import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  ShaderMaterial,
  Vector3,
} from "three";
import { ART_HEIGHT, ART_WIDTH } from "./layer-data";
import type { createMotionRuntime } from "./motion-runtime";

const route = [
  [1347, 405],
  [1192, 426],
  [1062, 429],
  [919, 436],
  [802, 451],
  [737, 469],
  [795, 488],
  [900, 495],
  [960, 521],
  [1013, 549],
  [992, 575],
  [1074, 601],
  [1155, 608],
  [1287, 626],
];

const vertexShader = `
  varying vec2 vRoute;
  void main() {
    vRoute = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vRoute;
  uniform float uTravel;
  uniform float uLit;
  void main() {
    float distanceFromCenter = abs(vRoute.y * 2.0 - 1.0);
    float distanceBehind = uTravel - vRoute.x;
    float revealed = smoothstep(-0.025, 0.025, distanceBehind);
    float front = exp(-abs(distanceBehind) * 26.0) * (1.0 - smoothstep(0.95, 1.0, uTravel));
    float core = exp(-distanceFromCenter * 10.0);
    float glow = exp(-distanceFromCenter * 4.5) * (1.0 - smoothstep(0.65, 1.0, distanceFromCenter));
    float trailingLight = mix(0.62, 0.52, uLit);
    float opacity = (core * 0.9 + glow * 0.55) * (revealed * trailingLight + front * 0.85);
    gl_FragColor = vec4(mix(vec3(1.0, 0.68, 0.31), vec3(1.0, 0.98, 0.76), core), opacity);
  }
`;

/** A narrow ribbon on the painted ground, with distance measured along the winding path. */
export default function WakeTrail({
  runtime,
}: {
  runtime: ReturnType<typeof createMotionRuntime>;
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTravel: { value: 0 }, uLit: { value: 0 } }),
    [],
  );
  const geometry = useMemo(() => {
    const z = 0.07;
    const f = (12 - z) / 1200;
    const curve = new CatmullRomCurve3(
      route.map(
        ([x, y]) =>
          new Vector3((x - ART_WIDTH / 2) * f, (ART_HEIGHT / 2 - y) * f, z),
      ),
    );
    const vertices: number[] = [];
    const indices: number[] = [];
    const uv: number[] = [];
    const segments = 120;
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const center = curve.getPoint(progress);
      const direction = curve.getTangent(progress);
      const width = 0.12 + progress * 0.08;
      const dx = -direction.y * width;
      const dy = direction.x * width;
      vertices.push(
        center.x - dx,
        center.y - dy,
        z,
        center.x + dx,
        center.y + dy,
        z,
      );
      uv.push(progress, 0, progress, 1);
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const ribbon = new BufferGeometry();
    ribbon.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    ribbon.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    ribbon.setIndex(indices);
    return ribbon;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (!material.current) return;
    const { uniforms } = material.current;
    uniforms.uTravel.value = runtime.waveRadius / 0.68;
    uniforms.uLit.value = runtime.awake;
    material.current.visible = runtime.waveRadius > 0;
  });
  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={2}
      />
    </mesh>
  );
}
