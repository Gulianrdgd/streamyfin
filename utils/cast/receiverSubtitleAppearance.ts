import {
  RECEIVER_SUBTITLE_FONTS,
  RECEIVER_SUBTITLE_SIZES,
} from "@/constants/Cast";
import type { Settings } from "@/utils/atoms/settings";

/**
 * What the official receiver reads from `subtitleAppearance` on a message
 * (jellyfin-chromecast's `SubtitleAppearance`). It builds a Cast
 * TextTrackStyle from it each time it turns a subtitle track on, which is the
 * only way to style the subtitles it draws: without it the TV shows its own
 * default style whatever the phone is set to.
 */
export interface ReceiverSubtitleAppearance {
  /** A Cast TextTrackEdgeType; the receiver passes it on as given. */
  dropShadow: "NONE" | "DROP_SHADOW";
  font?: string;
  /** `#RRGGBB`: the receiver appends the alpha itself. */
  textColor?: string;
  /** "transparent" clears the background, anything else keeps the TV's. */
  textBackground: "transparent" | "default";
  textSize: (typeof RECEIVER_SUBTITLE_SIZES)[number]["textSize"];
}

type SubtitleSettings = Pick<
  Settings,
  "subtitleSize" | "subtitleColor" | "subtitleFont" | "subtitleBackground"
>;

const HEX_COLOR = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

const nearestTextSize = (scale: number) => {
  const target = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return RECEIVER_SUBTITLE_SIZES.reduce((best, size) =>
    Math.abs(size.fontScale - target) < Math.abs(best.fontScale - target)
      ? size
      : best,
  ).textSize;
};

/**
 * The phone's subtitle settings in the receiver's terms, so a cast shows the
 * subtitles styled as they are on the phone. The receiver has no background
 * opacity or padding, no position and no custom font files; those stay as the
 * TV draws them.
 */
export const toReceiverSubtitleAppearance = (
  settings: SubtitleSettings,
): ReceiverSubtitleAppearance => {
  // The receiver appends "FF" to the colour, so a colour that already carries
  // an alpha would come out as an invalid nine digit one.
  const color = HEX_COLOR.exec(settings.subtitleColor ?? "");
  const font = RECEIVER_SUBTITLE_FONTS[settings.subtitleFont ?? ""];

  return {
    // Without a box behind them the subtitles need the shadow to stay
    // readable on a bright picture, as the phone's player outlines them.
    dropShadow: settings.subtitleBackground ? "NONE" : "DROP_SHADOW",
    ...(font ? { font } : {}),
    ...(color ? { textColor: `#${color[1].toUpperCase()}` } : {}),
    textBackground: settings.subtitleBackground ? "default" : "transparent",
    textSize: nearestTextSize(settings.subtitleSize ?? 1),
  };
};
