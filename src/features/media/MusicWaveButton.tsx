import { useEffect, useState, type CSSProperties } from "react";
import { clamp } from "../../utils/number";
import "./MusicWaveButton.css";

const BAR_COUNT = 24;
const BAR_PATTERN = [0.32, 0.62, 0.44, 0.86, 0.54, 1, 0.7, 0.92, 0.48, 0.74, 0.4, 0.58, 0.8, 0.5, 0.66, 0.9, 0.36, 0.78, 0.52, 0.96, 0.6, 0.42, 0.84, 0.5];

export function MusicWaveButton({
  visible,
  isPlaying,
  audioPeak,
  label,
  onClick,
  bars = BAR_COUNT,
}: {
  visible: boolean;
  isPlaying: boolean;
  audioPeak: number;
  label: string;
  onClick: () => void;
  bars?: number;
}) {
  const isAvailable = visible;
  const [phase, setPhase] = useState(0);
  const className = [
    "music-wave-button",
    isAvailable ? "music-wave-button--available" : "music-wave-button--idle",
    visible ? "music-wave-button--on" : "music-wave-button--off",
    isPlaying ? "music-wave-button--playing" : "music-wave-button--paused",
  ]
    .filter(Boolean)
    .join(" ");
  const shouldAnimate = isAvailable || isPlaying;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!shouldAnimate) {
      setPhase(0);
      return;
    }

    const interval = window.setInterval(
      () => {
        setPhase(performance.now() / (isPlaying ? 210 : 900));
      },
      prefersReducedMotion ? 420 : isPlaying ? 60 : 80,
    );

    return () => window.clearInterval(interval);
  }, [isPlaying, prefersReducedMotion, shouldAnimate]);

  // 优先跟系统音量；读不到峰值（无声卡/静音）时用一个活动基线，保证柱子在动
  const hasMeter = audioPeak > 0.0005;
  const liftedPeak = hasMeter
    ? clamp(Math.log1p(clamp(audioPeak, 0, 1) * 150) / Math.log1p(150), 0, 1)
    : visible
      ? 0.22
      : 0;
  const barScales = BAR_PATTERN.slice(0, bars).map((bar, index) => {
    const floor = isAvailable ? 0.2 : 0.1;
    const breath =
      shouldAnimate && !prefersReducedMotion
        ? 0.08 + Math.sin(phase + index * 0.7) * 0.05
        : 0;
    const movement =
      liftedPeak *
      (0.24 + bar * 1.05) *
      (0.82 + Math.sin(phase * (1.1 + index * 0.07) + index * 1.55) * 0.26);

    return clamp(floor + breath + movement, 0.1, 1.15);
  });
  // 彩虹色随时间和位置流转，同时整体做呼吸明暗
  const hueBase = (phase * 46) % 360;
  const breathGlow = 0.62 + Math.sin(phase * 1.6) * 0.16 + liftedPeak * 0.22;

  return (
    <button
      className={className}
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {barScales.map((scale, index) => (
        <span
          key={index}
          style={
            {
              "--wave-scale": scale.toFixed(3),
              "--wave-opacity": (0.5 + scale * 0.45).toFixed(3),
              "--wave-hue": `${(hueBase + index * (300 / BAR_COUNT)) % 360}deg`,
              "--wave-glow": breathGlow.toFixed(3),
            } as CSSProperties
          }
        />
      ))}
    </button>
  );
}
