import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  NoColorSpace,
  PerspectiveCamera,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  TextureLoader,
  Vector3,
} from "three";
import {
  LAYERS,
  HOTSPOTS,
  ART_WIDTH as W,
  ART_HEIGHT as H,
  type ArtLayer,
} from "./layer-data";
import type { Category } from "../../lib/world-machine";
import type { createMotionRuntime } from "./motion-runtime";
import WakeTrail from "./WakeTrail";
import {
  encounterScale,
  farSigil,
  nearSigil,
  matchStart,
  smoothRange,
} from "./encounter-framing";

type Runtime = ReturnType<typeof createMotionRuntime>;
type PlanetFraming = { x: number; y: number; z: number };
const terrainLayers = LAYERS.filter(
  (layer) =>
    layer.id === "island" ||
    layer.id === "back-cliff" ||
    (layer.z >= 0.55 && layer.z <= 0.78),
);
const distantLayers = LAYERS.filter((layer) => !terrainLayers.includes(layer));
interface Props {
  runtime: Runtime;
  reducedMotion: boolean;
  reading: boolean;
  activeCategory: Category | null;
  readCount: number;
  onReady: () => void;
  onFallback: () => void;
}
const vert = `varying vec2 vUv; varying vec2 vPixel; uniform float uTime; uniform float uKind; uniform float uResponse;
void main(){vUv=uv;vPixel=vec2(uv.x,1.-uv.y);vec3 p=position;
if(uKind==4.){p.y+=sin(uTime*2.2+uv.x*90.)*.012*smoothstep(.57,.62,uv.x);}
if(uKind==8.){p.x+=sin(uTime*.8+uv.y*14.)*.008*(.4+uResponse);}
gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const frag = `varying vec2 vUv;varying vec2 vPixel;uniform sampler2D uMap;uniform float uKind;uniform float uCharge;uniform float uStone;uniform float uWave;uniform float uLamp;uniform float uTime;uniform float uHover;uniform float uOpacity;
void main(){vec4 c=texture2D(uMap,vUv);if(c.a<.4)discard;float dist=length((vPixel-vec2(.807,.44))*vec2(1.0,.48));
if(uKind==1.){float ground=smoothstep(-.02,.025,c.g-c.r);float awake=1.-smoothstep(uWave-.012,uWave+.012,dist);float rim=exp(-abs(dist-uWave)*190.)*step(.001,uWave)*(1.-smoothstep(.6,.8,uWave));c.rgb=mix(c.rgb,c.rgb*vec3(.96,1.06,.99),awake*.7*ground);c.rgb+=vec3(.25,.28,.08)*rim*ground;}
if(uKind==3.){
  vec2 p=vPixel*vec2(1672.,941.);
  vec2 q=(p-vec2(1336.,179.))*vec2(1.,.86);
  float ring=abs(length(q)-15.3);
  float stem=abs(p.x-1336.5)+(1.-step(197.,p.y)*step(p.y,285.))*30.;
  float distanceToRune=min(ring,stem);
  float reveal=smoothstep(0.,22.,p.y-(290.-uCharge*127.));
  float glow=exp(-distanceToRune*.36)*max(uStone*.9,uCharge*reveal);
  c.rgb=mix(c.rgb,vec3(1.,.94,.57),glow*.92);
}
if(uKind>=5.&&uKind<=7.){c.rgb*=.74+.26*uLamp;c.rgb+=vec3(.20,.13,.02)*(uLamp*.55+uHover*.7);}
gl_FragColor=vec4(c.rgb,uOpacity);}`;

function geometry(layer: ArtLayer) {
  const f = (12 - layer.z) / 12;
  const shape = new Shape(
    layer.outline.map(
      ([x, y]) =>
        ({ x: ((x - W / 2) / 100) * f, y: ((H / 2 - y) / 100) * f }) as any,
    ),
  );
  const g = new ShapeGeometry(shape);
  const p = g.getAttribute("position");
  const uv = [];
  for (let i = 0; i < p.count; i++)
    uv.push(
      ((p.getX(i) / f) * 100 + W / 2) / W,
      ((p.getY(i) / f) * 100 + H / 2) / H,
    );
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return g;
}
function fullLayer(
  id: string,
  z: number,
  source: ArtLayer["source"] = "original",
): ArtLayer {
  return {
    id,
    z,
    kind: 0,
    source,
    outline: [
      [-500, -300],
      [W + 500, -300],
      [W + 500, H + 300],
      [-500, H + 300],
    ],
  };
}

function Layer({
  layer,
  texture,
  runtime,
  planetFraming,
}: {
  layer: ArtLayer;
  texture: any;
  runtime: Runtime;
  planetFraming?: { current: PlanetFraming };
}) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const g = useMemo(() => geometry(layer), [layer]);
  const replacedInCloseup = layer.id === "traveler" || layer.id === "scarf";
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uTime: { value: 0 },
      uKind: { value: layer.kind },
      uCharge: { value: 0 },
      uStone: { value: 0 },
      uWave: { value: -1 },
      uLamp: { value: 0 },
      uHover: { value: 0 },
      uResponse: { value: 0 },
      uOpacity: { value: 1 },
    }),
    [texture, layer.kind],
  );
  useEffect(() => () => g.dispose(), [g]);
  useFrame(() => {
    if (!material.current || !mesh.current) return;
    const u = material.current.uniforms;
    if (replacedInCloseup) {
      u.uOpacity.value =
        1 - smoothRange(0.42, matchStart, runtime.encounterProgress);
      mesh.current.visible = u.uOpacity.value > 0;
    }
    u.uTime.value = runtime.time;
    u.uCharge.value = runtime.charge;
    u.uStone.value = runtime.stoneLight;
    u.uWave.value = runtime.waveRadius;
    u.uResponse.value = runtime.response;
    u.uLamp.value =
      layer.kind === 5
        ? runtime.lamp0
        : layer.kind === 6
          ? runtime.lamp1
          : runtime.lamp2;
    u.uHover.value =
      runtime.hoverIndex === layer.kind - 5
        ? 1
        : runtime.selectedIndex === layer.kind - 5
          ? 0.5
          : 0;
    mesh.current.position.x =
      layer.kind === 2
        ? Math.sin(runtime.time * 0.13) * 0.015 * (1 + runtime.response)
        : 0;
    if (planetFraming)
      mesh.current.position.set(
        planetFraming.current.x,
        planetFraming.current.y,
        planetFraming.current.z,
      );
  });
  return (
    <mesh ref={mesh} geometry={g} position={[0, 0, layer.z]}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        transparent={replacedInCloseup}
        depthWrite={!replacedInCloseup}
        side={2}
      />
    </mesh>
  );
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
          vertexShader={`uniform float uTime;uniform float uCharge;void main(){vec3 p=position;p.y+=sin(uTime*.6+position.x*2.)*.08;p=mix(p,vec3(4.52,2.33,1.5),uCharge*.84);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.+uCharge*2.;}`}
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

/** Small ground pools react independently to each lamp; the art remains visible through them. */
function LampPool({
  id,
  index,
  runtime,
}: {
  id: "notes" | "practice" | "reading";
  index: number;
  runtime: Runtime;
}) {
  const material = useRef<ShaderMaterial>(null);
  const [x, y] = HOTSPOTS[id];
  const z = 0.12,
    f = (12 - z) / 12;
  const uniforms = useMemo(() => ({ uLight: { value: 0 } }), []);
  useFrame(() => {
    if (material.current) {
      const light =
        index === 0
          ? runtime.lamp0
          : index === 1
            ? runtime.lamp1
            : runtime.lamp2;
      material.current.uniforms.uLight.value =
        light * 0.55 +
        (runtime.hoverIndex === index
          ? 0.7
          : runtime.selectedIndex === index
            ? 0.3
            : 0);
    }
  });
  return (
    <mesh
      position={[((x - W / 2) / 100) * f, ((H / 2 - y - 16) / 100) * f, z]}
      scale={[1.25, 0.44, 1]}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec2 vUv;uniform float uLight;void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(1.,.89,.43,pow(max(0.,1.-d),1.8)*uLight);}`}
      />
    </mesh>
  );
}

function Scene({ runtime, reducedMotion, reading, readCount, onReady }: Props) {
  const [original, sky, island, planet] = useLoader(TextureLoader, [
    "/images/observatory-world.png",
    "/images/layers/sky-clean.png",
    "/images/layers/island-clean.png",
    "/images/layers/planet-cutout.png",
  ]);
  for (const t of [original, sky, island, planet]) t.colorSpace = NoColorSpace;
  const background = useMemo(() => fullLayer("sky", -26), []);
  const planetFraming = useRef<PlanetFraming>({ x: 0, y: 0, z: LAYERS[0].z });
  const terrain = useRef<Group>(null);
  const { camera, size, invalidate, gl } = useThree();
  const point = useMemo(() => new Vector3(), []);
  const smooth = useRef({ x: 0, y: 0, z: 0 });
  const host = useRef<HTMLElement | null>(null);
  const viewportSize = useRef({ width: 0, height: 0 });
  const lastMetrics = useRef(0);
  useEffect(() => {
    host.current = gl.domElement.closest(".layer-world");
    const viewport = host.current?.closest<HTMLElement>(".world-viewport");
    const observer = new ResizeObserver(([entry]) => {
      viewportSize.current = entry.contentRect;
      invalidate();
    });
    if (viewport) observer.observe(viewport);
    runtime.invalidate = invalidate;
    onReady();
    return () => {
      runtime.invalidate = () => {};
      observer.disconnect();
    };
  }, [gl, invalidate, runtime]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.fov = (2 * Math.atan(H / 200 / 12) * 180) / Math.PI;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useFrame((_, delta) => {
    if (!runtime.paused && !reducedMotion)
      runtime.time += Math.min(delta, 0.05) * (reading ? 0.12 : 1);
    const s = reducedMotion ? 0 : runtime.scrollProgress;
    // Travel first along the path, then settle beside the station as the logbook opens.
    const approach = Math.min(1, s / 0.72);
    const settle = Math.max(0, (s - 0.72) / 0.28);
    const curve = approach * approach * (3 - 2 * approach);
    const pushIn = Math.min(1, Math.max(0, (s - 0.09) / 0.38));
    const returnWide = Math.min(1, Math.max(0, (0.78 - s) / 0.13));
    const lean =
      pushIn *
      pushIn *
      (3 - 2 * pushIn) *
      returnWide *
      (1 - runtime.stoneLight);
    // ScrollTrigger already smooths the route. Damp only the independent pointer and panel offsets.
    const offsetX =
      (reducedMotion ? 0 : runtime.pointerX * 0.42) + runtime.focusX;
    const offsetY = reducedMotion ? 0 : runtime.pointerY * 0.18;
    const offsetZ = -runtime.focusZoom;
    const mix = reducedMotion ? 1 : 1 - Math.exp(-delta * 5);
    smooth.current.x += (offsetX - smooth.current.x) * mix;
    smooth.current.y += (offsetY - smooth.current.y) * mix;
    smooth.current.z += (offsetZ - smooth.current.z) * mix;
    const x = smooth.current.x + curve * 1.45 + lean * 1.6 - settle * 0.18;
    const y = smooth.current.y + curve * 0.22;
    const z =
      smooth.current.z + 12 - curve * 1.75 - lean * 1.05 + settle * 0.24;
    camera.position.set(x, y, z);
    let aimX = x * 0.82 + lean * 0.36;
    let aimY = curve * 0.54 + lean * 0.43;
    const approachToSigil = smoothRange(
      0,
      matchStart,
      runtime.encounterProgress,
    );
    const viewport = viewportSize.current;
    const planetDepth = LAYERS[0].z;
    planetFraming.current.x = 0;
    planetFraming.current.y = 0;
    planetFraming.current.z = planetDepth;
    terrain.current?.position.set(0, 0, 0);
    terrain.current?.scale.setScalar(1);
    if (approachToSigil > 0 && viewport.height > 0) {
      // At the cut both illustrations project the engraved circle to the same screen position.
      const mobile = viewport.width <= 760;
      const artworkScale = Math.max(viewport.width / W, viewport.height / H);
      const matchHeight = mobile ? viewport.height : size.height;
      const sourceScale =
        (artworkScale *
          encounterScale(runtime.encounterProgress) *
          nearSigil.radius) /
        farSigil.radius;
      const depthScale = (12 - farSigil.depth) / 12;
      const unitsPerPixel = depthScale / (100 * sourceScale);
      const anchorX = (nearSigil.x - W * (mobile ? 0.601 : 0.5)) * artworkScale;
      const anchorY = nearSigil.y * artworkScale - matchHeight / 2;
      const matchX =
        ((farSigil.x - W / 2) * depthScale) / 100 - anchorX * unitsPerPixel;
      const matchY =
        ((H / 2 - farSigil.y) * depthScale) / 100 + anchorY * unitsPerPixel;
      const matchZ =
        farSigil.depth +
        (matchHeight * (12 - farSigil.depth)) / (H * sourceScale);

      // Keep the distant planet from ballooning during the dolly. Match the left ring tip
      // to the close illustration as the camera arrives at the engraving.
      const closePixelScale =
        artworkScale * encounterScale(runtime.encounterProgress);
      const planetSizeRatio = 1.03;
      const distanceToPlanet =
        (matchHeight * (12 - planetDepth)) /
        (H * closePixelScale * planetSizeRatio);
      const planetUnitsPerPixel =
        (12 - planetDepth) / (1200 * closePixelScale * planetSizeRatio);
      const ringTipX = anchorX + (277 - nearSigil.x) * closePixelScale;
      const ringTipY = anchorY + (453 - nearSigil.y) * closePixelScale;
      const planetArtScale = (12 - planetDepth) / 1200;
      planetFraming.current.x =
        approachToSigil *
        (matchX +
          ringTipX * planetUnitsPerPixel -
          (610 - W / 2) * planetArtScale);
      planetFraming.current.y =
        approachToSigil *
        (matchY -
          ringTipY * planetUnitsPerPixel -
          (H / 2 - 269) * planetArtScale);
      planetFraming.current.z =
        planetDepth +
        approachToSigil * (matchZ - distanceToPlanet - planetDepth);

      // Reframe the station and the ground beneath it as a unit, using the tip of the scope.
      const scopeDepth = 0.57;
      const scopeUnitsPerPixel =
        (H * (matchZ - scopeDepth)) / (1200 * matchHeight);
      const scopeArtScale = (12 - scopeDepth) / 1200;
      const terrainScale =
        (closePixelScale * 1.34 * scopeUnitsPerPixel) / scopeArtScale;
      const scopeX = anchorX + (334 - nearSigil.x) * closePixelScale;
      const scopeY = anchorY + (542 - nearSigil.y) * closePixelScale;
      terrain.current?.scale.setScalar(
        1 + (terrainScale - 1) * approachToSigil,
      );
      terrain.current?.position.set(
        approachToSigil *
          (matchX +
            scopeX * scopeUnitsPerPixel -
            (1056 - W / 2) * scopeArtScale * terrainScale),
        approachToSigil *
          (matchY -
            scopeY * scopeUnitsPerPixel -
            (H / 2 - 261) * scopeArtScale * terrainScale),
        approachToSigil * (1 - terrainScale) * scopeDepth,
      );
      camera.position.x += (matchX - camera.position.x) * approachToSigil;
      camera.position.y += (matchY - camera.position.y) * approachToSigil;
      camera.position.z += (matchZ - camera.position.z) * approachToSigil;
      aimX += (matchX - aimX) * approachToSigil;
      aimY += (matchY - aimY) * approachToSigil;
    }
    camera.lookAt(aimX, aimY, 0);
    camera.updateMatrixWorld();
    terrain.current?.updateMatrixWorld();
    runtime.currentPosition.copy(camera.position);
    runtime.currentTarget.set(aimX, aimY, 0);
    if (host.current) {
      for (const [id, [px, py, depth]] of Object.entries(HOTSPOTS)) {
        const f = (12 - depth) / 12;
        point.set(((px - W / 2) / 100) * f, ((H / 2 - py) / 100) * f, depth);
        if (id !== "stone" && terrain.current)
          point.applyMatrix4(terrain.current.matrixWorld);
        point.project(camera);
        const el = host.current.querySelector<HTMLElement>(
          `[data-hotspot="${id}"]`,
        );
        if (el) {
          el.style.left = `${((point.x + 1) * size.width) / 2}px`;
          el.style.top = `${((-point.y + 1) * size.height) / 2}px`;
          if (id !== "stone")
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
    if (
      gl.domElement &&
      (reading || runtime.time - lastMetrics.current > 0.2)
    ) {
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
      Math.abs(offsetX - smooth.current.x) +
        Math.abs(offsetY - smooth.current.y) +
        Math.abs(offsetZ - smooth.current.z) >
      0.001
    )
      invalidate();
  }, -1);
  const renderLayer = (l: ArtLayer) => (
    <Layer
      key={l.id}
      layer={l}
      texture={
        l.source === "island"
          ? island
          : l.source === "planet"
            ? planet
            : original
      }
      runtime={runtime}
      planetFraming={l.id === "planet-and-rings" ? planetFraming : undefined}
    />
  );
  return (
    <>
      <Layer layer={background} texture={sky} runtime={runtime} />
      {distantLayers.map(renderLayer)}
      <group ref={terrain}>
        {terrainLayers.map(renderLayer)}
        {(["notes", "practice", "reading"] as const).map((id, index) => (
          <LampPool key={id} id={id} index={index} runtime={runtime} />
        ))}
        <WakeTrail runtime={runtime} />
      </group>
      <Atmosphere runtime={runtime} readCount={readCount} />
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
