import type { Api } from "@jellyfin/sdk";
import {
  BaseItemKind,
  ItemFields,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api";

/**
 * Whether the server lets this user delete the item. `CanDelete` is only on an
 * item when it was asked for, and the server works it out from the user's
 * deletion policy and the item's library, so it is asked for here rather than
 * guessed from the policy on the phone.
 */
export const canDeleteFromServer = async (
  api: Api,
  userId: string,
  itemId: string,
): Promise<boolean> => {
  const { data } = await getLibraryApi(api).getItems({
    userId,
    ids: [itemId],
    fields: [ItemFields.CanDelete],
    enableImages: false,
    enableUserData: false,
  });

  return data.Items?.[0]?.CanDelete === true;
};

/**
 * The series' episodes the user has watched and may delete. Only what is on
 * disk counts: a missing or virtual episode has no file to free.
 */
export const watchedEpisodesToDelete = async (
  api: Api,
  userId: string,
  seriesId: string,
): Promise<string[]> => {
  const { data } = await getLibraryApi(api).getItems({
    userId,
    parentId: seriesId,
    recursive: true,
    includeItemTypes: [BaseItemKind.Episode],
    isPlayed: true,
    isMissing: false,
    fields: [ItemFields.CanDelete],
    enableImages: false,
  });

  return (data.Items ?? []).flatMap((episode) =>
    episode.Id && episode.CanDelete === true ? [episode.Id] : [],
  );
};

export interface DeleteResult {
  deleted: string[];
  failed: string[];
}

/**
 * Deletes the items one by one, so one the server refuses (a file it cannot
 * remove, a library the user may not delete from) does not take the rest
 * down with it, and the caller can say how many went.
 */
export const deleteFromServer = async (
  api: Api,
  itemIds: string[],
): Promise<DeleteResult> => {
  const result: DeleteResult = { deleted: [], failed: [] };

  for (const itemId of itemIds) {
    try {
      await getLibraryApi(api).deleteItem({ itemId });
      result.deleted.push(itemId);
    } catch {
      result.failed.push(itemId);
    }
  }

  return result;
};
