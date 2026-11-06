import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  DoubleSide,
  NoColorSpace,
  TextureLoader,
  Vector3,
  ShaderMaterial,
} from "three";
import { artworkPoint, lampBases } from "./artwork-space";
import type { createMotionRuntime } from "./motion-runtime";
type Runtime = ReturnType<typeof createMotionRuntime>;
const crops = {
  lamp: [222, 176, 450, 540],
  grass: [575, 65, 1220, 535],
  rock: [45, 795, 685, 1170],
  coral: [740, 640, 1165, 1170],
  tree: [12, 5, 780, 1007],
  book: [790, 320, 1534, 1007],
};
const vertex = `varying vec2 vUv;uniform float uTime;uniform float uWind;uniform float uPhase;void main(){vUv=uv;vec3 p=position;p.x+=(sin(uTime*1.8+uv.y*3.-uPhase)*.03+sin(uTime*.7-uPhase)*.014)*pow(uv.y,2.)*uWind;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fragment = `varying vec2 vUv;uniform sampler2D uMap;uniform vec4 uCrop;uniform float uLamp;uniform float uLight;void main(){vec4 c=texture2D(uMap,mix(uCrop.xy,uCrop.zw,vUv));if(c.a<.3)discard;if(uLamp>.5){float glass=smoothstep(.27,.4,vUv.y)*(1.-smoothstep(.88,.96,vUv.y));c.rgb=mix(c.rgb*.74,c.rgb+vec3(.14,.1,.02),uLight)*glass+c.rgb*(1.-glass);}gl_FragColor=c;}`;
function Prop({
  runtime,
  texture,
  kind,
  base,
  height,
  index = -1,
}: {
  runtime: Runtime;
  texture: any;
  kind: keyof typeof crops;
  base: Vector3;
  height: number;
  index?: number;
}) {
  const crop = crops[kind],
    width = (height * (crop[2] - crop[0])) / (crop[3] - crop[1]);
  const landmark = kind === "tree" || kind === "book";
  const atlasWidth = landmark ? 1536 : 1280,
    atlasHeight = landmark ? 1024 : 1280;
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uCrop: {
        value: [
          crop[0] / atlasWidth,
          1 - crop[3] / atlasHeight,
          crop[2] / atlasWidth,
          1 - crop[1] / atlasHeight,
        ],
      },
      uTime: { value: 0 },
      uWind: { value: 0 },
      uPhase: { value: base.x * 0.7 + base.z * 0.3 },
      uLamp: { value: kind === "lamp" ? 1 : 0 },
      uLight: { value: 0 },
    }),
    [texture],
  );
  useFrame((_, delta) => {
    const active = material.current?.uniforms ?? uniforms;
    active.uTime.value = runtime.time;
    active.uWind.value =
      runtime.wind *
      (kind === "grass"
        ? 1
        : kind === "coral"
          ? 0.45
          : kind === "tree"
            ? 0.5
            : 0);
    if (index >= 0)
      active.uLight.value +=
        (Math.min(
          1,
          [runtime.lamp0, runtime.lamp1, runtime.lamp2][index] +
            (runtime.hoverIndex === index
              ? 0.8
              : runtime.selectedIndex === index
                ? 0.3
                : 0),
        ) -
          active.uLight.value) *
        (runtime.quiet ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 9));
  });
  return (
    <mesh position={[base.x, base.y + height / 2, base.z + 0.035]}>
      <planeGeometry args={[width, height, 8, 16]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        side={DoubleSide}
      />
    </mesh>
  );
}
export default function MeadowProps({ runtime }: { runtime: Runtime }) {
  const texture = useLoader(TextureLoader, "/images/layers/meadow-props.webp");
  const landmarks = useLoader(
    TextureLoader,
    "/images/layers/landmark-atlas.webp",
  );
  texture.colorSpace = NoColorSpace;
  landmarks.colorSpace = NoColorSpace;
  const plants = useMemo(
    () =>
      [
        { kind: "grass" as const, x: 1280, y: 427, h: 0.48 },
        { kind: "grass" as const, x: 1430, y: 435, h: 0.66 },
        { kind: "grass" as const, x: 1470, y: 445, h: 0.55 },
        { kind: "grass" as const, x: 1220, y: 449, h: 0.38 },
        { kind: "grass" as const, x: 1090, y: 460, h: 0.28 },
        { kind: "grass" as const, x: 800, y: 505, h: 0.29 },
        { kind: "rock" as const, x: 1540, y: 510, h: 0.7 },
        { kind: "rock" as const, x: 1520, y: 462, h: 0.85 },
        { kind: "grass" as const, x: 1490, y: 450, h: 0.48 },
        { kind: "coral" as const, x: 1600, y: 462, h: 0.9 },
        { kind: "coral" as const, x: 1635, y: 520, h: 1.05 },
        { kind: "rock" as const, x: 690, y: 525, h: 0.42 },
        { kind: "grass" as const, x: 1150, y: 576, h: 0.28 },
        { kind: "rock" as const, x: 1000, y: 490, h: 0.27 },
        { kind: "rock" as const, x: 1180, y: 510, h: 0.33 },
        { kind: "rock" as const, x: 895, y: 565, h: 0.23 },
        { kind: "grass" as const, x: 725, y: 560, h: 0.3 },
        { kind: "grass" as const, x: 1260, y: 635, h: 0.24 },
        { kind: "rock" as const, x: 220, y: 1080, h: 1.05 },
        { kind: "grass" as const, x: 270, y: 1030, h: 0.4 },
        { kind: "coral" as const, x: 1630, y: 850, h: 1.45 },
      ].map((p) => ({ ...p, base: artworkPoint(p.x, p.y, 0.02) })),
    [],
  );
  return (
    <>
      <Prop
        runtime={runtime}
        texture={landmarks}
        kind="tree"
        base={artworkPoint(1570, 425)}
        height={4.7}
      />
      <Prop
        runtime={runtime}
        texture={landmarks}
        kind="book"
        base={artworkPoint(1510, 785)}
        height={1.6}
      />
      {lampBases.map((base, index) => (
        <Prop
          key={index}
          runtime={runtime}
          texture={texture}
          kind="lamp"
          base={base}
          height={(12 - base.z) * 0.028}
          index={index}
        />
      ))}
      {plants.map((p, i) => (
        <Prop
          key={"plant" + i}
          runtime={runtime}
          texture={texture}
          kind={p.kind}
          base={p.base}
          height={p.h}
        />
      ))}
    </>
  );
}
