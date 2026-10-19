import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent } from "./tabs";

// The app keeps the calculator/AI tabs mounted with `forceMount` so their state survives tab switches.
describe("TabsContent forceMount", () => {
  const render = () =>
    renderToStaticMarkup(
      h(
        Tabs,
        { defaultValue: "registry" },
        h(TabsContent, { value: "calculator", forceMount: true, className: "data-[state=inactive]:hidden" }, "CALC"),
        h(TabsContent, { value: "registry" }, "REGISTRY"),
        h(TabsContent, { value: "ai" }, "AI-UNMOUNTED"),
      ),
    );

  it("keeps an inactive forceMount tab in the DOM but hidden", () => {
    const html = render();
    expect(html).toMatch(/<div[^>]*hidden[^>]*>CALC<\/div>/);
  });

  it("renders the selected tab visible and drops inactive tabs without forceMount", () => {
    const html = render();
    expect(html).toMatch(/<div(?![^>]*hidden)[^>]*>REGISTRY<\/div>/);
    expect(html).not.toContain("AI-UNMOUNTED");
  });
});
