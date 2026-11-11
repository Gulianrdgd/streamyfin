import {
  MediaPlayerIdleReason,
  MediaPlayerState,
} from "react-native-google-cast";
import {
  finishedReceiverPlayback,
  receiverPlaybackKey,
} from "./finishedReceiverPlayback";

const finished = {
  playerState: MediaPlayerState.IDLE,
  idleReason: MediaPlayerIdleReason.FINISHED,
};
const last = { itemId: "episode-1", playSessionId: "play-1" };

describe("finishedReceiverPlayback", () => {
  it("reports the item the receiver played to its end", () => {
    // The receiver sends no stop at the end of an item, so the server kept the
    // episode playing and never marked it played while the cast stayed open.
    expect(finishedReceiverPlayback(finished, last, undefined)).toEqual(last);
  });

  it("reports a finished playback only once across repeated statuses", () => {
    expect(
      finishedReceiverPlayback(finished, last, receiverPlaybackKey(last)),
    ).toBeNull();
  });

  it("reports the next playback of the same item, which has a new play session", () => {
    expect(
      finishedReceiverPlayback(
        finished,
        { itemId: "episode-1", playSessionId: "play-2" },
        "play-1",
      ),
    ).toEqual({ itemId: "episode-1", playSessionId: "play-2" });
  });

  it.each([
    ["a stop from a sender", MediaPlayerIdleReason.CANCELLED],
    ["a new load", MediaPlayerIdleReason.INTERRUPTED],
    ["a playback error", MediaPlayerIdleReason.ERROR],
  ])("leaves %s alone", (_case, idleReason) => {
    expect(
      finishedReceiverPlayback(
        { playerState: MediaPlayerState.IDLE, idleReason },
        last,
        undefined,
      ),
    ).toBeNull();
  });

  it("ignores a receiver that is still playing or paused", () => {
    expect(
      finishedReceiverPlayback(
        { playerState: MediaPlayerState.PLAYING },
        last,
        undefined,
      ),
    ).toBeNull();
    expect(
      finishedReceiverPlayback(
        { playerState: MediaPlayerState.PAUSED },
        last,
        undefined,
      ),
    ).toBeNull();
  });

  it("does nothing when the phone never saw which item played", () => {
    expect(finishedReceiverPlayback(finished, {}, undefined)).toBeNull();
    expect(finishedReceiverPlayback(null, last, undefined)).toBeNull();
  });
});
