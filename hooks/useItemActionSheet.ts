import type {
  BaseItemDto,
  BaseItemKind,
} from "@jellyfin/sdk/lib/generated-client/models";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useActionSheet } from "@/hooks/useActionSheet";
import {
  mayDeleteFromServer,
  useDeleteFromServer,
} from "@/hooks/useDeleteFromServer";
import { useFavorite } from "@/hooks/useFavorite";
import { useMarkAsPlayed } from "@/hooks/useMarkAsPlayed";
import { useDownload } from "@/providers/DownloadProvider";
import { useOfflineMode } from "@/providers/OfflineModeProvider";
import { userAtom } from "@/utils/atoms/api";

// What the sheet opens for. The containers (Series, Season, BoxSet, Folder) go
// through the same played call as a single video: the server walks down from
// the id it is given and marks every child.
const ACTION_SHEET_ITEM_TYPES: ReadonlySet<BaseItemKind> = new Set([
  "Movie",
  "Episode",
  "Video",
  "Series",
  "Season",
  "BoxSet",
  "Folder",
]);

/**
 * The long-press action sheet for a media item: played state, favorite, and
 * deleting: the download offline, the item on the server online for a user
 * the server lets delete.
 *
 * Returns a function that presents the sheet and resolves once it closes, so a
 * caller that mounts it on demand knows when to unmount again. Unsupported item
 * types present nothing and resolve immediately.
 */
export function useItemActionSheet(item: BaseItemDto) {
  const { t } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();
  const markAsPlayedStatus = useMarkAsPlayed([item]);
  const { isFavorite, toggleFavorite } = useFavorite(item);
  const isOffline = useOfflineMode();
  const { deleteFile } = useDownload();
  const user = useAtomValue(userAtom);
  const deleteFromServer = useDeleteFromServer();

  return useCallback((): Promise<void> => {
    if (!item.Type || !ACTION_SHEET_ITEM_TYPES.has(item.Type)) {
      return Promise.resolve();
    }

    const offersServerDelete = !isOffline && mayDeleteFromServer(item, user);
    const options: string[] = [
      t("common.mark_as_played"),
      t("common.mark_as_not_played"),
      isFavorite
        ? t("music.track_options.remove_from_favorites")
        : t("music.track_options.add_to_favorites"),
      ...(isOffline ? [t("home.downloads.delete_download")] : []),
      ...(offersServerDelete ? [t("item_card.delete_from_server.action")] : []),
      t("common.cancel"),
    ];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex =
      isOffline || offersServerDelete ? cancelButtonIndex - 1 : undefined;

    return new Promise<void>((resolve) => {
      showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
        },
        async (selectedIndex) => {
          if (selectedIndex === 0) {
            await markAsPlayedStatus(true);
          } else if (selectedIndex === 1) {
            await markAsPlayedStatus(false);
          } else if (selectedIndex === 2) {
            toggleFavorite();
          } else if (isOffline && selectedIndex === 3 && item.Id) {
            deleteFile(item.Id);
          } else if (offersServerDelete && selectedIndex === 3) {
            // Resolved only once the confirmation is answered, so a caller
            // that mounted the sheet on demand keeps it until then.
            await deleteFromServer(item);
          }
          resolve();
        },
      );
    });
  }, [
    showActionSheetWithOptions,
    isFavorite,
    markAsPlayedStatus,
    toggleFavorite,
    isOffline,
    deleteFile,
    deleteFromServer,
    item,
    user,
    t,
  ]);
}
