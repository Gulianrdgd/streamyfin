# The Jellyfin Cast receiver styles subtitles only from `subtitleAppearance`, and never reports an item's end

**Date**: 2026-11-11
**Category**: cast
**Key files**: `utils/cast/jellyfinReceiver.ts`, `utils/cast/receiverSubtitleAppearance.ts`, `utils/cast/finishedReceiverPlayback.ts`, `components/JellyfinCastStopReporter.tsx`

## Detail

The official receiver (F007D354, jellyfin-chromecast `src/components/maincontroller.ts`)
keeps the last `subtitleAppearance` a message carried at its top level (next to
`maxBitrate`, not inside `options`) in `window.subtitleAppearance`, and builds a
Cast `TextTrackStyle` from it in `setTextTrack`, which runs on
`PLAYER_LOAD_COMPLETE` and on every `SetSubtitleStreamIndex`. A message without
it leaves the TV on its default style, whatever the phone's subtitle settings:
that was the "subtitle style is not sent with the cast" report. It reads only
`dropShadow` (passed on as a `TextTrackEdgeType`, so send the CAF enum value),
`font` (a CSS family), `textColor` (`#RRGGBB`, it appends `FF` itself),
`textBackground` (only `"transparent"` does anything) and `textSize`
(`smaller` 0.6, `small` 0.8, `large` 1.15, `larger` 1.3, `extralarge` 1.45,
anything else 1.0). No opacity, padding or position.

The receiver also sends no `/Sessions/Playing/Stopped` when an item plays to
its end: the media status goes idle with idle reason `finished`, and the server
keeps the item playing until its idle check minutes later, so it is not marked
played while the cast stays open. `JellyfinCastStopReporter` watches for that
status and reports the stop for the receiver through
`reportOrphanedReceiverStop`, which does nothing if the receiver's session no
longer has the item.
