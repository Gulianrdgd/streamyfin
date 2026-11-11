import {
  MediaPlayerIdleReason,
  MediaPlayerState,
} from "react-native-google-cast";

/** The parts of a Cast media status the finish check reads. */
interface StatusLike {
  playerState?: string | null;
  idleReason?: string | null;
}

export interface ReceiverPlayback {
  itemId?: string;
  playSessionId?: string;
}

/** What tells one reported playback from the next. */
export const receiverPlaybackKey = (playback: ReceiverPlayback) =>
  playback.playSessionId ?? playback.itemId;

/**
 * The playback whose end the phone should report for the receiver, or null.
 *
 * The official receiver goes idle with idle reason "finished" when an item
 * plays to its end, and sends the server no /Sessions/Playing/Stopped then.
 * Without that stop the server keeps the item playing until its idle check,
 * minutes later, and the item is neither marked played nor shown as watched
 * while the cast session is still open. A playback already reported (the same
 * play session) is not reported again: the status repeats on every update.
 */
export const finishedReceiverPlayback = (
  status: StatusLike | null | undefined,
  last: ReceiverPlayback,
  alreadyReported: string | undefined,
): ReceiverPlayback | null => {
  if (status?.playerState !== MediaPlayerState.IDLE) return null;
  if (status.idleReason !== MediaPlayerIdleReason.FINISHED) return null;
  if (!last.itemId) return null;

  if (receiverPlaybackKey(last) === alreadyReported) return null;

  return { itemId: last.itemId, playSessionId: last.playSessionId };
};
