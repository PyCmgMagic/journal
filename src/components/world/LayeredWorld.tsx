import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  PerspectiveCamera,
  Vector3,
} from "three";
import { HOTSPOTS, ART_HEIGHT as H } from "./layer-data";
import {
  artworkLens,
  stoneTouch,
  lampBases,
  smoothRange,
} from "./artwork-space";
import type { createMotionRuntime } from "./motion-runtime";
import ArtworkSurface from "./ArtworkSurface";
import WakeTrail from "./WakeTrail";
import LampMotes from "./LampMotes";

type Runtime = ReturnType<typeof createMotionRuntime>;
interface Props {
  runtime: Runtime;
  reducedMotion: boolean;
  reading: boolean;
  readCount: number;
  onReady: () => void;
  onFallback: () => void;
}

function Atmosphere({
  runtime,
  readCount,
}: {
  runtime: Runtime;
  readCount: number;
}) {
  const points = useRef<any>(null);
  const stars = useRef<any>(null);
  const lines = useRef<any>(null);
  const particles = useMemo(() => {
    const a = new Float32Array(130 * 3);
    for (let i = 0; i < 130; i++) {
      a[i * 3] = (Math.sin(i * 127.1) * 0.5 + 0.5) * 16 - 8;
      a[i * 3 + 1] = (Math.sin(i * 311.7) * 0.5 + 0.5) * 8 - 3;
      a[i * 3 + 2] = 1.5;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(a, 3));
    return g;
  }, []);
  const sky = useMemo(() => {
    const a = [
      -3.62, 2.12, 1, -3.17, 2.81, 1, -2.44, 3.12, 1, -1.79, 3.58, 1, -2.45,
      2.61, 1, -1.36, 3.36, 1, -1.02, 3.58, 1, -0.71, 3.34, 1, -0.32, 3.58, 1,
      0.04, 3.45, 1,
    ];
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(a, 3));
    const segments = [];
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [3, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
    ];
    for (const [start, end] of edges)
      segments.push(
        ...a.slice(start * 3, start * 3 + 3),
        ...a.slice(end * 3, end * 3 + 3),
      );
    const l = new BufferGeometry();
    l.setAttribute("position", new Float32BufferAttribute(segments, 3));
    return { g, l };
  }, []);
  const pUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCharge: { value: 0 },
      uAttractor: {
        value: stoneTouch.clone(),
      },
    }),
    [],
  );
  const starUniforms = useMemo(() => ({ uLight: { value: 0 } }), []);
  useEffect(
    () => () => {
      particles.dispose();
      sky.g.dispose();
      sky.l.dispose();
    },
    [particles, sky],
  );
  useFrame(() => {
    if (points.current) {
      points.current.material.uniforms.uTime.value = runtime.time;
      points.current.material.uniforms.uCharge.value = runtime.charge;
    }
    if (stars.current) {
      stars.current.visible = runtime.stars > 0.01;
      stars.current.material.uniforms.uLight.value = runtime.stars;
      stars.current.geometry.setDrawRange(0, Math.min(10, 6 + readCount));
    }
    if (lines.current) {
      lines.current.visible = runtime.stars > 0.05;
      lines.current.material.opacity = runtime.stars * 0.75;
      lines.current.geometry.setDrawRange(
        0,
        (Math.min(10, 6 + readCount) - 1) * 2,
      );
    }
  });
  return (
    <>
      <points ref={points} geometry={particles}>
        <shaderMaterial
          transparent
          depthWrite={false}
          uniforms={pUniforms}
          vertexShader={`uniform float uTime;uniform float uCharge;uniform vec3 uAttractor;void main(){vec3 p=position;p.y+=sin(uTime*.6+position.x*2.)*.08;p=mix(p,uAttractor,uCharge*.84);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.+uCharge*2.;}`}
          fragmentShader={`uniform float uCharge;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(1.,.94,.72,(.10+uCharge*.85)*(1.-d*2.));}`}
        />
      </points>
      <points ref={stars} geometry={sky.g}>
        <shaderMaterial
          uniforms={starUniforms}
          vertexShader={`void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=28.;}`}
          fragmentShader={`uniform float uLight;void main(){vec2 p=abs(gl_PointCoord-.5);float d=length(p);float halo=exp(-d*10.)*(1.-smoothstep(.25,.5,d));float cross=exp(-min(p.x,p.y)*78.)*exp(-max(p.x,p.y)*7.5)*(1.-smoothstep(.30,.5,d));float core=1.-smoothstep(.03,.11,d);gl_FragColor=vec4(1.,.94,.70,max(core,max(cross,halo))*uLight);}`}
          transparent
          depthWrite={false}
        />
      </points>
      <lineSegments ref={lines} geometry={sky.l}>
        <lineBasicMaterial
          color="#f9e4b1"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}

function Scene({ runtime, reducedMotion, reading, readCount, onReady }: Props) {
  const { camera, size, invalidate, gl } = useThree();
  const point = useMemo(() => new Vector3(), []);
  const offsets = useRef(new Vector3());
  const host = useRef<HTMLElement | null>(null);
  const lastMetrics = useRef(0);

  useEffect(() => {
    host.current = gl.domElement.closest(".layer-world");
    runtime.invalidate = invalidate;
    onReady();
    return () => {
      runtime.invalidate = () => {};
    };
  }, [gl, invalidate, runtime]);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !size.height) return;
    camera.fov = (2 * Math.atan(H / 200 / artworkLens) * 180) / Math.PI;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);

  useFrame((_, delta) => {
    if (!size.height) return;
    runtime.quiet = reducedMotion;
    if (!runtime.paused && !reducedMotion) {
      runtime.time += Math.min(delta, 0.05) * (reading ? 0.12 : 1);
    }
    runtime.wind = reducedMotion
      ? 0
      : 0.75 +
        Math.sin(runtime.time * 0.61) * 0.23 +
        Math.sin(runtime.time * 0.23) * 0.14 +
        runtime.stoneLight * (1 - runtime.awake) * 0.9;
    const progress = reducedMotion ? 0 : runtime.scrollProgress;
    const approach =
      smoothRange(0.06, 0.54, progress) *
      (1 - 0.85 * smoothRange(0.63, 0.98, progress)) *
      (1 - 0.78 * runtime.returnToWorld) *
      (1 - runtime.readingBlend);
    const offset = offsets.current;
    const offsetX =
      (reducedMotion ? 0 : runtime.pointerX * 0.34) + runtime.focusX * 0.7;
    const offsetY = reducedMotion ? 0 : runtime.pointerY * 0.1;
    const offsetZ = -runtime.focusZoom;
    const damp = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 6);
    offset.x += (offsetX - offset.x) * damp;
    offset.y += (offsetY - offset.y) * damp;
    offset.z += (offsetZ - offset.z) * damp;
    const a = approach,
      b = 1 - a;
    const x =
      3 * b * b * a * 2.2 + 3 * b * a * a * 4.8 + a * a * a * 8.6 + offset.x;
    const y =
      3 * b * b * a * 0.4 + 3 * b * a * a * 1.3 + a * a * a * 2 + offset.y;
    const z =
      b * b * b * 12 +
      3 * b * b * a * 11 +
      3 * b * a * a * 7 +
      a * a * a * 4.8 +
      offset.z;
    camera.position.set(x, y, z);
    runtime.currentTarget.set(6.4 * a + offset.x, 2.8 * a + offset.y, -3.6 * a);
    camera.lookAt(runtime.currentTarget);
    camera.updateMatrixWorld();
    runtime.currentPosition.copy(camera.position);
    if (host.current) {
      host.current.parentElement?.style.setProperty(
        "--scene-approach",
        String(approach),
      );
      for (const id of Object.keys(HOTSPOTS)) {
        if (id === "stone") point.copy(stoneTouch);
        else {
          const index = id === "notes" ? 0 : id === "practice" ? 1 : 2;
          point.copy(lampBases[index]);
          point.y += (12 - point.z) * 0.025;
        }
        point.project(camera);
        const el = host.current.querySelector<HTMLElement>(
          `[data-hotspot="${id}"]`,
        );
        if (!el) continue;
        el.style.left = `${((point.x + 1) * size.width) / 2}px`;
        el.style.top = `${((-point.y + 1) * size.height) / 2}px`;
        const preview = document.querySelector<HTMLElement>(
          `[data-preview-category="${id}"]`,
        );
        if (preview) {
          const bounds = gl.domElement.getBoundingClientRect();
          const sx = bounds.left + ((point.x + 1) * bounds.width) / 2;
          const sy = bounds.top + ((1 - point.y) * bounds.height) / 2;
          preview.style.left = `${Math.min(innerWidth - 324, Math.max(16, sx + 28))}px`;
          preview.style.top = `${Math.max(110, sy - preview.offsetHeight - 30)}px`;
        }
        if (id !== "stone") {
          el.style.setProperty(
            "--lamp",
            String(
              id === "notes"
                ? runtime.lamp0
                : id === "practice"
                  ? runtime.lamp1
                  : runtime.lamp2,
            ),
          );
        }
      }
      host.current.style.setProperty("--charge", String(runtime.charge));
    }
    if (reading || runtime.time - lastMetrics.current > 0.2) {
      gl.domElement.dataset.camera = JSON.stringify(camera.position.toArray());
      gl.domElement.dataset.effects = JSON.stringify({
        charge: runtime.charge,
        stone: runtime.stoneLight,
        wave: runtime.waveRadius,
        lamps: [runtime.lamp0, runtime.lamp1, runtime.lamp2],
        stars: runtime.stars,
      });
      lastMetrics.current = runtime.time;
    }
    if (
      Math.abs(offsetX - offset.x) +
        Math.abs(offsetY - offset.y) +
        Math.abs(offsetZ - offset.z) >
      0.001
    )
      invalidate();
  }, -1);

  return (
    <>
      <ArtworkSurface runtime={runtime} />
      <WakeTrail runtime={runtime} />
      <Atmosphere runtime={runtime} readCount={readCount} />
      <LampMotes runtime={runtime} />
    </>
  );
}

class Boundary extends Component<
  { children: ReactNode; onFallback: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFallback();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function LayeredWorld(props: Props) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let onScreen = true;
    const update = () => {
      const active = !document.hidden && onScreen;
      setVisible(active);
      props.runtime.paused = !active;
    };
    const observer = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    const host = document.querySelector(".paint-stage");
    if (host) observer.observe(host);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [props.runtime]);
  return (
    <Boundary onFallback={props.onFallback}>
      <Canvas
        className="layer-canvas"
        resize={{ offsetSize: true }}
        camera={{ position: [0, 0, 12], near: 0.1, far: 100 }}
        dpr={[1, 1.3]}
        flat
        gl={{ alpha: true, antialias: true }}
        frameloop={
          !visible || props.reading || props.reducedMotion ? "demand" : "always"
        }
        fallback={<span>静态插画模式</span>}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </Boundary>
  );
}
