"use client";
import { t } from "@timely/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language-state";
import {
  resistedOffset,
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
  originOffset: number;
  samples: PointSample[];
  axis: "x" | "y" | null;
};

export function PhraseCarousel() {
  useLanguage();
  const count = phrases.length;
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const offset = useRef(0);
  const index = useRef(0);
  const drag = useRef<Drag | null>(null);
  const [active, setActive] = useState(0);

  function width() {
    return viewport.current?.clientWidth ?? 0;
  }
  function readOffset() {
    const node = track.current;
    if (!node) return offset.current;
    const value = getComputedStyle(node).transform;
    if (!value || value === "none") return offset.current;
    return new DOMMatrix(value).m41;
  }
  function apply(next: number) {
    offset.current = next;
    if (track.current) track.current.style.transform = `translate3d(${next}px,0,0)`;
  }
  function stop() {
    const live = readOffset();
    animation.current?.cancel();
    animation.current = null;
    apply(live);
  }
  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function commit(target: number, velocity = 0) {
    stop();
    const clamped = Math.max(0, Math.min(count - 1, target));
    const to = -clamped * width();
    const from = offset.current;
    const distance = Math.abs(from - to);
    index.current = clamped;
    setActive(clamped);
    const node = track.current;
    if (!node || reduced() || distance < 0.5) {
      apply(to);
      return;
    }
    const duration = Math.min(
      420,
      Math.max(140, distance / Math.max(Math.abs(velocity), 0.5)),
    );
    const running = node.animate(
      [
        { transform: `translate3d(${from}px,0,0)` },
        { transform: `translate3d(${to}px,0,0)` },
      ],
      {
        duration,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      },
    );
    animation.current = running;
    running.onfinish = () => {
      if (animation.current !== running) return;
      animation.current = null;
      apply(to);
      running.cancel();
    };
  }

  useEffect(() => {
    apply(-index.current * width());
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (drag.current?.axis === "x") return;
      stop();
      apply(-index.current * width());
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.pointerType === "mouse") event.preventDefault();
    stop();
    drag.current = {
      pointer: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      originOffset: offset.current,
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
    const span = width();
    apply(resistedOffset(current.originOffset + dx, -(count - 1) * span, span));
  }
  function finish(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.axis === "x")
      current.samples.push({ x: event.clientX, t: event.timeStamp });
    const velocity = velocityFrom(current.samples);
    const axis = current.axis;
    const originOffset = current.originOffset;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const span = width();
    commit(
      settleIndex({
        index: index.current,
        count,
        offset: offset.current,
        originOffset,
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
        className="phrase-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label={t("Inspiring phrases")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={onPointerLeave}
      >
        <div className="phrase-track" ref={track}>
          {phrases.map((phrase) => (
            <article
              key={phrase.title}
              className={`phrase-card tone-${phrase.tone}`}
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
