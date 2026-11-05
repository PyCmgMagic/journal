import { lazy, Suspense, useState, type PointerEvent } from "react";
import type { Category } from "../../lib/world-machine";
import type { createMotionRuntime } from "./motion-runtime";

const LayeredWorld = lazy(() => import("./LayeredWorld"));

interface Props {
  runtime: ReturnType<typeof createMotionRuntime>;
  reducedMotion: boolean;
  reading: boolean;
  activeCategory: Category | null;
  readCount: number;
  onReady: (available: boolean) => void;
  onCategory: (category: Category) => void;
  onHover: (category: Category | null) => void;
  onHoldStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onHoldEnd: () => void;
  onActivate: () => void;
}

const lamps: { id: Category; label: string; left: string; top: string }[] = [
  { id: "notes", label: "学习笔记", left: "44%", top: "46%" },
  { id: "practice", label: "实践记录", left: "57.4%", top: "51.7%" },
  { id: "reading", label: "阅读随想", left: "69.1%", top: "60%" },
];

export default function IllustratedWorld(props: Props) {
  const { onReady, onCategory, onHover, onHoldStart, onHoldEnd, onActivate } =
    props;
  const [mode, setMode] = useState("loading");
  return (
    <div className="paint-stage" aria-label="异星观测站插画">
      <div className="paint-position">
        <div className="paint-inner layer-world" data-scene-mode={mode}>
          <img
            className="paint-image scene-poster"
            src="/images/observatory-world.png"
            alt="紫色群山与云海上的漂浮岛，一位旅行者在观测站望向星球"
          />
          <Suspense fallback={null}>
            <LayeredWorld
              {...props}
              onReady={() => {
                setMode("webgl");
                onReady(true);
              }}
              onFallback={() => {
                setMode("fallback");
                onReady(false);
              }}
            />
          </Suspense>
          {lamps.map((lamp) => (
            <div
              className={`paint-lamp ${props.activeCategory === lamp.id ? "is-active" : ""}`}
              data-hotspot={lamp.id}
              key={lamp.id}
              style={{ left: lamp.left, top: lamp.top }}
            >
              <span className="lamp-aura" aria-hidden="true" />
              <button
                className="world-label"
                data-category={lamp.id}
                aria-label={lamp.label}
                onPointerEnter={() => onHover(lamp.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(lamp.id)}
                onBlur={() => onHover(null)}
                onClick={() => onCategory(lamp.id)}
              >
                {lamp.label}
              </button>
            </div>
          ))}
          {mode !== "fallback" && (
            <div
              className="paint-stone"
              data-hotspot="stone"
              style={{ left: "80.7%", top: "22%" }}
            >
              <span className="stone-aura" aria-hidden="true" />
              <button
                className="monolith-control"
                aria-label="长按唤醒观测站"
                onPointerDown={onHoldStart}
                onPointerUp={onHoldEnd}
                onPointerCancel={onHoldEnd}
                onLostPointerCapture={onHoldEnd}
                onClick={(event) => {
                  if (event.detail === 0) onActivate();
                }}
              >
                ✧
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
