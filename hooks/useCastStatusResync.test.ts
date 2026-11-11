import { renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

let mockClient: { requestStatus: jest.Mock } | null = null;

jest.mock("react-native-google-cast", () => ({
  useRemoteMediaClient: () => mockClient,
}));

import { useCastStatusResync } from "./useCastStatusResync";

const appStateListeners: ((state: AppStateStatus) => void)[] = [];
const removeListener = jest.fn();

beforeEach(() => {
  appStateListeners.length = 0;
  removeListener.mockClear();
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: AppStateStatus) => void);
      return { remove: removeListener };
    });
  mockClient = { requestStatus: jest.fn(() => Promise.resolve()) };
});

afterEach(() => {
  jest.restoreAllMocks();
});

const emit = (state: AppStateStatus) => {
  for (const listener of appStateListeners) listener(state);
};

describe("useCastStatusResync", () => {
  it("asks the receiver for its status when a cast client appears", async () => {
    await renderHook(() => useCastStatusResync());

    expect(mockClient?.requestStatus).toHaveBeenCalledTimes(1);
  });

  it("asks again each time the app comes back to the foreground", async () => {
    // The phone missed the status the TV sent while it was in the background
    // and kept driving a media session the TV had left.
    await renderHook(() => useCastStatusResync());

    emit("background");
    emit("active");
    emit("inactive");
    emit("active");

    expect(mockClient?.requestStatus).toHaveBeenCalledTimes(3);
  });

  it("does nothing without a Cast session", async () => {
    mockClient = null;
    await renderHook(() => useCastStatusResync());
    emit("active");

    expect(appStateListeners).toHaveLength(0);
  });

  it("survives a status request the ended session refuses", async () => {
    mockClient = {
      requestStatus: jest.fn(() => Promise.reject(new Error("No session"))),
    };
    await renderHook(() => useCastStatusResync());
    emit("active");

    // A rejection nothing handles fails the test.
    await Promise.resolve();
    expect(mockClient.requestStatus).toHaveBeenCalledTimes(2);
  });

  it("stops listening when unmounted", async () => {
    const { unmount } = await renderHook(() => useCastStatusResync());
    await unmount();

    expect(removeListener).toHaveBeenCalled();
  });
});
