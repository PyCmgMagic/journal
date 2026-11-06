import { useEffect, useRef, useState, type PointerEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Category } from "../../lib/world-machine";
import type { createMotionRuntime } from "./motion-runtime";

interface Props {
  runtime: ReturnType<typeof createMotionRuntime>;
  reducedMotion: boolean;
  reading: boolean;
  activeCategory: Category | null;
  readCount: number;
  stoneAvailable: boolean;
  onReady: (available: boolean) => void;
  onCategory: (category: Category) => void;
  onHover: (category: Category | null) => void;
  onHoldStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onHoldEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onActivate: () => void;
}
const lamps = [
  { id: "notes", label: "学习笔记", x: 737, y: 459 },
  { id: "practice", label: "实践记录", x: 960, y: 506 },
  { id: "reading", label: "阅读随想", x: 1155, y: 585 },
] as const;
const stars = [
  [554, 245],
  [584, 197],
  [631, 179],
  [681, 103],
  [751, 94],
  [657, 248],
  [794, 167],
  [821, 135],
];

/** Complete illustrations with a damped pointer framing and one reversible cut. */
export default function IllustratedWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const overview = useRef<HTMLDivElement>(null);
  const encounter = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(false);
  const readyCallback = useRef(props.onReady);
  readyCallback.current = props.onReady;
  const preferences = useRef({
    reduced: props.reducedMotion,
    reading: props.reading,
  });
  preferences.current = {
    reduced: props.reducedMotion,
    reading: props.reading,
  };

  useEffect(() => {
    let active = true;
    const images = [
      ...host.current!.querySelectorAll<HTMLImageElement>(".scene-frame-image"),
    ];
    Promise.all(images.map((image) => image.decode()))
      .then(() => {
        if (!active) return;
        setAvailable(true);
        readyCallback.current(true);
      })
      .catch(() => {
        if (!active) return;
        host.current!.dataset.sceneMode = "fallback";
        readyCallback.current(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useGSAP(
    () => {
      const root = host.current!,
        runtime = props.runtime;
      const inner = root.querySelector<HTMLElement>(".frame-world")!;
      const parallax = root.querySelector<HTMLElement>(".frame-parallax")!;
      const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
      const blend = { value: 0 },
        pointer = { x: 0, y: 0 };
      let target = 0,
        pointerTargetX = NaN,
        pointerTargetY = NaN,
        pointerHeld = false;
      const fadeOut = gsap.parseEase("power1.in"),
        fadeIn = gsap.parseEase("power2.out");
      const placePreview = () => {
        if (runtime.hoverIndex < 0) return;
        const id = lamps[runtime.hoverIndex].id;
        const preview = document.querySelector<HTMLElement>(
          `[data-preview-category="${id}"]`,
        );
        const element = root.querySelector<HTMLElement>(
          `[data-hotspot="${id}"]`,
        )!;
        if (preview) {
          const r = element.getBoundingClientRect();
          preview.style.left = `${Math.max(16, Math.min(innerWidth - 324, r.left + 28))}px`;
          preview.style.top = `${Math.max(110, r.top - preview.offsetHeight - 30)}px`;
        }
      };
      const paintPointer = () => {
        const scale =
          preferences.current.reduced || !finePointer.matches ? 1 : 1.032;
        parallax.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0) scale(${scale})`;
        placePreview();
      };
      const quickX = gsap.quickTo(pointer, "x", {
        duration: 0.65,
        ease: "power3.out",
        onUpdate: paintPointer,
      });
      const quickY = gsap.quickTo(pointer, "y", {
        duration: 0.65,
        ease: "power3.out",
        onUpdate: paintPointer,
      });
      const paintShot = () => {
        const nearFrame = blend.value >= 0.45;
        const moving = Math.abs(blend.value - target) > 0.00001;
        const quiet = preferences.current.reduced;
        root.dataset.shot = nearFrame ? "encounter" : "overview";
        root.dataset.transitioning = String(moving);
        root.dataset.transitionProgress = blend.value.toFixed(4);
        root.closest<HTMLElement>(".world-viewport")!.dataset.sceneShot =
          root.dataset.shot;
        const exit = fadeOut(Math.min(1, blend.value / 0.45));
        const enter = fadeIn(Math.max(0, (blend.value - 0.45) / 0.55));
        overview.current!.style.opacity = String(quiet ? 1 : 1 - 0.88 * exit);
        encounter.current!.style.opacity = String(
          quiet ? 1 : 0.12 + 0.88 * enter,
        );
        overview.current!.style.transform = `translate3d(0,${quiet ? 0 : -8 * exit}px,0)`;
        encounter.current!.style.transform = `translate3d(0,${quiet ? 0 : 8 * (1 - enter)}px,0)`;
        const blocked =
          moving || runtime.readingBlend > 0.001 || runtime.focusX < -0.01;
        overview.current!.inert = nearFrame || blocked;
        encounter.current!.inert = !nearFrame || blocked;
        overview.current!.setAttribute("aria-hidden", String(nearFrame));
        encounter.current!.setAttribute("aria-hidden", String(!nearFrame));
      };
      // This single paused tween can play/reverse from its current value. No
      // onComplete swaps or competing timelines survive a direction change.
      const transition = gsap.to(blend, {
        value: 1,
        duration: 0.44,
        ease: "none",
        paused: true,
        onUpdate: paintShot,
        onComplete: paintShot,
        onReverseComplete: paintShot,
      });
      let near = false;
      let wakeSeen = false,
        wakeOverview = false,
        wakeScroll = 0;
      let revision = runtime.sceneRevision;
      const render = () => {
        const p = runtime.scrollProgress;
        if (runtime.returnToWorld >= 0.5 && !wakeSeen) {
          wakeSeen = true;
          wakeOverview = true;
          wakeScroll = p;
        }
        if (
          wakeOverview &&
          runtime.awake >= 0.99 &&
          (Math.abs(p - wakeScroll) > 0.05 ||
            runtime.sceneRevision !== revision)
        )
          wakeOverview = false;
        revision = runtime.sceneRevision;
        // Separate enter/leave boundaries prevent wheel noise flipping the shot.
        if (!near && p >= 0.3 && p < 0.76) near = true;
        else if (near && (p < 0.25 || p >= 0.8)) near = false;
        const ritualCloseup =
          runtime.charge > 0.001 && runtime.returnToWorld < 0.5;
        const closeup =
          available &&
          runtime.readingBlend < 0.01 &&
          runtime.focusX > -1 &&
          !wakeOverview &&
          (near || ritualCloseup);
        const next = closeup ? 1 : 0;
        const changed = next !== target;
        target = next;
        root.dataset.shotTarget = closeup ? "encounter" : "overview";
        if (preferences.current.reduced || document.hidden) {
          transition.pause().progress(target);
        } else if (changed) {
          if (target) transition.play();
          else transition.reverse();
        }
        paintShot();
        root.dataset.sceneMode = available
          ? "frames"
          : (root.dataset.sceneMode ?? "loading");
        root.style.setProperty("--charge", String(runtime.charge));
        root.style.setProperty(
          "--stone-light",
          String(Math.max(runtime.stoneLight, runtime.charge * 0.8)),
        );
        root.style.setProperty("--stars", String(runtime.stars));
        root.style.setProperty("--reading-scene", String(runtime.readingBlend));
        inner.style.transform = `translate3d(${runtime.focusX}px,0,0)`;
        const quiet =
          preferences.current.reduced ||
          !finePointer.matches ||
          document.hidden;
        const reading =
          preferences.current.reading ||
          runtime.readingBlend > 0.001 ||
          runtime.focusX < -0.01;
        const held =
          !reading && (runtime.hoverIndex >= 0 || runtime.charge > 0.001);
        if (quiet) {
          quickX.tween.pause();
          quickY.tween.pause();
          pointer.x = pointer.y = 0;
          pointerTargetX = pointerTargetY = NaN;
          paintPointer();
        } else if (held) {
          quickX.tween.pause();
          quickY.tween.pause();
          pointerHeld = true;
        } else {
          const x = reading ? 0 : runtime.pointerX * 18,
            y = reading ? 0 : -runtime.pointerY * 10;
          if (pointerHeld || x !== pointerTargetX) {
            quickX(x);
            pointerTargetX = x;
          }
          if (pointerHeld || y !== pointerTargetY) {
            quickY(y);
            pointerTargetY = y;
          }
          pointerHeld = false;
        }
        const glyph = root.querySelector<SVGPathElement>(".frame-glyph")!;
        glyph.style.strokeDashoffset = String(
          1 - Math.max(runtime.charge, runtime.stoneLight),
        );
        const progress = Math.max(0, Math.min(1, runtime.waveRadius / 0.68));
        const trail = root.querySelector<SVGPathElement>(".frame-trail")!;
        trail.style.strokeDashoffset = String(1 - progress);
        trail.style.opacity = runtime.waveRadius > 0 ? ".8" : "0";
        const wave = root.querySelector<SVGEllipseElement>(".frame-wave")!;
        wave.setAttribute("rx", String(1100 * progress));
        wave.setAttribute("ry", String(290 * progress));
        wave.style.opacity = String(
          runtime.waveRadius > 0 ? Math.sin(progress * Math.PI) * 0.7 : 0,
        );
        for (const [index, lamp] of lamps.entries()) {
          const element = root.querySelector<HTMLElement>(
            `[data-hotspot="${lamp.id}"]`,
          )!;
          const light = Math.max(
            [runtime.lamp0, runtime.lamp1, runtime.lamp2][index],
            runtime.hoverIndex === index ? 0.85 : 0,
          );
          element.style.setProperty("--lamp", String(light));
        }
        placePreview();
        root.dataset.effects = JSON.stringify({
          charge: runtime.charge,
          stone: runtime.stoneLight,
          wave: runtime.waveRadius,
          lamps: [runtime.lamp0, runtime.lamp1, runtime.lamp2],
          stars: runtime.stars,
        });
      };
      runtime.invalidate = render;
      const recenter = () => {
        runtime.pointerX = runtime.pointerY = 0;
        render();
      };
      paintPointer();
      render();
      window.addEventListener("resize", render);
      window.addEventListener("blur", recenter);
      document.addEventListener("visibilitychange", render);
      finePointer.addEventListener("change", render);
      return () => {
        runtime.invalidate = () => {};
        window.removeEventListener("resize", render);
        window.removeEventListener("blur", recenter);
        document.removeEventListener("visibilitychange", render);
        finePointer.removeEventListener("change", render);
      };
    },
    {
      scope: host,
      dependencies: [props.runtime, available],
      revertOnUpdate: true,
    },
  );

  useEffect(() => {
    props.runtime.invalidate();
  }, [props.reducedMotion, props.reading, props.runtime]);

  function approach() {
    const track = host.current?.closest<HTMLElement>(".world-scroll");
    if (!track) return;
    props.runtime.sceneRevision += 1;
    window.scrollTo({
      top: track.offsetTop + (track.offsetHeight - innerHeight) * 0.52,
      behavior: props.reducedMotion ? "instant" : "smooth",
    });
  }
  return (
    <div
      ref={host}
      className="paint-stage frames-stage"
      data-shot="overview"
      aria-label="异星观测站插画"
    >
      <div className="paint-position">
        <div className="paint-inner frame-world">
          <div className="frame-parallax">
            <div ref={overview} className="scene-frame overview-frame">
              <img
                className="paint-image scene-frame-image"
                src="/images/observatory-world.webp"
                alt="紫色云海上的漂浮岛，小人物坐在观测站旁，三盏路灯沿小径延伸"
                fetchPriority="high"
              />
              <svg
                className="frame-effects"
                viewBox="0 0 1672 941"
                aria-hidden="true"
              >
                <path
                  className="frame-trail"
                  pathLength="1"
                  d="M1347 405 C1150 427 926 423 737 469 C698 489 914 482 960 521 C1040 551 945 567 1074 601 L1287 626"
                />
                <ellipse
                  className="frame-wave"
                  cx="1347"
                  cy="425"
                  rx="0"
                  ry="0"
                />
                <g className="frame-stars">
                  <path d="M554 245 L584 197 L631 179 L681 103 L751 94 M631 179 L657 248" />
                  {stars
                    .slice(0, Math.min(8, 6 + props.readCount))
                    .map(([x, y]) => (
                      <path
                        key={x}
                        className="star-mark"
                        d={`M${x} ${y - 7} Q${x + 1} ${y - 1} ${x + 7} ${y} Q${x + 1} ${y + 1} ${x} ${y + 7} Q${x - 1} ${y + 1} ${x - 7} ${y} Q${x - 1} ${y - 1} ${x} ${y - 7}`}
                      />
                    ))}
                </g>
              </svg>
              {lamps.map((lamp) => (
                <div
                  key={lamp.id}
                  className={`paint-lamp ${props.activeCategory === lamp.id ? "is-active" : ""}`}
                  data-hotspot={lamp.id}
                  style={{
                    left: `${(lamp.x / 1672) * 100}%`,
                    top: `${(lamp.y / 941) * 100}%`,
                  }}
                >
                  <span className="lamp-aura" aria-hidden="true" />
                  <button
                    className="world-label"
                    data-category={lamp.id}
                    aria-label={lamp.label}
                    onPointerEnter={() => props.onHover(lamp.id)}
                    onPointerLeave={() => props.onHover(null)}
                    onFocus={() => props.onHover(lamp.id)}
                    onBlur={() => props.onHover(null)}
                    onClick={() => props.onCategory(lamp.id)}
                  >
                    {lamp.label}
                  </button>
                </div>
              ))}
              <button
                className="approach-control"
                onClick={approach}
                aria-label="走近石碑"
              >
                ✧<span>走近石碑</span>
              </button>
            </div>
            <div ref={encounter} className="scene-frame encounter-frame" inert>
              <img
                className="paint-image scene-frame-image"
                src="/images/monolith-encounter.webp"
                alt="观测站近景：红围巾旅行者伸手触碰青色石碑"
              />
              <svg
                className="frame-effects"
                viewBox="0 0 1672 941"
                aria-hidden="true"
              >
                <path
                  className="frame-glyph"
                  pathLength="1"
                  d="M1005 586 L1007 513 L1007 454 L1007 393 L1008 344 C970 348 947 313 981 281 C1013 254 1040 267 1033 303 C1030 323 1019 337 1008 344"
                />
                <g className="charge-sparks">
                  {Array.from({ length: 16 }, (_, i) => {
                    const angle = i * 2.4;
                    return (
                      <circle
                        key={i}
                        cx={1005 + Math.cos(angle) * (68 + i * 7)}
                        cy={586 + Math.sin(angle) * (50 + i * 5)}
                        r={i % 3 === 0 ? 2.6 : 1.5}
                      />
                    );
                  })}
                </g>
              </svg>
              <div
                className="paint-stone"
                data-hotspot="stone"
                style={{
                  left: `${(1005 / 1672) * 100}%`,
                  top: `${(586 / 941) * 100}%`,
                }}
              >
                <span className="stone-aura" aria-hidden="true" />
                <button
                  className="monolith-control"
                  aria-label="长按唤醒观测站"
                  disabled={!props.stoneAvailable}
                  onPointerDown={props.onHoldStart}
                  onPointerUp={props.onHoldEnd}
                  onPointerCancel={props.onHoldEnd}
                  onLostPointerCapture={props.onHoldEnd}
                  onClick={(e) => {
                    if (e.detail === 0) props.onActivate();
                  }}
                >
                  ✧
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="frame-reading-panorama" aria-hidden="true" />
    </div>
  );
}
