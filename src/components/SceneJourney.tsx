import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PostSummary } from "../lib/post-types";
import { categoryNames } from "../lib/post-types";
import type { createMotionRuntime } from "./world/motion-runtime";

type Stage = "arrival" | "station" | "logs";
interface Props {
  runtime: ReturnType<typeof createMotionRuntime>;
  posts: PostSummary[];
  reducedMotion: boolean;
  panelOpen: boolean;
  staticScene: boolean;
  awake: boolean;
  onArticle: (post: PostSummary) => void;
  onAll: () => void;
}

/** One native scroll timeline owns the whole journey, including the content handoff. */
export default function SceneJourney(props: Props) {
  const { runtime, reducedMotion, panelOpen } = props;
  const root = useRef<HTMLDivElement>(null);
  const journal = useRef<HTMLElement>(null);
  const progressLine = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<Stage>("arrival");
  const [stage, setStage] = useState<Stage>("arrival");

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const viewport = root.current!.closest<HTMLElement>(".world-viewport")!;
      const track = viewport.closest<HTMLElement>(".world-scroll")!;
      const hero = viewport.querySelector<HTMLElement>(".hero-copy")!;
      const note = root.current!.querySelector<HTMLElement>(".station-note")!;
      const progress = { value: 0 };
      const sync = () => {
        runtime.scrollProgress = progress.value;
        runtime.invalidate();
        if (progressLine.current)
          progressLine.current.style.transform = `scaleX(${progress.value})`;
        viewport.dataset.journeyProgress = progress.value.toFixed(3);
        const next: Stage =
          progress.value < 0.28
            ? "arrival"
            : progress.value < 0.78
              ? "station"
              : "logs";
        viewport.dataset.journeyStage = next;
        if (stageRef.current !== next) {
          stageRef.current = next;
          setStage(next);
        }
        // Invisible links must never receive focus or intercept pointer input.
        hero.inert = progress.value > 0.22;
        if (journal.current) journal.current.inert = progress.value < 0.8;
      };
      gsap.set(note, { autoAlpha: 0, y: reducedMotion ? 0 : 22 });
      gsap.set(journal.current, { autoAlpha: 0, y: reducedMotion ? 0 : 42 });
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          scrub: reducedMotion ? true : 0.45,
          invalidateOnRefresh: true,
        },
        onUpdate: sync,
      });
      timeline
        .to(progress, { value: 1, duration: 1 }, 0)
        .fromTo(
          hero,
          { autoAlpha: 1, y: 0 },
          { autoAlpha: 0, y: reducedMotion ? 0 : -42, duration: 0.19 },
          0.06,
        )
        .to(note, { autoAlpha: 1, y: 0, duration: 0.11 }, 0.28)
        .to(
          note,
          { autoAlpha: 0, y: reducedMotion ? 0 : -18, duration: 0.1 },
          0.62,
        )
        .to(journal.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.74);
      sync();
      return () => {
        hero.inert = false;
      };
    },
    { scope: root, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  function travelTo(progress: number, instant = false) {
    if (panelOpen) return;
    const track = root.current?.closest<HTMLElement>(".world-scroll");
    const viewport = track?.querySelector<HTMLElement>(".world-viewport");
    if (!track || !viewport) return;
    const distance = track.offsetHeight - viewport.offsetHeight;
    window.scrollTo({
      top:
        track.getBoundingClientRect().top +
        window.scrollY +
        distance * progress,
      behavior: reducedMotion || instant ? "instant" : "smooth",
    });
  }

  const stages = [
    { id: "arrival", name: "远望", position: 0 },
    { id: "station", name: "观测站", position: 0.52 },
    { id: "logs", name: "日志", position: 1 },
  ] as const;

  return (
    <div ref={root} className="scene-journey" inert={panelOpen}>
      <aside className="station-note" aria-hidden={stage !== "station"}>
        <p className="eyebrow">沿着好奇，慢慢靠近</p>
        <h2>
          这里，收留
          <br />
          每一次探索。
        </h2>
        <p>
          {props.staticScene
            ? "点亮一段思考，从一篇日志开始。"
            : props.awake
              ? "光已经亮起。沿着小径，找一篇想读的日志。"
              : "长按青色石碑，让这座观测站醒来。"}
        </p>
        <span>也可以继续向下，翻开最近的记录。</span>
      </aside>

      <section
        ref={journal}
        id="latest"
        className="scene-journal"
        aria-label="最近的探索日志"
        inert={stage !== "logs"}
      >
        <p className="eyebrow">来自观测站的记录</p>
        <div className="scene-journal-heading">
          <h2>
            最近的探索<span>.</span>
          </h2>
          <span aria-hidden="true">✳</span>
        </div>
        <div className="scene-journal-posts">
          {props.posts.slice(0, 3).map((post) => (
            <a
              key={post.slug}
              href={`/journal/${post.slug}/`}
              className="scene-journal-post"
              onClick={(event) => {
                event.preventDefault();
                props.onArticle(post);
              }}
            >
              <span className="post-date">
                {post.date} <span>{categoryNames[post.category]}</span>
              </span>
              <h3>
                {post.title}
                <span aria-hidden="true">↗</span>
              </h3>
              <p>{post.description}</p>
            </a>
          ))}
        </div>
        <div className="scene-journal-footer">
          <span>保持好奇，慢慢生长。</span>
          <a
            href="/articles/"
            onClick={(event) => {
              event.preventDefault();
              props.onAll();
            }}
          >
            全部文章 ↗
          </a>
        </div>
      </section>

      <div className="journey-navigation">
        <nav className="journey-stages" aria-label="探索旅程">
          <span className="journey-track" aria-hidden="true">
            <span ref={progressLine} />
          </span>
          {stages.map((item, index) => (
            <button
              key={item.id}
              aria-current={stage === item.id ? "step" : undefined}
              onClick={(event) => travelTo(item.position, event.detail === 0)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.name}
            </button>
          ))}
        </nav>
        <button
          className="journey-cue"
          onClick={(event) =>
            travelTo(
              stage === "arrival" ? 0.52 : stage === "station" ? 1 : 0,
              event.detail === 0,
            )
          }
        >
          {stage === "arrival"
            ? "向下滚动，走近一点"
            : stage === "station"
              ? "继续向下，翻开日志"
              : "向上滚动，重返远景"}
          <span aria-hidden="true">{stage === "logs" ? "↑" : "↓"}</span>
        </button>
      </div>
    </div>
  );
}
