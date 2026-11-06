import { useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  DoubleSide,
  Group,
  NoColorSpace,
  ShaderMaterial,
  TextureLoader,
  Vector3,
} from "three";
import { artworkPoint, smoothRange, stoneBase } from "./artwork-space";
import type { createMotionRuntime } from "./motion-runtime";
type Runtime = ReturnType<typeof createMotionRuntime>;

// Whole authored poses keep shoulders, hands, knees and clothing connected.
// Only the free scarf tip and a tiny upper-body breath deform continuously.
const vertex = `varying vec2 vUv;uniform float uTime;uniform float uWind;uniform float uStill;
void main(){vUv=uv;vec3 p=position;
float tail=(1.-smoothstep(.20,.52,uv.x))*smoothstep(.59,.67,uv.y)*(1.-smoothstep(.84,.89,uv.y));
p.y+=tail*(sin(uTime*2.3+uv.x*8.)*.013+sin(uTime*1.1+uv.x*5.)*.006)*uWind;
p.y+=sin(uTime*1.35)*.0035*pow(uv.y,3.)*uStill;
gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fragment = `varying vec2 vUv;uniform sampler2D uMap;uniform float uFrameA;uniform float uFrameB;uniform float uMix;
vec4 pose(float frame){vec2 cell=vec2(mod(frame,4.),2.-floor(frame/4.));return texture2D(uMap,(cell+clamp(vUv,vec2(.001),vec2(.999)))/vec2(4.,3.));}
void main(){vec4 a=pose(uFrameA),b=pose(uFrameB);float alpha=mix(a.a,b.a,uMix);if(alpha<.12)discard;
vec3 rgb=mix(a.rgb*a.a,b.rgb*b.a,uMix)/max(alpha,.001);gl_FragColor=vec4(rgb,alpha);}`;

/** A small autonomous action, not a character scrubbed backwards by the wheel. */
export default function Traveler({ runtime }: { runtime: Runtime }) {
  const root = useRef<Group>(null),
    material = useRef<ShaderMaterial>(null);
  const { gl } = useThree();
  const texture = useLoader(
    TextureLoader,
    "/images/layers/traveler-animation.webp",
  );
  texture.colorSpace = NoColorSpace;
  const path = useMemo(
    () =>
      new CatmullRomCurve3([
        artworkPoint(1250, 453),
        artworkPoint(1304, 447),
        stoneBase.clone().add(new Vector3(0.03, 0, 0.25)),
      ]),
    [],
  );
  const length = useMemo(() => path.getLength(), [path]);
  const point = useMemo(() => new Vector3(), []);
  const motion = useRef({
    started: false,
    elapsed: 0,
    distance: 0,
    gait: 0,
    reach: 0,
    measured: -1,
    frame: 8,
    settle: 1,
  });
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uFrameA: { value: 8 },
      uFrameB: { value: 8 },
      uMix: { value: 0 },
      uTime: { value: 0 },
      uWind: { value: 0 },
      uStill: { value: 1 },
    }),
    [texture],
  );

  useFrame((_, delta) => {
    if (!root.current || !material.current) return;
    const m = motion.current,
      u = material.current.uniforms;
    const frozen = runtime.paused || runtime.readingBlend > 0.03;
    const dt = frozen ? 0 : Math.min(delta, 0.05);
    const quiet = runtime.quiet;
    // A visit to the station invites him over once. Reversing the camera or
    // returning from an article does not rewind a human action.
    if (runtime.scrollProgress > 0.12 || runtime.charge > 0.02)
      m.started = true;
    const previous = m.distance;
    if (m.started && !quiet) m.elapsed = Math.min(2.65, m.elapsed + dt);
    const progress = smoothRange(0, 2.65, m.elapsed);
    m.distance = progress * length;
    const walking = m.started && m.elapsed < 2.65 && !quiet;
    const speed = dt ? (m.distance - previous) / dt : 0;
    m.gait = walking ? Math.min(1, speed / 0.5) : 0;
    const reachTarget = quiet
      ? 0
      : Math.max(runtime.charge, runtime.stoneLight * (1 - runtime.awake));
    // Complete the approach before reaching. Lower the hand on cancellation,
    // and let the waking timeline keep it raised until the light has spread.
    m.reach +=
      ((walking ? 0 : reachTarget) - m.reach) *
      (quiet ? 1 : 1 - Math.exp(-dt * 10));
    path.getPointAt(progress, point);
    point.y = -0.3 - 0.22 * point.z + 0.012;
    root.current.position.copy(point);
    if (walking) {
      const phase = (m.distance / 1.1) * 8;
      m.frame = Math.floor(phase) % 8;
      m.settle = 0;
      u.uFrameA.value = m.frame;
      u.uFrameB.value = (m.frame + 1) % 8;
      // A short exposure overlap softens the change without double limbs.
      u.uMix.value = smoothRange(0.82, 1, phase - Math.floor(phase));
    } else {
      m.settle = Math.min(1, m.settle + dt / 0.16);
      const pose = 8 + Math.min(3, m.reach * 3.2);
      u.uFrameA.value = m.settle < 1 ? m.frame : Math.floor(pose);
      u.uFrameB.value = m.settle < 1 ? 8 : Math.min(11, Math.ceil(pose));
      u.uMix.value =
        m.settle < 1 ? smoothRange(0, 1, m.settle) : pose - Math.floor(pose);
    }
    if (quiet) {
      u.uFrameA.value = 8;
      u.uFrameB.value = 8;
      u.uMix.value = 0;
    }
    u.uTime.value = runtime.time;
    u.uWind.value = quiet ? 0 : runtime.wind;
    u.uStill.value = quiet || walking ? 0 : 1;
    if (runtime.time - m.measured > 0.12 || quiet || frozen) {
      m.measured = runtime.time;
      gl.domElement.dataset.traveler = JSON.stringify({
        mode: walking ? "walking" : m.reach > 0.03 ? "reaching" : "standing",
        distance: m.distance,
        gait: m.gait,
        reach: m.reach,
        frame: u.uFrameA.value,
        nextFrame: u.uFrameB.value,
        blend: u.uMix.value,
        wind: u.uWind.value,
        time: runtime.time,
        position: point.toArray(),
      });
    }
  });
  // Normalized atlas: 368 px human height, hip x=224, soles y=420.
  const unit = 1.42 / 368;
  return (
    <group ref={root}>
      <mesh position={[0, 0.008, 0]} rotation={[-1.354, 0, 0]}>
        <planeGeometry args={[0.43, 0.23]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(.24,.25,.31,exp(-d*d*3.)*(1.-smoothstep(.7,1.,d))*.22);}"
        />
      </mesh>
      <mesh position={[(192 - 224) * unit, (420 - 224) * unit, 0.018]}>
        <planeGeometry args={[384 * unit, 448 * unit, 32, 40]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
