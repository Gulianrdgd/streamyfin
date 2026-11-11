/**
 * Jellyfin session client name of the official Cast receiver (F007D354). The
 * server keys a session on client + device + user, so a stop reported on the
 * receiver's behalf has to use this exact name.
 */
export const JELLYFIN_RECEIVER_CLIENT = "Chromecast";

/**
 * Name handed to the receiver for a TV whose Cast name it cannot take, followed
 * by this many characters from the end of the Cast device id, so two such TVs
 * do not share one DeviceId on the server.
 */
export const RECEIVER_FALLBACK_NAME = "Chromecast";
export const RECEIVER_FALLBACK_ID_LENGTH = 8;

/**
 * Most items handed to the receiver in one PlayNow message. Each one is only a
 * few ids, but a Cast message is capped at 64 KB, so a long music queue is sent
 * as a window of this size around the selected track.
 */
export const RECEIVER_MAX_QUEUE_ITEMS = 100;

/**
 * How long a cast waits for the receiver to load the item before telling the
 * user it did not start. A receiver that cannot reach the server fails on its
 * first request without a word back, so this wait is the only sign of it. A
 * receiver measures its bandwidth and runs PlaybackInfo before loading, which
 * takes a few seconds on a home network.
 */
export const RECEIVER_LOAD_TIMEOUT_MS = 30_000;

/**
 * Tries at opening the receiver channel before a command gives up. A session
 * that changes again on every try is a device the sender cannot hold on to,
 * and giving up beats looping on it.
 */
export const RECEIVER_CHANNEL_OPEN_ATTEMPTS = 3;

/**
 * How far back, in seconds, the stop reporter looks for the receiver's
 * session: the window jellyfin-web's dashboard lists sessions over. The server
 * stops a playing session that has not checked in for 5 minutes, on a 5 minute
 * timer, so one it still has playing was active well within it.
 */
export const RECEIVER_SESSION_WINDOW_SECONDS = 960;

/**
 * After a Cast session ends on a connection loss, how long to leave the
 * receiver to report its own stop before checking on it.
 */
export const RECEIVER_STOP_GRACE_MS = 3_000;

/**
 * The receiver reports progress every ~5 s while playing, so a session that has
 * not checked in across this window is no longer backed by a running receiver.
 * Three missed reports keeps one late request from reading as a dead TV.
 */
export const RECEIVER_LIVENESS_WINDOW_MS = 15_000;

/**
 * The text sizes the official receiver takes in `subtitleAppearance.textSize`,
 * with the font scale it turns each into (jellyfin-chromecast's setTextTrack).
 * The phone's subtitle size is a free scale, so a cast picks the nearest one.
 */
export const RECEIVER_SUBTITLE_SIZES = [
  { textSize: "smaller", fontScale: 0.6 },
  { textSize: "small", fontScale: 0.8 },
  { textSize: "normal", fontScale: 1.0 },
  { textSize: "large", fontScale: 1.15 },
  { textSize: "larger", fontScale: 1.3 },
  { textSize: "extralarge", fontScale: 1.45 },
] as const;

/**
 * The phone's subtitle fonts the receiver can draw, as CSS font families. A
 * font missing here (System, OpenDyslexic, which the Chromecast does not have)
 * leaves the receiver's own font.
 */
export const RECEIVER_SUBTITLE_FONTS: Record<string, string> = {
  "sans-serif": "sans-serif",
  serif: "serif",
  monospace: "monospace",
};
