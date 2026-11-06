import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { lampBases } from "./artwork-space";
import type { createMotionRuntime } from "./motion-runtime";

/** A few light seeds gather at the lamp the reader is exploring. */
export default function LampMotes({
  runtime,
}: {
  runtime: ReturnType<typeof createMotionRuntime>;
}) {
  const ref = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        Array.from({ length: 27 }, (_, i) =>
          i % 3 === 0 ? Math.floor(i / 3) : 0,
        ),
        3,
      ),
    );
    return g;
  }, []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmount: { value: 0 },
      uBase: { value: lampBases[0].clone().add(new Vector3(0, 0.3, 0)) },
    }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    const m = ref.current?.material as ShaderMaterial | undefined;
    if (!m) return;
    const u = m.uniforms;
    u.uTime.value = runtime.time;
    const active = runtime.hoverIndex >= 0 && !runtime.quiet;
    if (runtime.quiet) u.uAmount.value = 0;
    else
      u.uAmount.value +=
        ((active ? 1 : 0) - u.uAmount.value) *
        (1 - Math.exp(-Math.min(delta, 0.05) * 7));
    if (active) {
      const target = lampBases[runtime.hoverIndex];
      u.uBase.value.lerp(target, 1 - Math.exp(-Math.min(delta, 0.05) * 8));
    }
  });
  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`uniform float uTime;uniform float uAmount;uniform vec3 uBase;varying float vAlpha;void main(){float i=position.x;float t=uTime*.65+i*2.4;vec3 p=uBase+vec3(sin(t)*(.13+i*.025),.2+fract(uTime*.11+i*.173)*.75,cos(t)*.18);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=3.5+2.*sin(i);vAlpha=uAmount*(.45+.45*sin(t*.7));}`}
        fragmentShader={`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(1.,.91,.62,exp(-d*d*18.)*vAlpha);}`}
      />
    </points>
  );
}
