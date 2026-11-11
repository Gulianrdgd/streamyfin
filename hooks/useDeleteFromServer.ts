import type {
  BaseItemDto,
  UserDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { toast } from "sonner-native";
import { useActionSheet } from "@/hooks/useActionSheet";
import useRouter from "@/hooks/useAppRouter";
import { useNetworkAwareQueryClient } from "@/hooks/useNetworkAwareQueryClient";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import {
  canDeleteFromServer,
  deleteFromServer,
  watchedEpisodesToDelete,
} from "@/utils/library/deleteFromServer";
import { logAndCaptureError } from "@/utils/log";

/**
 * Whether to offer deletion for the item at all. The server's own `CanDelete`
 * decides when the item carries it; a list that did not ask for it falls back
 * on the user's deletion policy, and the server is asked before anything goes.
 */
export const mayDeleteFromServer = (
  item: BaseItemDto,
  user: UserDto | null | undefined,
): boolean => {
  if (!item.Id) return false;
  if (item.CanDelete != null) return item.CanDelete;

  const policy = user?.Policy;
  return (
    policy?.EnableContentDeletion === true ||
    (policy?.EnableContentDeletionFromFolders?.length ?? 0) > 0
  );
};

const confirmDeletion = (
  title: string,
  message: string,
  labels: { cancel: string; confirm: string },
) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
        {
          text: labels.confirm,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

type Scope = "item" | "watched_episodes";

interface Options {
  /** Called once the item itself is gone, to leave its page. */
  onItemDeleted?: () => void;
}

/**
 * Deletes an item, and its files, from the Jellyfin server, after asking. A
 * series also offers to delete only its watched episodes, which is how most
 * people free space on a show they are still watching.
 */
export const useDeleteFromServer = () => {
  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);
  const { t } = useTranslation();
  const queryClient = useNetworkAwareQueryClient();
  const { showActionSheetWithOptions } = useActionSheet();

  const pickScope = useCallback(
    (item: BaseItemDto) =>
      new Promise<Scope | null>((resolve) => {
        if (item.Type !== "Series") {
          resolve("item");
          return;
        }

        const options = [
          t("item_card.delete_from_server.delete_watched_episodes"),
          t("item_card.delete_from_server.delete_series"),
          t("common.cancel"),
        ];
        showActionSheetWithOptions(
          {
            title: item.Name ?? undefined,
            options,
            cancelButtonIndex: 2,
            destructiveButtonIndex: [0, 1],
          },
          (index) =>
            resolve(
              index === 0 ? "watched_episodes" : index === 1 ? "item" : null,
            ),
        );
      }),
    [showActionSheetWithOptions, t],
  );

  return useCallback(
    async (item: BaseItemDto, { onItemDeleted }: Options = {}) => {
      if (!api || !user?.Id || !item.Id) return;
      const name = item.Name ?? "";

      try {
        const scope = await pickScope(item);
        if (!scope) return;

        let ids: string[];
        let message: string;
        if (scope === "watched_episodes") {
          ids = await watchedEpisodesToDelete(api, user.Id, item.Id);
          if (ids.length === 0) {
            Alert.alert(t("item_card.delete_from_server.no_watched_episodes"));
            return;
          }
          message = t("item_card.delete_from_server.confirm_episodes", {
            count: ids.length,
            name,
          });
        } else {
          if (!(await canDeleteFromServer(api, user.Id, item.Id))) {
            Alert.alert(t("item_card.delete_from_server.not_allowed"));
            return;
          }
          ids = [item.Id];
          message = t("item_card.delete_from_server.confirm_item", { name });
        }

        const confirmed = await confirmDeletion(
          t("item_card.delete_from_server.confirm_title"),
          message,
          { cancel: t("common.cancel"), confirm: t("common.delete") },
        );
        if (!confirmed) return;

        const { deleted, failed } = await deleteFromServer(api, ids);

        if (deleted.length > 0) {
          toast.success(
            scope === "watched_episodes"
              ? t("item_card.delete_from_server.deleted_episodes", {
                  count: deleted.length,
                })
              : t("item_card.delete_from_server.deleted"),
          );
          // Rows, grids, next up and the series page all list what went.
          queryClient.invalidateQueries();
        }
        if (failed.length > 0) {
          toast.error(
            t("item_card.delete_from_server.failed", { count: failed.length }),
          );
        }
        if (scope === "item" && deleted.includes(item.Id)) onItemDeleted?.();
      } catch (error) {
        logAndCaptureError("Deleting from the server failed", error);
        toast.error(t("item_card.delete_from_server.failed", { count: 1 }));
      }
    },
    [api, user, pickScope, queryClient, t],
  );
};

/** The header's back navigation, for leaving the page of a deleted item. */
export const useLeaveDeletedItem = () => {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);
};
