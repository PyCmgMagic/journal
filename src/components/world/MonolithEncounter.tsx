import type { CSSProperties, PointerEvent } from "react";
import type { WorldPhase } from "../../lib/world-machine";
import { nearSigil } from "./encounter-framing";
import { ART_WIDTH, ART_HEIGHT } from "./layer-data";

interface Props {
  phase: WorldPhase;
  panelOpen: boolean;
  ready: boolean;
  onReady: () => void;
  onHoldStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onHoldEnd: () => void;
  onActivate: () => void;
}

// Positions are measured on monolith-encounter.png (1672 × 941).
const touch = { x: 1005, y: 586 };
const sparks = Array.from({ length: 23 }, (_, index) => {
  const angle = index * 2.39996;
  return {
    x: touch.x + Math.cos(angle) * (95 + ((index * 43) % 260)),
    y: touch.y + Math.sin(angle) * (65 + ((index * 19) % 215)),
    size: 1.5 + (index % 4) * 0.55,
  };
});

export default function MonolithEncounter({
  phase,
  panelOpen,
  ready,
  onReady,
  onHoldStart,
  onHoldEnd,
  onActivate,
}: Props) {
  return (
    <div className="monolith-encounter" data-ready={ready}>
      <div
        className="encounter-frame"
        style={{
          transformOrigin: `${(nearSigil.x / ART_WIDTH) * 100}% ${(nearSigil.y / ART_HEIGHT) * 100}%`,
        }}
      >
        <img src="/images/monolith-encounter.png" alt="" onLoad={onReady} />
        <svg
          className="encounter-effects"
          viewBox="0 0 1672 941"
          aria-hidden="true"
        >
          <defs>
            <filter
              id="engraving-light"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="4" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="hand-light">
              <stop offset="0" stopColor="#fff4a8" stopOpacity=".85" />
              <stop offset="1" stopColor="#fff4a8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            className="encounter-hand-light"
            cx={touch.x}
            cy={touch.y}
            r="140"
            fill="url(#hand-light)"
          />
          <g
            className="encounter-runes"
            fill="none"
            stroke="#fff2a3"
            strokeWidth="3"
            filter="url(#engraving-light)"
          >
            <path
              className="encounter-trace"
              pathLength="1"
              d="M1005 586 L1006 337"
            />
            {[586, 513, 453, 393].map((y, i) => (
              <circle
                key={y}
                className="encounter-node"
                cx="1006"
                cy={y}
                r={i === 0 ? 11 : 8}
                style={{ "--rune-delay": i * 0.21 } as CSSProperties}
              />
            ))}
            <g
              className="encounter-node"
              style={{ "--rune-delay": 0.68 } as CSSProperties}
            >
              <ellipse
                cx="1012"
                cy="296"
                rx="41"
                ry="43"
                transform="rotate(29 1012 296)"
              />
              <path d="M965 340 L1066 253" />
            </g>
          </g>
          <g
            className="encounter-sparks"
            fill="#ffefaa"
            filter="url(#engraving-light)"
          >
            {sparks.map(({ x, y, size }, i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={size}
                style={
                  {
                    "--toward-x": `${(touch.x - x) * 0.77}px`,
                    "--toward-y": `${(touch.y - y) * 0.77}px`,
                  } as CSSProperties
                }
              />
            ))}
          </g>
        </svg>
        <div
          className="encounter-touch"
          style={{
            left: `${(touch.x / 1672) * 100}%`,
            top: `${(touch.y / 941) * 100}%`,
          }}
        >
          <svg
            className="encounter-meter"
            viewBox="0 0 80 80"
            aria-hidden="true"
          >
            <circle cx="40" cy="40" r="34" />
            <circle
              className="encounter-meter-fill"
              cx="40"
              cy="40"
              r="34"
              pathLength="1"
              transform="rotate(-90 40 40)"
            />
            <circle className="encounter-meter-center" cx="40" cy="40" r="4" />
          </svg>
          <button
            className="encounter-hit"
            aria-label="长按石碑，唤醒观测站"
            inert={panelOpen || phase === "awake" || phase === "awakening"}
            onPointerDown={onHoldStart}
            onPointerUp={onHoldEnd}
            onPointerCancel={onHoldEnd}
            onLostPointerCapture={onHoldEnd}
            onClick={(event) => {
              if (event.detail === 0) onActivate();
            }}
          />
          <span className="encounter-instruction" aria-hidden="true">
            {phase === "awakening"
              ? "光已抵达"
              : phase === "charging"
                ? "继续按住"
                : "长按，唤醒观测站"}
          </span>
        </div>
      </div>
    </div>
  );
}
