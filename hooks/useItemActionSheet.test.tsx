import type {
  BaseItemDto,
  BaseItemKind,
} from "@jellyfin/sdk/lib/generated-client/models";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { showActionSheetWithOptions } from "@/test-utils/actionSheet";
import { makeApi } from "@/test-utils/jellyfinApi";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import { useItemActionSheet } from "./useItemActionSheet";

type SheetCallback = (selectedIndex?: number) => void | Promise<void>;

const mockShowActionSheet = jest.mocked(
  showActionSheetWithOptions as jest.Mock<
    void,
    [{ options: string[] }, SheetCallback]
  >,
);
const mockMarkAsPlayed = jest.fn(async (_played: boolean) => {});

jest.mock("@/hooks/useMarkAsPlayed", () => ({
  useMarkAsPlayed: () => mockMarkAsPlayed,
}));
jest.mock("@/hooks/useFavorite", () => ({
  useFavorite: () => ({ isFavorite: false, toggleFavorite: () => {} }),
}));
jest.mock("@/providers/DownloadProvider", () => ({
  useDownload: () => ({ deleteFile: () => {} }),
}));
jest.mock(
  "@/providers/OfflineModeProvider",
  () => jest.requireActual("@/test-utils/stubModules").onlineModule,
);

let store = createStore();

const wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={store}>
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  </JotaiProvider>
);

// Hands the "sheet closed" promise back inside an object: returned bare,
// awaiting the render would also wait for a sheet nobody has answered yet.
const present = async (
  type: BaseItemKind | undefined,
  extra: Partial<BaseItemDto> = {},
) => {
  const item: BaseItemDto = { Id: "item-1", Type: type, ...extra };
  const { result } = await renderHook(() => useItemActionSheet(item), {
    wrapper,
  });
  return { closed: result.current() };
};

beforeEach(() => {
  store = createStore();
});

describe("useItemActionSheet", () => {
  beforeEach(() => {
    mockShowActionSheet.mockReset();
    mockMarkAsPlayed.mockClear();
  });

  // Jellyfin 12 (web #8063) lets a folder be marked played, the way a series
  // already could; before this only Movie, Episode and Series opened the sheet.
  test.each<BaseItemKind>([
    "Movie",
    "Episode",
    "Video",
    "Series",
    "Season",
    "BoxSet",
    "Folder",
  ])("offers the played actions for a %s", async (type) => {
    await present(type);

    expect(mockShowActionSheet).toHaveBeenCalledTimes(1);
    expect(mockShowActionSheet.mock.calls[0][0].options).toEqual(
      expect.arrayContaining([
        "common.mark_as_played",
        "common.mark_as_not_played",
      ]),
    );
  });

  test.each<BaseItemKind | undefined>([
    "Person",
    "CollectionFolder",
    "Playlist",
    undefined,
  ])("presents nothing for a %s and resolves at once", async (type) => {
    const { closed } = await present(type);

    await expect(closed).resolves.toBeUndefined();
    expect(mockShowActionSheet).not.toHaveBeenCalled();
  });

  test("marks a folder played through the shared played mutation", async () => {
    const { closed } = await present("Folder");
    await mockShowActionSheet.mock.calls[0][1](0);
    await closed;

    expect(mockMarkAsPlayed).toHaveBeenCalledWith(true);
  });

  test("marks a season unplayed through the shared played mutation", async () => {
    const { closed } = await present("Season");
    await mockShowActionSheet.mock.calls[0][1](1);
    await closed;

    expect(mockMarkAsPlayed).toHaveBeenCalledWith(false);
  });
});

describe("useItemActionSheet server deletion", () => {
  beforeEach(() => {
    mockShowActionSheet.mockReset();
  });

  const signIn = (policy: Record<string, unknown>) => {
    const api = makeApi();
    store.set(apiAtom, api);
    store.set(userAtom, { Id: "user-1", Policy: policy } as never);
    return api;
  };

  test("offers deleting from the server to a user allowed to delete", async () => {
    signIn({ EnableContentDeletion: true });
    await present("Movie");

    const [{ options, destructiveButtonIndex }] = mockShowActionSheet.mock
      .calls[0] as unknown as [
      { options: string[]; destructiveButtonIndex: number },
    ];
    expect(options[destructiveButtonIndex]).toBe(
      "item_card.delete_from_server.action",
    );
  });

  test("offers it to a user allowed to delete from some libraries", async () => {
    signIn({ EnableContentDeletionFromFolders: ["library-1"] });
    await present("Episode");

    expect(mockShowActionSheet.mock.calls[0][0].options).toContain(
      "item_card.delete_from_server.action",
    );
  });

  test("leaves it out for a user the server does not let delete", async () => {
    signIn({ EnableContentDeletion: false });
    await present("Movie");

    expect(mockShowActionSheet.mock.calls[0][0].options).not.toContain(
      "item_card.delete_from_server.action",
    );
  });

  test("trusts the item's own CanDelete over the policy", async () => {
    signIn({ EnableContentDeletion: true });
    await present("Movie", { CanDelete: false });

    expect(mockShowActionSheet.mock.calls[0][0].options).not.toContain(
      "item_card.delete_from_server.action",
    );
  });

  test("asks the server and then the user before deleting anything", async () => {
    const api = signIn({ EnableContentDeletion: true });
    api.mock
      .onGet(/\/Items\?/)
      .reply(200, { Items: [{ Id: "item-1", CanDelete: true }] });
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        // The user cancels.
        buttons?.[0]?.onPress?.();
      });

    const { closed } = await present("Movie", { Name: "Festen" });
    await mockShowActionSheet.mock.calls[0][1](3);
    await closed;

    expect(alert).toHaveBeenCalledWith(
      "item_card.delete_from_server.confirm_title",
      "item_card.delete_from_server.confirm_item",
      expect.any(Array),
      expect.any(Object),
    );
    expect(api.mock.history.delete).toHaveLength(0);
    alert.mockRestore();
  });

  test("deletes the item once the user confirms", async () => {
    const api = signIn({ EnableContentDeletion: true });
    api.mock
      .onGet(/\/Items\?/)
      .reply(200, { Items: [{ Id: "item-1", CanDelete: true }] })
      .onDelete("https://jellyfin.example.com/Items/item-1")
      .reply(204);
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.[1]?.onPress?.();
      });

    const { closed } = await present("Movie", { Name: "Festen" });
    await mockShowActionSheet.mock.calls[0][1](3);
    await closed;

    expect(api.mock.history.delete.map((request) => request.url)).toEqual([
      "https://jellyfin.example.com/Items/item-1",
    ]);
    alert.mockRestore();
  });

  test("deletes only the watched episodes of a series when asked to", async () => {
    const api = signIn({ EnableContentDeletion: true });
    api.mock
      .onGet(/\/Items\?/)
      .reply(200, {
        Items: [
          { Id: "episode-1", CanDelete: true },
          { Id: "episode-2", CanDelete: true },
        ],
      })
      .onDelete(/\/Items\/episode-\d$/)
      .reply(204);
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.[1]?.onPress?.();
      });
    // The scope sheet opens from the item sheet's callback: the watched
    // episodes are picked there.
    mockShowActionSheet.mockImplementation((_options, callback) => {
      if (mockShowActionSheet.mock.calls.length === 2) void callback(0);
    });

    const { closed } = await present("Series", { Name: "Taskmaster" });
    await mockShowActionSheet.mock.calls[0][1](3);
    await closed;

    expect(mockShowActionSheet.mock.calls[1][0].options).toEqual([
      "item_card.delete_from_server.delete_watched_episodes",
      "item_card.delete_from_server.delete_series",
      "common.cancel",
    ]);
    expect(api.mock.history.delete.map((request) => request.url)).toEqual([
      "https://jellyfin.example.com/Items/episode-1",
      "https://jellyfin.example.com/Items/episode-2",
    ]);
    alert.mockRestore();
  });
});
