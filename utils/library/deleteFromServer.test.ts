import { makeApi } from "@/test-utils/jellyfinApi";
import {
  canDeleteFromServer,
  deleteFromServer,
  watchedEpisodesToDelete,
} from "./deleteFromServer";

// The SDK puts the query in the URL itself.
const ITEMS = /^https:\/\/jellyfin\.example\.com\/Items\?/;
const queryOf = (api: ReturnType<typeof makeApi>) =>
  Object.fromEntries(
    new URL(api.mock.history.get[0].url ?? "").searchParams.entries(),
  );

describe("canDeleteFromServer", () => {
  test("asks the server for CanDelete and trusts its answer", async () => {
    const api = makeApi();
    api.mock
      .onGet(ITEMS)
      .reply(200, { Items: [{ Id: "movie-1", CanDelete: true }] });

    await expect(canDeleteFromServer(api, "user-1", "movie-1")).resolves.toBe(
      true,
    );
    expect(queryOf(api)).toMatchObject({
      ids: "movie-1",
      fields: "CanDelete",
    });
  });

  test("hides deletion when the server does not say yes", async () => {
    const api = makeApi();
    api.mock.onGet(ITEMS).reply(200, { Items: [{ Id: "movie-1" }] });

    await expect(canDeleteFromServer(api, "user-1", "movie-1")).resolves.toBe(
      false,
    );
  });
});

describe("watchedEpisodesToDelete", () => {
  test("lists the played episodes on disk the user may delete", async () => {
    const api = makeApi();
    api.mock.onGet(ITEMS).reply(200, {
      Items: [
        { Id: "episode-1", CanDelete: true },
        { Id: "episode-2", CanDelete: false },
        { Id: "episode-3", CanDelete: true },
      ],
    });

    await expect(
      watchedEpisodesToDelete(api, "user-1", "series-1"),
    ).resolves.toEqual(["episode-1", "episode-3"]);
    expect(queryOf(api)).toMatchObject({
      parentId: "series-1",
      recursive: "true",
      includeItemTypes: "Episode",
      isPlayed: "true",
      isMissing: "false",
    });
  });
});

describe("deleteFromServer", () => {
  test("deletes each item and carries on past one the server refuses", async () => {
    const api = makeApi();
    api.mock
      .onDelete("https://jellyfin.example.com/Items/episode-1")
      .reply(204)
      .onDelete("https://jellyfin.example.com/Items/episode-2")
      .reply(403)
      .onDelete("https://jellyfin.example.com/Items/episode-3")
      .reply(204);

    await expect(
      deleteFromServer(api, ["episode-1", "episode-2", "episode-3"]),
    ).resolves.toEqual({
      deleted: ["episode-1", "episode-3"],
      failed: ["episode-2"],
    });
  });
});
