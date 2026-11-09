import "./DouyinArtwork.css";

/**
 * 抖音的媒体会话通常没有封面，用它的品牌音符代替默认的占位图标。
 * 这里用双色错位的音符（青/红）还原辨识度，不引入官方素材。
 */
export function DouyinArtwork() {
  return (
    <div className="douyin-artwork" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="presentation">
        <path
          className="douyin-artwork__shadow douyin-artwork__shadow--cyan"
          d="M29 7c1.2 6.4 5.4 10 11.6 10.6v6.8c-4.4-.1-8.2-1.4-11.6-3.9v11.9a12.1 12.1 0 1 1-12.1-12.1c.9 0 1.8.1 2.6.3v7a5.2 5.2 0 1 0 3.4 4.8V7z"
        />
        <path
          className="douyin-artwork__shadow douyin-artwork__shadow--red"
          d="M29 7c1.2 6.4 5.4 10 11.6 10.6v6.8c-4.4-.1-8.2-1.4-11.6-3.9v11.9a12.1 12.1 0 1 1-12.1-12.1c.9 0 1.8.1 2.6.3v7a5.2 5.2 0 1 0 3.4 4.8V7z"
        />
        <path
          className="douyin-artwork__note"
          d="M29 7c1.2 6.4 5.4 10 11.6 10.6v6.8c-4.4-.1-8.2-1.4-11.6-3.9v11.9a12.1 12.1 0 1 1-12.1-12.1c.9 0 1.8.1 2.6.3v7a5.2 5.2 0 1 0 3.4 4.8V7z"
        />
      </svg>
    </div>
  );
}
