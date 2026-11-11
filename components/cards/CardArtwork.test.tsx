import { render, screen } from "@testing-library/react-native";
import { CardArtwork } from "./CardArtwork";
import type { CardData } from "./CardData";

// The real image resolves auth headers through the provider tree; the double
// keeps the props each render hands it.
const mockImageProps: Record<string, unknown>[] = [];
jest.mock("@/components/common/ServerImage", () => ({
  Image: (props: Record<string, unknown>) => {
    mockImageProps.push(props);
    return null;
  },
}));

const renderArtwork = (card: Partial<CardData>) =>
  render(
    <CardArtwork
      card={{ id: "card-1", title: "Card", ...card }}
      width={200}
      height={112}
      cornerRadius={14}
    />,
  );

// A list reuses a card's cell for another item. Without a key per item the
// image kept the previous artwork on screen until the new one decoded.
test("keys its image to the card, so a reused cell drops the old artwork", async () => {
  const view = await renderArtwork({ imageUrl: "http://server/a.jpg" });
  expect(mockImageProps.at(-1)?.recyclingKey).toBe("card-1");

  await view.rerender(
    <CardArtwork
      card={{ id: "card-2", title: "Other", imageUrl: "http://server/b.jpg" }}
      width={200}
      height={112}
      cornerRadius={14}
    />,
  );
  expect(mockImageProps.at(-1)?.recyclingKey).toBe("card-2");
});

// A card scrolled back into view, or on a page opened again, has its artwork
// in the cache: it shows at once instead of fading in a second time.
test("fades its artwork in only when it is not cached yet", async () => {
  await renderArtwork({ imageUrl: "http://server/a.jpg" });

  expect(mockImageProps.at(-1)?.transition).toEqual(
    expect.objectContaining({ skipOnCacheHit: "all" }),
  );
});

describe("CardArtwork corner badge", () => {
  test("shows LIVE on a live program", async () => {
    await renderArtwork({ live: true });

    expect(screen.getByText("player.live")).toBeTruthy();
  });

  test("shows no LIVE badge on any other card", async () => {
    await renderArtwork({ live: false, unplayedCount: 3 });

    expect(screen.queryByText("player.live")).toBeNull();
    // The unplayed count keeps the corner.
    expect(screen.getByText("3")).toBeTruthy();
  });
});

// Watched items only lacked the unwatched dot, which on a row of posters was
// hard to tell apart from an item with no watch state at all.
describe("CardArtwork watched mark", () => {
  test("marks a watched item with a checkmark", async () => {
    await renderArtwork({ watched: true });

    expect(screen.getByLabelText("item_card.watched")).toBeTruthy();
  });

  test("leaves an unwatched item without it", async () => {
    await renderArtwork({ watched: false, unwatched: true });

    expect(screen.queryByLabelText("item_card.watched")).toBeNull();
  });

  test("gives the corner to a badge, a download count say", async () => {
    await renderArtwork({ watched: true, badgeLabel: "4" });

    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.queryByLabelText("item_card.watched")).toBeNull();
  });
});
