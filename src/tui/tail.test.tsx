import { describe, expect, it } from "bun:test";
import { TailView } from "./tail";

// Minimal render test without Ink renderer
// Ensures the component returns a React element with the expected header text.
describe("TailView", () => {
  it("renders the event tail header", () => {
    const element = TailView({ events: [] });
    expect(element).toBeTruthy();
    const children = (element as any).props?.children ?? [];
    const text = Array.isArray(children)
      ? children.map((child) => (child as any)?.props?.children ?? "").join(" ")
      : (children as any)?.props?.children ?? "";
    expect(String(text)).toContain("Event Tail");
  });
});
