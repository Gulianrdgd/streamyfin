import { useEffect } from "react";
import { Platform, View } from "react-native";
import GoogleCast, {
  CastButton,
  CastContext,
  useCastDevice,
  useDevices,
  useMediaStatus,
  useRemoteMediaClient,
} from "react-native-google-cast";
import { logAndCaptureError } from "@/utils/log";
import { HeaderButton, type HeaderButtonProps } from "./common/HeaderButton";
import { HeaderIcon } from "./common/HeaderIcon";

type Props = Omit<HeaderButtonProps, "onPress" | "children">;

/**
 * Header cast button. Spacing is owned by the surrounding `HeaderButtonGroup` —
 * this component must not carry margins of its own.
 */
export function Chromecast(props: Props) {
  const client = useRemoteMediaClient();
  const castDevice = useCastDevice();
  const devices = useDevices();
  const sessionManager = GoogleCast.getSessionManager();
  const discoveryManager = GoogleCast.getDiscoveryManager();
  const mediaStatus = useMediaStatus();

  useEffect(() => {
    (async () => {
      if (!discoveryManager) {
        console.warn("DiscoveryManager is not initialized");
        return;
      }

      await discoveryManager.startDiscovery();
    })().catch((error) => {
      // Previously an unhandled rejection: cast devices just never appear.
      logAndCaptureError("Chromecast discovery failed to start", error);
    });
  }, [client, devices, castDevice, sessionManager, discoveryManager]);

  return (
    <HeaderButton
      onPress={async () => {
        if (mediaStatus?.currentItemId) {
          CastContext.showExpandedControls();
          return;
        }
        // The status the phone holds can be one from before the TV loaded
        // what it plays now. Asked fresh, a cast that plays opens its
        // controls rather than the device list.
        const current = client
          ? await client
              .requestStatus()
              .then(() => client.getMediaStatus())
              .catch(() => null)
          : null;
        if (current?.currentItemId) CastContext.showExpandedControls();
        else CastContext.showCastDialog();
      }}
      {...props}
    >
      {/* Android needs a mounted CastButton for startDiscovery to work, but it
          must not take part in layout or it shifts the icon off the header
          grid — hence absolute + transparent rather than a sibling. */}
      {Platform.OS === "android" ? (
        <View style={{ position: "absolute", opacity: 0 }} pointerEvents='none'>
          <CastButton tintColor='transparent' />
        </View>
      ) : null}
      <HeaderIcon name='cast' />
    </HeaderButton>
  );
}
