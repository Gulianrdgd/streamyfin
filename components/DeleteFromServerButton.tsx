import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { View, type ViewProps } from "react-native";
import { HeaderIcon } from "@/components/common/HeaderIcon";
import { RoundButton } from "@/components/RoundButton";
import {
  mayDeleteFromServer,
  useDeleteFromServer,
  useLeaveDeletedItem,
} from "@/hooks/useDeleteFromServer";
import { userAtom } from "@/utils/atoms/api";

interface Props extends ViewProps {
  item: BaseItemDto;
}

/**
 * Header button that deletes the page's item from the Jellyfin server, or a
 * series' watched episodes. Shown only to a user the server lets delete.
 */
export const DeleteFromServerButton: FC<Props> = ({ item, ...props }) => {
  const { t } = useTranslation();
  const user = useAtomValue(userAtom);
  const deleteItem = useDeleteFromServer();
  const leave = useLeaveDeletedItem();

  if (!mayDeleteFromServer(item, user)) return null;

  return (
    <View {...props}>
      <RoundButton
        size='large'
        accessibilityLabel={t("item_card.delete_from_server.action")}
        onPress={() => deleteItem(item, { onItemDeleted: leave })}
      >
        <HeaderIcon name='delete' />
      </RoundButton>
    </View>
  );
};
