import neteaseIcon from "../../assets/brands/netease.png";
import qqIcon from "../../assets/brands/qq.png";
import wechatIcon from "../../assets/brands/wechat.png";
import windowsIcon from "../../assets/brands/windows.png";
import { DouyinGlyph } from "./DouyinGlyph";
import "./AudioSourceBadge.css";

export type AudioSourceKind = "wechat" | "qq" | "netease" | "douyin" | "other";

/**
 * 把 Rust 侧给的 sourceApp（可能像 douyin.exe / WeChat.exe / cloudmusic.exe）
 * 归到四种品牌图标，其余一律用四色格。
 * qqmusic 必须在 qq 之前判断，否则会被 "qq" 抢先匹配。
 */
export function resolveAudioSource(sourceApp: string | null): AudioSourceKind {
  const name = (sourceApp ?? "").toLowerCase();

  if (!name) {
    return "other";
  }

  if (name.includes("cloudmusic") || name.includes("netease") || name.includes("163")) {
    return "netease";
  }

  if (name.includes("douyin") || name.includes("aweme")) {
    return "douyin";
  }

  if (name.includes("weixin") || name.includes("wechat")) {
    return "wechat";
  }

  if (name.includes("qqmusic")) {
    return "other";
  }

  if (name.includes("qq")) {
    return "qq";
  }

  return "other";
}

export const BRAND_ICONS: Record<Exclude<AudioSourceKind, "douyin">, string> = {
  wechat: wechatIcon,
  qq: qqIcon,
  netease: neteaseIcon,
  other: windowsIcon,
};

/** 折叠岛空白处显示的音频来源角标；与彩色波形同进同退。 */
export function AudioSourceBadge({
  sourceApp,
  visible,
  size = 26,
  left,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  locked = false,
}: {
  sourceApp: string | null;
  visible: boolean;
  size?: number;
  /** 实测出的左偏移（px）；为空时退回 CSS 兜底位置。 */
  left?: number | null;
  /** 锁定后不再接收指针事件（位置固定）。 */
  locked?: boolean;
  /** 临时：拖动微调用的事件（挂在角标本体上，不能用 display:contents 包裹层）。 */
  onPointerDown?: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLSpanElement>) => void;
}) {
  const kind = resolveAudioSource(sourceApp);

  return (
    <span
      className={[
        "audio-source-badge",
        visible ? "audio-source-badge--on" : "",
        locked ? "audio-source-badge--locked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        left === null || left === undefined
          ? { width: size, height: size }
          : { width: size, height: size, left }
      }
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {kind === "douyin" ? (
        <DouyinGlyph size={size} />
      ) : (
        <img src={BRAND_ICONS[kind]} alt="" width={size} height={size} draggable={false} />
      )}
    </span>
  );
}

/** 没有歌曲元数据时，用来源应用名代替「暂无媒体」。 */
export const AUDIO_SOURCE_LABELS: Partial<Record<AudioSourceKind, string>> = {
  netease: "网易云音乐",
  qq: "QQ",
  wechat: "微信",
  douyin: "抖音",
};