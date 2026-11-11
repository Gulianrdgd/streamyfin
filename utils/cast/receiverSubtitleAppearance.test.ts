import { toReceiverSubtitleAppearance } from "./receiverSubtitleAppearance";

const base = {
  subtitleSize: 1,
  subtitleColor: "#FFFFFF",
  subtitleFont: "System",
  subtitleBackground: false,
};

describe("toReceiverSubtitleAppearance", () => {
  it("sends the default phone style as the receiver's normal size with a shadow", () => {
    expect(toReceiverSubtitleAppearance(base)).toEqual({
      dropShadow: "DROP_SHADOW",
      textColor: "#FFFFFF",
      textBackground: "transparent",
      textSize: "normal",
    });
  });

  it.each([
    [0.5, "smaller"],
    [0.8, "small"],
    [1.1, "large"],
    [1.3, "larger"],
    [2, "extralarge"],
  ])("maps a subtitle size of %s to %s", (subtitleSize, textSize) => {
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleSize }).textSize,
    ).toBe(textSize);
  });

  it("falls back on the normal size for a size that is not a number", () => {
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleSize: Number.NaN })
        .textSize,
    ).toBe("normal");
  });

  it("sends the colour without an alpha, which the receiver appends itself", () => {
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleColor: "#ffff00cc" })
        .textColor,
    ).toBe("#FFFF00");
  });

  it("leaves out a colour the receiver could not read", () => {
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleColor: "yellow" }),
    ).not.toHaveProperty("textColor");
  });

  it("keeps the TV's background box and drops the shadow when the phone draws a background", () => {
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleBackground: true }),
    ).toMatchObject({ dropShadow: "NONE", textBackground: "default" });
  });

  it("sends the generic font families and leaves out the ones the TV lacks", () => {
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleFont: "serif" }).font,
    ).toBe("serif");
    expect(
      toReceiverSubtitleAppearance({ ...base, subtitleFont: "opendyslexic" }),
    ).not.toHaveProperty("font");
    expect(toReceiverSubtitleAppearance(base)).not.toHaveProperty("font");
  });
});
