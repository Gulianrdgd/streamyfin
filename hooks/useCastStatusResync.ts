import { useEffect } from "react";
import { AppState } from "react-native";
import { useRemoteMediaClient } from "react-native-google-cast";
import { writeInfoLog } from "@/utils/log";

/**
 * Asks the receiver for its media status each time the app comes back to the
 * foreground during a cast.
 *
 * The phone only learns what the TV plays from the status the receiver
 * broadcasts, and one sent while the app was in the background, or while the
 * Cast session was being resumed, can be missed. The phone then holds a status
 * from before: the header button opens the device list instead of the
 * controls, and the controls drive a media session the TV has left. Asking
 * again brings the phone back to what the TV plays now.
 */
export const useCastStatusResync = () => {
  const client = useRemoteMediaClient();

  useEffect(() => {
    if (!client) return;

    // A client the hook just received may be one the SDK rebuilt on a resume,
    // which starts with no status of its own.
    client.requestStatus().catch(() => {});

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      client.requestStatus().catch((error) => {
        // The session may have ended while the app was away; the session
        // listeners deal with that.
        writeInfoLog("Cast: the media status request on resume failed", {
          error: String(error),
        });
      });
    });

    return () => subscription.remove();
  }, [client]);
};
