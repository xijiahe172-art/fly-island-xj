import { Cloud, MessageCircle, Music3 } from "lucide-react";
import type { MediaState } from "./api";
import { DouyinGlyph } from "./DouyinGlyph";
import "./MediaSourceBadge.css";

/**
 * 音频来源的小图标：直接放在胶囊里，不加底片，避免遮住岛的纯黑。
 * 识别不到来源时返回 null，只留波形。
 */
export function MediaSourceBadge({ mediaState, visible }: { mediaState: MediaState; visible: boolean }) {
  const activeLabel = mediaState.sessions.find((session) => session.id === mediaState.activeSessionId)?.label ?? "";
  const key = [mediaState.sourceApp ?? "", activeLabel, ...mediaState.sessions.map((session) => session.label)]
    .join(" ")
    .toLowerCase();

  const glyph = (() => {
    if (["douyin", "aweme", "抖音"].some((token) => key.includes(token))) {
      return <DouyinGlyph size={31} />;
    }
    if (["cloudmusic", "netease", "网易云"].some((token) => key.includes(token))) {
      return <Cloud size={28} strokeWidth={2} color="#e60026" fill="rgba(230,0,38,0.18)" />;
    }
    if (key.includes("qqmusic")) {
      return <Music3 size={28} strokeWidth={2} color="#31c27c" />;
    }
    if (["wechat", "weixin", "微信"].some((token) => key.includes(token))) {
      return <MessageCircle size={28} strokeWidth={2} color="#07c160" fill="rgba(7,193,96,0.2)" />;
    }
    if (/(^|[\s_.])qq([\s_.]|$)/.test(key)) {
      return <MessageCircle size={28} strokeWidth={2} color="#12b7f5" fill="rgba(18,183,245,0.2)" />;
    }
    if (key.includes("kugou")) {
      return <Music3 size={28} strokeWidth={2} color="#2ca2f9" />;
    }
    if (key.includes("spotify")) {
      return <Music3 size={28} strokeWidth={2} color="#1db954" />;
    }
    return null;
  })();

  if (!glyph) return null;

  return (
    <span className={`media-source-badge${visible ? " media-source-badge--on" : ""}`} aria-hidden="true">
      {glyph}
    </span>
  );
}
