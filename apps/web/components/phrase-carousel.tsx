"use client";
import { t } from "@timely/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language-state";
import {
  cardOffset,
  settleIndex,
  velocityFrom,
  type PointSample,
} from "./phrase-motion";

const phrases = [
  {
    mark: "☀",
    tone: "lime",
    title: "Small steps.",
    body: "A day that feels like you.",
  },
  {
    mark: "✳",
    tone: "paper",
    title: "One thing at a time.",
    body: "The rest can wait its turn.",
  },
  {
    mark: "☁",
    tone: "orange",
    title: "Leave a little room.",
    body: "Not every hour needs a plan.",
  },
  {
    mark: "✦",
    tone: "blue",
    title: "You showed up.",
    body: "That already counts.",
  },
] as const;

type Drag = {
  pointer: number;
  originX: number;
  originY: number;
  samples: PointSample[];
  axis: "x" | "y" | null;
};

export function PhraseCarousel() {
  useLanguage();
  const count = phrases.length;
  const viewport = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLElement | null>>([]);
  const animation = useRef<Animation | null>(null);
  const offset = useRef(0);
  const index = useRef(0);
  const front = useRef(0);
  const drag = useRef<Drag | null>(null);
  const [active, setActive] = useState(0);
  const [frontIndex, setFrontIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  function width() {
    return viewport.current?.clientWidth ?? 0;
  }
  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function pose(x: number) {
    return `translate3d(${x}px,0,0)`;
  }
  function readX(cardIndex: number) {
    const node = cards.current[cardIndex];
    if (!node) return offset.current;
    const value = getComputedStyle(node).transform;
    if (!value || value === "none") return offset.current;
    return new DOMMatrix(value).m41;
  }
  function reveal(under: number) {
    for (let i = 0; i < count; i += 1) {
      const card = cards.current[i];
      if (!card) continue;
      if (i === front.current) {
        card.style.visibility = "visible";
        card.style.zIndex = "2";
      } else if (i === under) {
        card.style.visibility = "visible";
        card.style.zIndex = "1";
      } else {
        card.style.visibility = "";
        card.style.zIndex = "";
      }
    }
  }
  function apply(next: number) {
    offset.current = next;
    const node = cards.current[front.current];
    if (node) node.style.transform = pose(next);
    const under = next < -0.5 ? front.current + 1 : next > 0.5 ? front.current - 1 : -1;
    reveal(under);
  }
  function showFront(next: number) {
    for (let i = 0; i < count; i += 1) {
      const card = cards.current[i];
      if (!card) continue;
      card.style.transform = "";
      card.style.visibility = i === next ? "visible" : "";
      card.style.zIndex = i === next ? "2" : "";
    }
    front.current = next;
    offset.current = 0;
    setFrontIndex(next);
  }
  function commit(target: number, velocity = 0) {
    const fromIndex = front.current;
    const from = readX(fromIndex);
    const running = animation.current;
    animation.current = null;
    running?.cancel();
    const clamped = Math.max(0, Math.min(count - 1, target));
    const span = width();
    const leaving = clamped !== fromIndex;
    const to = leaving ? (clamped > fromIndex ? -(span + 36) : span + 36) : 0;
    const distance = Math.abs(from - to);
    index.current = clamped;
    setActive(clamped);
    setDragging(false);
    const node = cards.current[fromIndex];
    if (!node || reduced() || distance < 0.5 || span <= 0) {
      showFront(clamped);
      return;
    }
    node.style.transform = pose(from);
    reveal(leaving ? clamped : -1);
    const duration = Math.min(
      320,
      Math.max(160, distance / Math.max(Math.abs(velocity), 0.55)),
    );
    const flying = node.animate(
      [{ transform: pose(from) }, { transform: pose(to) }],
      {
        duration,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      },
    );
    animation.current = flying;
    flying.onfinish = () => {
      if (animation.current !== flying) return;
      animation.current = null;
      flying.cancel();
      showFront(clamped);
    };
  }

  useEffect(() => {
    showFront(front.current);
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (drag.current?.axis === "x" || animation.current) return;
      showFront(index.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.pointerType === "mouse") event.preventDefault();
    if (animation.current) {
      const running = animation.current;
      animation.current = null;
      running.cancel();
      showFront(index.current);
    }
    setDragging(true);
    drag.current = {
      pointer: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      samples: [{ x: event.clientX, t: event.timeStamp }],
      axis: null,
    };
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.originX;
    const dy = event.clientY - current.originY;
    if (!current.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (current.axis === "y") return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* A synthetic pointer has no capture target. The move still tracks. */
      }
    }
    if (current.axis !== "x") return;
    current.samples.push({ x: event.clientX, t: event.timeStamp });
    apply(cardOffset(dx, front.current, count, width()));
  }
  function finish(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.axis === "x")
      current.samples.push({ x: event.clientX, t: event.timeStamp });
    const velocity = velocityFrom(current.samples);
    const axis = current.axis;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (axis !== "x") {
      apply(0);
      return;
    }
    const span = width();
    commit(
      settleIndex({
        index: index.current,
        count,
        offset: offset.current,
        originOffset: 0,
        span,
        velocity,
        axis,
      }),
      axis === "x" ? velocity : 0,
    );
  }
  function onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.axis === "x") return;
    finish(event);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      commit(index.current + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      commit(index.current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      commit(0);
    } else if (event.key === "End") {
      event.preventDefault();
      commit(count - 1);
    }
  }

  const slide = phrases[active] ?? phrases[0];
  return (
    <section
      className="phrase-carousel"
      aria-roledescription={t("carousel")}
      aria-label={t("A little encouragement")}
      onKeyDown={onKeyDown}
    >
      <div
        className={`phrase-viewport${dragging ? " is-dragging" : ""}`}
        ref={viewport}
        tabIndex={0}
        aria-label={t("Inspiring phrases")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={onPointerLeave}
      >
        {phrases.map((phrase, position) => (
          <article
            key={phrase.title}
            ref={(node) => {
              cards.current[position] = node;
            }}
            className={`phrase-card tone-${phrase.tone}${position === frontIndex ? " is-front" : ""}`}
            aria-roledescription={t("slide")}
            aria-label={`${t(phrase.title)} ${t(phrase.body)}`}
            aria-hidden={phrase.title !== slide.title}
          >
            <span aria-hidden="true">{phrase.mark}</span>
            <p>
              {t(phrase.title)}
              <span>{t(phrase.body)}</span>
            </p>
          </article>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {t(slide.title)} {t(slide.body)}
      </p>
      <div className="phrase-nav">
        <button
          type="button"
          aria-label={t("Previous phrase")}
          disabled={active === 0}
          onClick={() => commit(index.current - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="phrase-dots">
          {phrases.map((phrase, position) => (
            <button
              key={phrase.title}
              type="button"
              aria-label={t("Show phrase {v0}", { v0: position + 1 })}
              aria-current={position === active ? "true" : undefined}
              onClick={() => commit(position)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={t("Next phrase")}
          disabled={active === count - 1}
          onClick={() => commit(index.current + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
