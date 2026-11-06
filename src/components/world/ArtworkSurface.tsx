import { useEffect, useMemo, useRef } from "react";
import MeadowProps from "./MeadowProps";
import Traveler from "./Traveler";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  DoubleSide,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  PlaneGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  TextureLoader,
  Vector3,
} from "three";
import { ART_HEIGHT as H, ART_WIDTH as W } from "./layer-data";
import {
  artworkPoint,
  sourcePoint,
  stoneBase,
  stationBase,
  stoneHeight,
  stationHeight,
  smoothRange,
} from "./artwork-space";
import type { createMotionRuntime } from "./motion-runtime";
type Runtime = ReturnType<typeof createMotionRuntime>;
function surface(z: number) {
  const g = new PlaneGeometry(W, H, 100, 64),
    p = g.getAttribute("position"),
    v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + W / 2,
      y = H / 2 - p.getY(i);
    sourcePoint(x, y, z, v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// The meadow and its cliff share vertices at the rim. The cliff extends
// vertically from the same ground coordinates, so an orbit cannot open a gap.
const rim = [
  [438, 480],
  [510, 495],
  [600, 516],
  [680, 530],
  [800, 566],
  [900, 608],
  [1000, 637],
  [1120, 670],
  [1200, 702],
  [1340, 690],
  [1450, 665],
  [1570, 637],
  [1672, 615],
];
function rimY(x: number) {
  for (let i = 1; i < rim.length; i++)
    if (x <= rim[i][0]) {
      const [a, b] = [rim[i - 1], rim[i]],
        t = Math.max(0, (x - a[0]) / (b[0] - a[0]));
      return a[1] + (b[1] - a[1]) * t;
    }
  return rim.at(-1)![1];
}
function terrainSurface() {
  // Real ground continues outside the authored crop, so approaching the
  // station cannot expose the straight edge of a texture card.
  const width = W + 2200;
  const g = new PlaneGeometry(width, H, 220, 110),
    p = g.getAttribute("position"),
    uv = g.getAttribute("uv");
  const detail = new Float32Array(p.count),
    v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + width / 2,
      y = H / 2 - p.getY(i),
      lip = rimY(x);
    const back =
      x < 600
        ? 480 - ((x - 438) * 30) / 162
        : x < 1100
          ? 450 - ((x - 600) * 30) / 500
          : x < 1400
            ? 420 - ((x - 1100) * 20) / 300
            : 400;
    const depth = artworkPoint(x, Math.min(Math.max(y, back), lip)).z;
    sourcePoint(x, y, depth, v);
    p.setXYZ(i, v.x, v.y, v.z);
    uv.setXY(i, x / W, 1 - y / H);
    detail[i] =
      smoothRange(438, 448, x) *
      smoothRange(back - 2, back + 4, y) *
      (1 - smoothRange(lip - 6, lip, y));
  }
  g.setAttribute("groundWeight", new Float32BufferAttribute(detail, 1));
  g.computeVertexNormals();
  return g;
}
const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `varying vec2 vUv; uniform sampler2D uMap; uniform vec4 uCrop; uniform float uCharge; uniform float uStone; uniform float uKind;
float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
void main(){vec2 sampleUv=vec2(mix(uCrop.x,uCrop.z,vUv.x),mix(uCrop.y,uCrop.w,vUv.y));vec4 c=texture2D(uMap,sampleUv);if(c.a<.25)discard;
if(uKind<.5){vec2 p=vUv;float ring=abs(length((p-vec2(.47,.658))*vec2(1.,2.05))-.125);float line=abs(p.x-.465)+(1.-step(.35,p.y)*step(p.y,.6))*.2;
float node=abs(length((p-vec2(.65,.255))*vec2(1.,2.05))-.019);
float branch=min(segment(p,vec2(.65,.255),vec2(.465,.30)),segment(p,vec2(.465,.30),vec2(.465,.36)));
c.rgb=mix(c.rgb,vec3(.22,.40,.42),max(1.-smoothstep(.001,.003,node),1.-smoothstep(.0005,.002,branch))*.8);
float reveal=smoothstep(0.,.045,p.y-(.24+uCharge*.49));float glyph=exp(-min(min(ring,line),min(node,branch))*220.)*max(uStone,uCharge*(1.-reveal));c.rgb=mix(c.rgb,vec3(1.,.95,.65),glyph*.95);}
gl_FragColor=c;}`;
function Cutout({
  runtime,
  texture,
  crop,
  height,
  base,
  kind,
}: {
  runtime: Runtime;
  texture: any;
  crop: number[];
  height: number;
  base: Vector3;
  kind: number;
}) {
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uCrop: {
        value: [
          crop[0] / 1448,
          1 - crop[3] / 1086,
          crop[2] / 1448,
          1 - crop[1] / 1086,
        ],
      },
      uKind: { value: kind },
      uTime: { value: 0 },
      uCharge: { value: 0 },
      uStone: { value: 0 },
    }),
    [texture],
  );
  const width = (height * (crop[2] - crop[0])) / (crop[3] - crop[1]);
  useFrame(() => {
    const active =
      (mesh.current?.material as ShaderMaterial | undefined)?.uniforms ??
      uniforms;
    active.uTime.value = runtime.time;
    active.uCharge.value = runtime.charge;
    active.uStone.value = runtime.stoneLight;
  });
  return (
    <mesh ref={mesh} position={[base.x, base.y + height / 2, base.z + 0.025]}>
      <planeGeometry args={[width, height, 24, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        side={DoubleSide}
        depthWrite
      />
    </mesh>
  );
}
export default function ArtworkSurface({ runtime }: { runtime: Runtime }) {
  const material = useRef<ShaderMaterial>(null);
  const cloudMesh = useRef<Mesh>(null);
  const [planet, terrain, atlas, clouds, meadow] = useLoader(TextureLoader, [
    "/images/layers/planet-cutout.webp",
    "/images/layers/island-ground.webp",
    "/images/layers/observatory-atlas.webp",
    "/images/layers/clouds-alpha.webp",
    "/images/layers/meadow-detail.webp",
  ]);
  for (const texture of [planet, terrain, atlas, clouds, meadow])
    texture.colorSpace = NoColorSpace;
  meadow.wrapS = meadow.wrapT = RepeatWrapping;
  meadow.anisotropy = 8;
  const geometries = useMemo(
    () => ({
      sky: surface(-55),
      planet: surface(-28),
      clouds: surface(-9),
      terrain: terrainSurface(),
    }),
    [],
  );
  const ground = useMemo(
    () => ({
      uArt: { value: terrain },
      uMeadow: { value: meadow },
      uWave: { value: -1 },
      uAwake: { value: 0 },
      uTime: { value: 0 },
    }),
    [terrain],
  );
  useEffect(
    () => () => Object.values(geometries).forEach((g) => g.dispose()),
    [geometries],
  );
  useFrame(() => {
    const cloudExtent = 1.35 + runtime.readingBlend * 1.4;
    cloudMesh.current?.scale.set(cloudExtent, cloudExtent, 1);
    if (cloudMesh.current) {
      cloudMesh.current.position.x = runtime.quiet
        ? 0
        : Math.sin(runtime.time * 0.055) * 0.22;
      cloudMesh.current.position.y = runtime.quiet
        ? 0
        : Math.sin(runtime.time * 0.081) * 0.035;
    }
    const active = material.current?.uniforms ?? ground;
    active.uWave.value = runtime.waveRadius;
    active.uAwake.value = runtime.awake;
    active.uTime.value = runtime.time;
  });
  return (
    <>
      <mesh geometry={geometries.sky} scale={[2, 2, 1]}>
        <shaderMaterial
          vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="varying vec2 vUv;uniform sampler2D uMap;void main(){vec3 c=mix(vec3(.735,.63,.825),vec3(.76,.675,.84),vUv.y);float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);gl_FragColor=vec4(c+(grain-.5)*.006,1.);}"
        />
      </mesh>
      <mesh geometry={geometries.planet}>
        <shaderMaterial
          transparent
          side={DoubleSide}
          uniforms={{ uMap: { value: planet } }}
          vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="varying vec2 vUv;uniform sampler2D uMap;void main(){vec4 c=texture2D(uMap,vUv);if(c.a<.2)discard;gl_FragColor=c;}"
        />
      </mesh>
      <mesh
        ref={cloudMesh}
        geometry={geometries.clouds}
        scale={[1.35, 1.35, 1]}
      >
        <shaderMaterial
          transparent
          side={DoubleSide}
          uniforms={{ uMap: { value: clouds } }}
          vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="varying vec2 vUv;uniform sampler2D uMap;void main(){vec4 c=texture2D(uMap,vUv);if(c.a<.12)discard;gl_FragColor=c;}"
        />
      </mesh>
      <mesh geometry={geometries.terrain}>
        <shaderMaterial
          ref={material}
          transparent
          side={DoubleSide}
          uniforms={ground}
          vertexShader={`varying vec2 vUv;varying vec3 vWorld;varying float vGround;attribute float groundWeight;void main(){vUv=uv;vWorld=position;vGround=groundWeight;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`varying vec2 vUv;varying vec3 vWorld;varying float vGround;uniform sampler2D uArt;uniform sampler2D uMeadow;uniform float uWave;uniform float uAwake;void main(){vec2 artUv=vUv;if(vUv.x>1.){float t=abs(mod((vUv.x-1.)/.22,2.)-1.);artUv.x=.78+.22*t;artUv.y-=(1.-t)*.085;}vec4 painted=texture2D(uArt,artUv);float alpha=max(painted.a,vGround);if(alpha<.25)discard;vec3 grass=texture2D(uMeadow,vec2((vWorld.x+6.)/11.,(vWorld.z+8.)/11.)).rgb;vec3 c=mix(painted.a<.2?grass:painted.rgb,grass,vGround);float d=length((vec2(vUv.x,1.-vUv.y)-vec2(.808,.447))*vec2(1.,.48));float rim=exp(-abs(d-uWave)*190.)*step(.001,uWave)*(1.-smoothstep(.6,.8,uWave));c+=vec3(.3,.24,.06)*rim*vGround;c*=mix(vec3(1.),vec3(.98,1.03,1.),uAwake*vGround);gl_FragColor=vec4(c,alpha);}`}
        />
      </mesh>{" "}
      <Cutout
        runtime={runtime}
        texture={atlas}
        crop={[68, 8, 568, 1075]}
        base={stoneBase}
        height={stoneHeight}
        kind={0}
      />
      <Cutout
        runtime={runtime}
        texture={atlas}
        crop={[598, 8, 1448, 550]}
        base={stationBase}
        height={stationHeight}
        kind={1}
      />
      <Traveler runtime={runtime} />
      <MeadowProps runtime={runtime} />
    </>
  );
}
