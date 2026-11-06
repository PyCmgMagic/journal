import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createMotionRuntime } from "./world/motion-runtime";
import IllustratedWorld from "./world/IllustratedWorld";
import SceneJourney from "./SceneJourney";
import { useWorldStore } from "../state/world-store";
import {
  categoryNames,
  type PostArticle,
  type PostSummary,
} from "../lib/post-types";
import type { Category } from "../lib/world-machine";

type Panel =
  "category" | "all" | "archive" | "about" | "search" | "article" | null;
type Props = { posts: PostSummary[] };
type ScenePosition = {
  scrollY: number;
  category: Category | null;
  pointerX: number;
  pointerY: number;
};
const storageKey = "alien-journal:v1";

function Arrow({ back = false }: { back?: boolean }) {
  return <span aria-hidden="true">{back ? "←" : "↗"}</span>;
}

export default function JournalApp({ posts }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const runtime = useMemo(createMotionRuntime, []);
  const chargeTween = useRef<gsap.core.Tween | null>(null);
  const wakeTimeline = useRef<gsap.core.Timeline | null>(null);
  const cameraTween = useRef<gsap.core.Tween | null>(null);
  const worldTween = useRef<gsap.core.Tween | null>(null);
  const panelTween = useRef<gsap.core.Tween | null>(null);
  const pendingClose = useRef<{ scene: ScenePosition; home: boolean } | null>(
    null,
  );
  const heldPointer = useRef<number | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const articleCache = useRef(new Map<string, PostArticle>());
  const request = useRef<AbortController | null>(null);
  const sceneSnapshot = useRef<ScenePosition>({
    scrollY: 0,
    category: null as Category | null,
    pointerX: 0,
    pointerY: 0,
  });
  const panelOrigin = useRef({ x: 900, y: 400 });
  const liveView = useRef({
    panel: null as Panel,
    category: null as Category | null,
  });
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [staticScene, setStaticScene] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [panelRevision, setPanelRevision] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [hover, setHover] = useState<Category | null>(null);
  const [previewPoint, setPreviewPoint] = useState({ x: 50, y: 350 });
  const [article, setArticle] = useState<PostArticle | null>(null);
  const [articleError, setArticleError] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState("");
  const phase = useWorldStore((s) => s.phase);
  const readSlugs = useWorldStore((s) => s.readSlugs);
  const dispatch = useWorldStore((s) => s.dispatch);
  liveView.current = { panel, category };
  const panelOpen = panel !== null;
  useEffect(() => {
    runtime.selectedIndex =
      category === "notes"
        ? 0
        : category === "practice"
          ? 1
          : category === "reading"
            ? 2
            : -1;
    runtime.invalidate();
  }, [category, runtime]);

  useEffect(() => {
    setMounted(true);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      const read = Array.isArray(saved.readSlugs)
        ? saved.readSlugs.filter((id: unknown) =>
            posts.some((p) => p.slug === id),
          )
        : [];
      useWorldStore.setState({ readSlugs: read, phase: "idle" });
    } catch {
      /* Storage is optional; navigation still works. */
    }
    setStorageLoaded(true);
    return () => {
      media.removeEventListener("change", updateMotion);
    };
  }, [posts, runtime]);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ readSlugs }));
    } catch {
      /* Private modes may disable storage. */
    }
  }, [phase, readSlugs, storageLoaded]);

  const syncRitual = useCallback(() => {
    const style = root.current?.style;
    style?.setProperty("--charge", String(runtime.charge));
    runtime.invalidate();
  }, [runtime]);

  const cancelCharge = useCallback(() => {
    if (useWorldStore.getState().phase !== "charging") return;
    heldPointer.current = null;
    chargeTween.current?.kill();
    chargeTween.current = gsap.to(runtime, {
      charge: 0,
      duration: reducedMotion ? 0 : 0.25,
      onUpdate: syncRitual,
    });
    dispatch({ type: "charge.cancel" });
  }, [runtime, reducedMotion, dispatch, syncRitual]);

  const { contextSafe } = useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger, useGSAP);
      return () => {
        chargeTween.current?.kill();
        wakeTimeline.current?.kill();
        worldTween.current?.kill();
        panelTween.current?.kill();
        gsap.killTweensOf(runtime);
        request.current?.abort();
        if (previewTimer.current) clearTimeout(previewTimer.current);
      };
    },
    { scope: root },
  );

  const activate = contextSafe(() => {
    if (
      liveView.current.panel ||
      ["awakening", "awake"].includes(useWorldStore.getState().phase)
    )
      return;
    chargeTween.current?.kill();
    if (useWorldStore.getState().phase !== "charging")
      dispatch({ type: "charge.begin" });
    if (useWorldStore.getState().phase !== "charging") return;
    heldPointer.current = null;
    runtime.charge = 1;
    syncRitual();
    dispatch({ type: "charge.complete" });
    wakeTimeline.current?.kill();
    runtime.waveRadius = 0;
    const t = (seconds: number) => (reducedMotion ? 0 : seconds);
    wakeTimeline.current = gsap
      .timeline({
        onUpdate: syncRitual,
        onComplete: () => dispatch({ type: "awakening.complete" }),
      })
      .to(runtime, { stoneLight: 1, duration: t(0.3) }, 0)
      .to(runtime, { returnToWorld: 1, duration: 0 }, t(1.0))
      .to(runtime, { waveRadius: 0.68, duration: t(2.4), ease: "none" }, t(1.8))
      .to(runtime, { lamp0: 1, duration: t(0.34) }, t(2.7))
      .to(runtime, { lamp1: 1, duration: t(0.34) }, t(3.2))
      .to(runtime, { lamp2: 1, duration: t(0.34) }, t(3.8))
      .to(runtime, { awake: 1, duration: t(0.65) }, t(3.8))
      .to(runtime, { stars: 1, duration: t(0.65) }, t(4.2))
      .to(runtime, { charge: 0, duration: t(0.45) }, t(1.0));
  });

  const startHold = contextSafe((event: PointerEvent<HTMLButtonElement>) => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      panel ||
      useWorldStore.getState().phase !== "idle"
    )
      return;
    event.preventDefault();
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: "charge.begin" });
    if (useWorldStore.getState().phase !== "charging") return;
    heldPointer.current = event.pointerId;
    chargeTween.current?.kill();
    chargeTween.current = gsap.to(runtime, {
      charge: 1,
      duration: 1.1 * (1 - runtime.charge),
      ease: "none",
      onUpdate: syncRitual,
      onComplete: activate,
    });
  });

  function endHold(event: PointerEvent<HTMLButtonElement>) {
    if (heldPointer.current === event.pointerId) cancelCharge();
  }

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelCharge();
        if (panel) closePanel();
      }
    };
    const cancelHidden = () => {
      if (document.hidden) cancelCharge();
    };
    window.addEventListener("blur", cancelCharge);
    window.addEventListener("scroll", cancelCharge, { passive: true });
    document.addEventListener("visibilitychange", cancelHidden);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("blur", cancelCharge);
      window.removeEventListener("scroll", cancelCharge);
      document.removeEventListener("visibilitychange", cancelHidden);
      document.removeEventListener("keydown", escape);
    };
  }, [cancelCharge, panel]);

  function rememberTrigger() {
    if (liveView.current.panel) return;
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const rect = triggerRef.current?.getBoundingClientRect();
    panelOrigin.current = rect
      ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      : { x: innerWidth * 0.7, y: innerHeight * 0.5 };
    sceneSnapshot.current = {
      scrollY: window.scrollY,
      category: liveView.current.category,
      pointerX: runtime.pointerX,
      pointerY: runtime.pointerY,
    };
    history.replaceState(
      {
        ...history.state,
        alienJournal: true,
        kind: null,
        scene: sceneSnapshot.current,
        origin: panelOrigin.current,
      },
      "",
      location.href,
    );
  }
  function writeHistory(
    kind: Panel,
    cat?: Category | null,
    slug?: string,
    scene = sceneSnapshot.current,
  ) {
    const paths: Partial<Record<NonNullable<Panel>, string>> = {
      all: "/articles/",
      archive: "/archive/",
      about: "/about/",
    };
    const url =
      kind === "article"
        ? `/journal/${slug}/`
        : kind === "category"
          ? `/?category=${cat}`
          : kind
            ? (paths[kind] ?? "/?view=search")
            : "/";
    history.pushState(
      {
        alienJournal: true,
        kind,
        category: cat,
        slug,
        scene,
        origin: panelOrigin.current,
      },
      "",
      url,
    );
  }

  const animatePanel = contextSafe(
    (opening: boolean, selection = liveView.current.category) => {
      const isReading = opening && liveView.current.panel === "article";
      const closing = opening ? null : pendingClose.current;
      panelTween.current?.kill();
      const target = panelRef.current;
      if (target) {
        gsap.killTweensOf(target);
        const bounds = target.getBoundingClientRect();
        const x = panelOrigin.current.x - bounds.left,
          y = panelOrigin.current.y - bounds.top;
        const radius = Math.hypot(
          bounds.width + Math.abs(x),
          bounds.height + Math.abs(y),
        );
        if (opening && !target.dataset.opened) {
          gsap.set(target, {
            opacity: 0,
            clipPath: `circle(0px at ${x}px ${y}px)`,
          });
          target.dataset.opened = "true";
        }
        panelTween.current = gsap.to(target, {
          xPercent: 0,
          opacity: opening ? 1 : 0,
          clipPath: `circle(${opening ? radius : 0}px at ${x}px ${y}px)`,
          duration: reducedMotion ? 0 : opening ? 0.6 : 0.42,
          ease: "power3.inOut",
          onComplete: !opening
            ? () => {
                if (!closing || pendingClose.current !== closing) return;
                pendingClose.current = null;
                setPanel(null);
                setArticle(null);
                dispatch({ type: "view.close" });
                restoreScene(closing.scene);
                if (!closing.home)
                  triggerRef.current?.focus({ preventScroll: true });
              }
            : undefined,
        });
      }
      const bias =
        selection === "notes" ? -10 : selection === "reading" ? 10 : 0;
      cameraTween.current?.kill();
      cameraTween.current = gsap.to(runtime, {
        focusX:
          opening && !isReading && innerWidth > 760
            ? -innerWidth * 0.2 + bias
            : 0,
        focusZoom: 0,
        readingBlend: isReading ? 1 : 0,
        duration: reducedMotion ? 0 : 0.65,
        ease: "power3.inOut",
        onUpdate: () => runtime.invalidate(),
      });
      worldTween.current?.kill();
      worldTween.current = gsap.to(
        root.current?.querySelector(".world-canvas") ?? [],
        {
          y: 0,
          duration: reducedMotion ? 0 : 0.65,
          ease: "power3.inOut",
          onUpdate: () => runtime.invalidate(),
        },
      );
    },
  );

  function restoreScene(scene: ScenePosition) {
    sceneSnapshot.current = scene;
    setCategory(scene.category);
    runtime.pointerX = scene.pointerX;
    runtime.pointerY = scene.pointerY;
    window.scrollTo({ top: scene.scrollY, behavior: "instant" });
  }

  function closePanel(withHistory = true, home = false) {
    if (home) {
      cancelCharge();
      setMenuOpen(false);
    }
    const scene = home
      ? { scrollY: 0, category: null, pointerX: 0, pointerY: 0 }
      : { ...sceneSnapshot.current };
    if (!liveView.current.panel) {
      if (home)
        window.scrollTo({
          top: 0,
          behavior: reducedMotion ? "instant" : "smooth",
        });
      else if (!withHistory) restoreScene(scene);
      return;
    }
    if (pendingClose.current) {
      // A history jump or Home can update the destination without restarting the exit.
      if (home || !withHistory) {
        Object.assign(pendingClose.current, { scene, home });
        if (home && withHistory)
          history.replaceState({ ...history.state, scene }, "", "/");
      }
      return;
    }
    request.current?.abort();
    setHover(null);
    pendingClose.current = { scene, home };
    if (withHistory) writeHistory(null, undefined, undefined, scene);
    animatePanel(false);
  }

  function interruptPanelClose() {
    if (!pendingClose.current) return;
    pendingClose.current = null;
    panelTween.current?.kill();
    // The next request can reopen the exact same panel and category.
    setPanelRevision((revision) => revision + 1);
  }

  function openList(
    kind: Exclude<Panel, "article" | null>,
    cat: Category | null = null,
    push = true,
  ) {
    interruptPanelClose();
    request.current?.abort();
    cancelCharge();
    if (push) rememberTrigger();
    setMenuOpen(false);
    setHover(null);
    setCategory(cat);
    setPanel(kind);
    setArticle(null);
    setArticleError(false);
    if (cat) {
      dispatch({ type: "category.open", category: cat });
      sceneSnapshot.current.category = cat;
    }
    if (push) writeHistory(kind, cat);
  }

  async function openArticle(post: PostSummary, push = true) {
    interruptPanelClose();
    cancelCharge();
    if (push) rememberTrigger();
    if (push && liveView.current.panel) {
      const rect = document.activeElement?.getBoundingClientRect();
      if (rect)
        panelOrigin.current = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        };
    }
    setMenuOpen(false);
    setHover(null);
    setArticle(null);
    setArticleError(false);
    setPanel("article");
    setCategory(post.category);
    setReadingProgress(0);
    setActiveHeading("");
    dispatch({
      type: "article.open",
      slug: post.slug,
      category: post.category,
      snapshot: {
        position: runtime.currentPosition.toArray() as [number, number, number],
        target: runtime.currentTarget.toArray() as [number, number, number],
        scrollY: window.scrollY,
      },
    });
    if (push) writeHistory("article", post.category, post.slug);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      let payload = articleCache.current.get(post.slug);
      if (!payload) {
        const result = await fetch(`/journal/${post.slug}.json`, {
          signal: controller.signal,
        });
        if (!result.ok) throw new Error("Article unavailable");
        payload = (await result.json()) as PostArticle;
        articleCache.current.set(post.slug, payload);
      }
      if (controller.signal.aborted) return;
      setArticle(payload);
      setActiveHeading(payload.headings.find((h) => h.depth === 2)?.slug ?? "");
      if (readingRef.current) readingRef.current.scrollTop = 0;
      document.title = `${post.title} · 异星日志`;
    } catch {
      if (!controller.signal.aborted) setArticleError(true);
    }
  }

  // Popstate outlives individual renders; always use the current motion preference and view handlers.
  const navigationRef = useRef({ closePanel, openList, openArticle });
  navigationRef.current = { closePanel, openList, openArticle };

  useEffect(() => {
    if (!panel) {
      document.title = "异星日志 · 记录学习，探索未知";
      return;
    }
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!pendingClose.current) animatePanel(true, category);
    const first = panelRef.current?.querySelector<HTMLElement>(
      panel === "search" ? "input" : "button",
    );
    first?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [panel, category, panelRevision]);

  useEffect(() => {
    if (panel !== "article") return;
    const reframe = () => {
      if (!pendingClose.current) animatePanel(true, category);
    };
    window.addEventListener("resize", reframe);
    return () => window.removeEventListener("resize", reframe);
  }, [panel, category, reducedMotion]);

  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    if (!history.state?.alienJournal)
      history.replaceState(
        { alienJournal: true, kind: null, scene: sceneSnapshot.current },
        "",
        location.href,
      );
    const pop = (event: PopStateEvent) => {
      const navigate = navigationRef.current;
      const state = event.state;
      if (state?.scene) sceneSnapshot.current = state.scene;
      if (state?.origin) panelOrigin.current = state.origin;
      if (!state?.alienJournal || !state.kind) {
        navigate.closePanel(false);
        return;
      }
      if (state.kind === "article") {
        const post = posts.find((p) => p.slug === state.slug);
        if (post) void navigate.openArticle(post, false);
      } else navigate.openList(state.kind, state.category ?? null, false);
    };
    window.addEventListener("popstate", pop);
    const initialCategory = new URLSearchParams(location.search).get(
      "category",
    );
    if (
      initialCategory === "notes" ||
      initialCategory === "practice" ||
      initialCategory === "reading"
    ) {
      openList("category", initialCategory, false);
      history.replaceState(
        { ...history.state, kind: "category", category: initialCategory },
        "",
        location.href,
      );
    }
    if (new URLSearchParams(location.search).get("view") === "search") {
      openList("search", null, false);
      history.replaceState(
        { ...history.state, kind: "search" },
        "",
        location.href,
      );
    }
    return () => {
      window.removeEventListener("popstate", pop);
      history.scrollRestoration = previousRestoration;
    };
  }, [posts]);

  const onHover = (cat: Category | null) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (!cat) {
      runtime.hoverIndex = -1;
      runtime.invalidate();
      previewTimer.current = setTimeout(() => setHover(null), 150);
      return;
    }
    if (panel) return;
    const lamp = document.querySelector<HTMLElement>(
      `.world-label[data-category="${cat}"]`,
    );
    if (lamp) {
      const rect = lamp.getBoundingClientRect();
      setPreviewPoint({
        x: Math.min(Math.max(16, rect.left - 20), innerWidth - 310),
        y: rect.top > 190 ? rect.top - 185 : rect.bottom + 14,
      });
    }
    setHover(cat);
    runtime.hoverIndex = cat === "notes" ? 0 : cat === "practice" ? 1 : 2;
    runtime.invalidate();
  };
  const previewPost = hover ? posts.find((p) => p.category === hover) : null;
  const filtered = posts.filter(
    (p) =>
      (!category || p.category === category) &&
      (panel !== "search" ||
        !query ||
        `${p.title}${p.description}${p.tags.join("")}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const activeIndex = article
    ? posts.findIndex((p) => p.slug === article.slug)
    : -1;

  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input",
    );
    if (!items?.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={`journal-app ${panel ? "has-panel" : ""} ${panel === "article" ? "is-reading" : ""} ${ready ? "scene-ready" : ""}`}
      ref={root}
      data-phase={phase}
      data-hydrated={mounted}
    >
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            closePanel(true, true);
          }}
        >
          <span className="orbit-mark" aria-hidden="true" />
          <span>异星日志</span>
        </a>
        <span className="header-rule" aria-hidden="true" />
        <nav aria-label="主导航">
          <a
            className={!panel ? "active" : ""}
            href="/"
            onClick={(event) => {
              event.preventDefault();
              closePanel(true, true);
            }}
          >
            首页
          </a>
          <a
            className={
              ["all", "category", "article"].includes(panel ?? "")
                ? "active"
                : ""
            }
            href="/articles/"
            onClick={(event) => {
              event.preventDefault();
              openList("all");
            }}
          >
            文章
          </a>
          <a
            className={panel === "archive" ? "active" : ""}
            href="/archive/"
            onClick={(event) => {
              event.preventDefault();
              openList("archive");
            }}
          >
            归档
          </a>
          <a
            className={panel === "about" ? "active" : ""}
            href="/about/"
            onClick={(event) => {
              event.preventDefault();
              openList("about");
            }}
          >
            关于
          </a>
          <button
            className="search-button"
            aria-label="搜索日志"
            onClick={() => {
              setQuery("");
              openList("search");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="7" />
              <path d="m16 16 5 5" />
            </svg>
          </button>
          <button
            className="mobile-menu-button"
            aria-label="更多导航"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </nav>
        {menuOpen && (
          <div className="mobile-menu">
            <a
              href="/archive/"
              onClick={(event) => {
                event.preventDefault();
                openList("archive");
              }}
            >
              归档 <Arrow />
            </a>
            <a
              href="/about/"
              onClick={(event) => {
                event.preventDefault();
                openList("about");
              }}
            >
              关于 <Arrow />
            </a>
          </div>
        )}
      </header>

      <main>
        <section className="world-scroll" aria-label="异星观测站">
          <div
            className="world-viewport"
            onPointerMove={(event) => {
              if (panel || event.pointerType !== "mouse") return;
              if ((event.target as HTMLElement).closest(".hover-preview"))
                return;
              const r = event.currentTarget.getBoundingClientRect();
              runtime.pointerX = Math.max(
                -1,
                Math.min(1, ((event.clientX - r.left) / r.width) * 2 - 1),
              );
              runtime.pointerY = Math.max(
                -1,
                Math.min(1, 1 - ((event.clientY - r.top) / r.height) * 2),
              );
              runtime.invalidate();
            }}
            onPointerLeave={() => {
              if (!panel) {
                runtime.pointerX = 0;
                runtime.pointerY = 0;
                runtime.invalidate();
              }
            }}
          >
            <div className="sky-grain" aria-hidden="true" />
            <div className="world-canvas" aria-label="可探索的异星观测站">
              {mounted && (
                <IllustratedWorld
                  runtime={runtime}
                  reducedMotion={reducedMotion}
                  reading={panel === "article"}
                  activeCategory={category}
                  readCount={readSlugs.length}
                  stoneAvailable={phase === "idle" || phase === "charging"}
                  onCategory={(cat) => openList("category", cat)}
                  onHover={onHover}
                  onHoldStart={startHold}
                  onHoldEnd={endHold}
                  onActivate={activate}
                  onReady={(available) => {
                    setReady(true);
                    setStaticScene(!available);
                  }}
                />
              )}
            </div>
            <div className="hero-copy">
              <p className="eyebrow">个人博客 / 学习记录</p>
              <h1>
                记录学习
                <br />
                探索未知
                <span className="title-star" aria-hidden="true">
                  ✳
                </span>
              </h1>
              <p className="hero-description">
                把学到的、想到的、做过的，
                <br className="mobile-break" />
                慢慢记下来。
              </p>
              <a
                className="ink-button"
                href="/articles/"
                onClick={(event) => {
                  event.preventDefault();
                  openList("all");
                }}
              >
                阅读日志 <Arrow />
              </a>
            </div>
            <div className="mobile-world-controls" aria-label="探索观测站">
              {(Object.entries(categoryNames) as [Category, string][]).map(
                ([cat, name]) => (
                  <button key={cat} onClick={() => openList("category", cat)}>
                    {name}
                  </button>
                ),
              )}
              {!staticScene && (
                <button
                  className="mobile-wake"
                  disabled={phase === "awake" || phase === "awakening"}
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerCancel={endHold}
                  onLostPointerCapture={endHold}
                  onClick={(event) => {
                    if (event.detail === 0) activate();
                  }}
                >
                  ✧{" "}
                  {phase === "awake"
                    ? "观测站已唤醒"
                    : phase === "awakening"
                      ? "光正在抵达"
                      : phase === "charging"
                        ? "继续按住…"
                        : "长按唤醒"}
                </button>
              )}
            </div>
            <div className="world-caption">
              <span
                className={`status-dot ${phase === "awake" ? "lit" : ""}`}
              />
              <span aria-live="polite">
                {staticScene
                  ? "静态插画模式 · 日志仍可正常阅读"
                  : phase === "charging"
                    ? "让好奇聚集，片刻之后…"
                    : phase === "awakening"
                      ? "新的光，正在抵达。"
                      : phase === "awake"
                        ? "每一次记录，都让世界亮一点。"
                        : "一座等待被好奇唤醒的观测站"}
              </span>
            </div>
            <SceneJourney
              runtime={runtime}
              posts={posts}
              reducedMotion={reducedMotion}
              panelOpen={panelOpen}
              onArticle={(post) => void openArticle(post)}
              onAll={() => openList("all")}
            />
            {!ready && (
              <div className="loading-note" role="status">
                正在抵达观测站<span> · · ·</span>
              </div>
            )}
            {previewPost && !panel && (
              <div
                className="hover-preview"
                data-preview-category={hover}
                style={{ left: previewPoint.x, top: previewPoint.y }}
                onPointerEnter={() => onHover(hover)}
                onPointerLeave={() => onHover(null)}
              >
                <span className="category-caption">
                  {categoryNames[previewPost.category]}
                </span>
                <h3>{previewPost.title}</h3>
                <p>{previewPost.description}</p>
                <a
                  href={`/journal/${previewPost.slug}/`}
                  onClick={(event) => {
                    event.preventDefault();
                    void openArticle(previewPost);
                  }}
                >
                  阅读全文 <Arrow />
                </a>
              </div>
            )}
          </div>
        </section>
      </main>

      {panel && (
        <>
          <button
            className="panel-backdrop"
            aria-label="关闭阅读面板"
            onClick={() => closePanel()}
          />
          <section
            key={panel === "article" ? "reading" : "collection"}
            ref={panelRef}
            className={`content-panel ${panel === "article" ? "article-panel" : "collection-panel"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-heading"
            onKeyDown={trapFocus}
          >
            <div className="panel-topbar">
              <button className="text-link" onClick={() => closePanel()}>
                <Arrow back /> 返回观测站
              </button>
              {panel === "article" ? (
                <div className="reading-status">
                  <span>阅读进度</span>
                  <strong>{Math.round(readingProgress)}%</strong>
                  <span
                    className="reading-meter"
                    role="progressbar"
                    aria-label="阅读进度"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(readingProgress)}
                  >
                    <span
                      style={{ transform: `scaleX(${readingProgress / 100})` }}
                    />
                  </span>
                </div>
              ) : (
                <span className="panel-top-caption">留下一点探索的痕迹</span>
              )}
            </div>
            <div
              className="panel-scroll"
              ref={readingRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                const denominator = element.scrollHeight - element.clientHeight;
                setReadingProgress(
                  denominator > 0
                    ? Math.round((element.scrollTop / denominator) * 100)
                    : 100,
                );
                const headings = [
                  ...element.querySelectorAll<HTMLElement>(".article-body h2"),
                ];
                const edge = element.getBoundingClientRect().top + 70;
                setActiveHeading(
                  (denominator > 0 && element.scrollTop >= denominator - 2
                    ? headings.at(-1)
                    : (headings
                        .filter((h) => h.getBoundingClientRect().top <= edge)
                        .at(-1) ?? headings[0])
                  )?.id ?? "",
                );
              }}
            >
              {panel === "article" ? (
                <>
                  {articleError ? (
                    <div className="panel-empty">
                      <h2 id="panel-heading">这篇日志暂时没有抵达</h2>
                      <p>可以稍后重试，或直接打开独立页面阅读。</p>
                      <a className="ink-button" href={location.pathname}>
                        打开文章 ↗
                      </a>
                    </div>
                  ) : !article ? (
                    <div className="panel-empty" role="status">
                      <h2 id="panel-heading">正在翻开日志…</h2>
                    </div>
                  ) : (
                    <div className="reading-layout">
                      <article className="prose">
                        <p className="eyebrow">
                          {categoryNames[article.category]} · {article.date}{" "}
                          <span>
                            {article.minutes} 分钟 /{" "}
                            {article.demo && "示例日志"}
                          </span>
                        </p>
                        <h1 id="panel-heading">{article.title}</h1>
                        <p className="article-description">
                          {article.description}
                        </p>
                        <details className="mobile-reading-toc">
                          <summary>
                            本文目录 <span aria-hidden="true">＋</span>
                          </summary>
                          <nav aria-label="本文目录">
                            {article.headings
                              .filter((h) => h.depth === 2)
                              .map((h) => (
                                <button
                                  key={h.slug}
                                  aria-current={
                                    activeHeading === h.slug
                                      ? "location"
                                      : undefined
                                  }
                                  onClick={(event) => {
                                    const disclosure =
                                      event.currentTarget.closest("details");
                                    if (disclosure) disclosure.open = false;
                                    panelRef.current
                                      ?.querySelector(`#${CSS.escape(h.slug)}`)
                                      ?.scrollIntoView({
                                        behavior: reducedMotion
                                          ? "instant"
                                          : "smooth",
                                        block: "start",
                                      });
                                  }}
                                >
                                  {h.text}
                                </button>
                              ))}
                          </nav>
                        </details>
                        <div
                          className="article-body"
                          dangerouslySetInnerHTML={{ __html: article.html }}
                        />
                        <nav className="article-footer" aria-label="相邻文章">
                          {posts[activeIndex + 1] ? (
                            <button
                              onClick={() =>
                                void openArticle(posts[activeIndex + 1])
                              }
                            >
                              ← 上一篇
                            </button>
                          ) : (
                            <span />
                          )}
                          {posts[activeIndex - 1] ? (
                            <button
                              onClick={() =>
                                void openArticle(posts[activeIndex - 1])
                              }
                            >
                              下一篇 →
                            </button>
                          ) : (
                            <a
                              href="/articles/"
                              onClick={(event) => {
                                event.preventDefault();
                                openList("all");
                              }}
                            >
                              全部文章 ↗
                            </a>
                          )}
                        </nav>
                      </article>
                      <nav
                        className="panel-toc desktop-reading-toc"
                        aria-label="本文目录"
                      >
                        <span>本文目录</span>
                        {article.headings
                          .filter((h) => h.depth === 2)
                          .map((h) => (
                            <button
                              key={h.slug}
                              aria-current={
                                activeHeading === h.slug
                                  ? "location"
                                  : undefined
                              }
                              onClick={() =>
                                panelRef.current
                                  ?.querySelector(`#${CSS.escape(h.slug)}`)
                                  ?.scrollIntoView({
                                    behavior: reducedMotion
                                      ? "instant"
                                      : "smooth",
                                    block: "start",
                                  })
                              }
                            >
                              {h.text}
                            </button>
                          ))}
                      </nav>
                    </div>
                  )}
                </>
              ) : panel === "about" ? (
                <div className="panel-about">
                  <p className="eyebrow">一位保持好奇的旅行者</p>
                  <h1 id="panel-heading">
                    在未知里，
                    <br />
                    慢慢生长。
                  </h1>
                  <div className="prose">
                    <p>
                      这里是一座学习观测站，收集笔记、实践和阅读之后留下的想法。
                    </p>
                    <h2>给每一次探索留个位置</h2>
                    <p>
                      允许不完整，也允许以后回来修正。希望那些看起来微不足道的记录，会在某一天成为新的线索。
                    </p>
                    <p className="demo-note">
                      个人介绍与日志目前为示例，等待你的故事。
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="eyebrow">
                    {panel === "archive"
                      ? "沿着时间回看"
                      : category
                        ? "文章 / " + categoryNames[category]
                        : "把探索留下来"}
                  </p>
                  <h1 id="panel-heading">
                    {panel === "archive"
                      ? "留下的轨迹"
                      : panel === "search"
                        ? "寻找一条线索"
                        : category
                          ? categoryNames[category]
                          : "所有的学习轨迹"}
                  </h1>
                  {panel === "search" ? (
                    <label className="search-field">
                      <span>搜索标题、摘要或标签</span>
                      <input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="想找些什么？"
                        type="search"
                      />
                    </label>
                  ) : (
                    panel !== "archive" && (
                      <div className="category-tabs" aria-label="文章分类">
                        <button
                          aria-pressed={!category}
                          onClick={() => openList("all")}
                        >
                          全部
                        </button>
                        {(
                          Object.entries(categoryNames) as [Category, string][]
                        ).map(([cat, name]) => (
                          <button
                            key={cat}
                            aria-pressed={category === cat}
                            onClick={() => openList("category", cat)}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )
                  )}
                  {panel === "archive" && (
                    <div className="archive-year">
                      2026<span>{posts.length} 篇日志</span>
                    </div>
                  )}
                  <div className="article-list">
                    {filtered.map((post) => (
                      <a
                        className="article-row"
                        href={`/journal/${post.slug}/`}
                        key={post.slug}
                        onClick={(event) => {
                          event.preventDefault();
                          void openArticle(post);
                        }}
                      >
                        <div>
                          <span className="post-date">
                            {post.date} · {categoryNames[post.category]}
                          </span>
                          <h2>{post.title}</h2>
                          {panel !== "archive" && <p>{post.description}</p>}
                        </div>
                        <Arrow />
                      </a>
                    ))}
                  </div>
                  {!filtered.length && (
                    <p className="empty-message">
                      还没有找到这条线索，换个关键词试试。
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
