import { describe, it, expect } from "vitest";
import { parseFragment, extractSection } from "../src/html-processing.js";

describe("parseFragment", () => {
    it("extracts dash_ref fragment", () => {
        const url = "http://127.0.0.1:1234/Dash/abc/Enumerable.html#//dash_ref_method%2Di%2Dsort%5Fby/Method/sort_by/0";
        expect(parseFragment(url)).toBe("method-i-sort_by");
    });

    it("extracts plain fragment", () => {
        const url = "http://127.0.0.1:1234/page.html#some-anchor";
        expect(parseFragment(url)).toBe("some-anchor");
    });

    it("returns null for no fragment", () => {
        const url = "http://127.0.0.1:1234/page.html";
        expect(parseFragment(url)).toBeNull();
    });

    it("returns null for empty fragment", () => {
        const url = "http://127.0.0.1:1234/page.html#";
        expect(parseFragment(url)).toBeNull();
    });
});

describe("extractSection", () => {
    const FULL_PAGE = `
    <html><body>
      <nav><a href="/">Home</a><a href="/docs">Docs</a></nav>
      <aside class="sidebar"><ul><li>Item</li></ul></aside>
      <div id="method-i-sort_by">
        <h2>sort_by</h2>
        <p>Sorts by the block return value.</p>
      </div>
      <div id="method-i-map">
        <h2>map</h2>
        <p>Maps elements.</p>
      </div>
    </body></html>
    `;

    it("extracts anchor section", () => {
        const result = extractSection(FULL_PAGE, "method-i-sort_by");
        expect(result).toContain("sort_by");
        expect(result).toContain("Sorts by the block return value");
        expect(result).not.toContain("Maps elements");
    });

    it("strips nav when no anchor", () => {
        const result = extractSection(FULL_PAGE, null);
        expect(result).not.toContain("<nav>");
        expect(result).not.toContain("Home");
        expect(result).toContain("sort_by");
        expect(result).toContain("Maps elements");
    });

    it("strips sidebar when no anchor", () => {
        const result = extractSection(FULL_PAGE, null);
        expect(result).not.toContain("sidebar");
    });

    it("falls back to nav strip when anchor not found", () => {
        const result = extractSection(FULL_PAGE, "nonexistent-anchor");
        expect(result).not.toContain("<nav>");
        expect(result).toContain("sort_by");
    });

    it("walks up from thin anchor element", () => {
        const html = `
        <html><body>
          <div id="method-wrapper">
            <a id="method-i-foo"></a>
            <h2>foo</h2>
            <p>Foo description.</p>
          </div>
        </body></html>
        `;
        const result = extractSection(html, "method-i-foo");
        expect(result).toContain("Foo description");
    });

    it("walks up falls back when no block parent", () => {
        const html = `
        <html><body>
          <nav><a href="/">Home</a></nav>
          <a id="orphan-anchor"></a>
          <p>Content with no block wrapper.</p>
        </body></html>
        `;
        const result = extractSection(html, "orphan-anchor");
        // No suitable block parent, so falls back to nav-stripping
        expect(result).not.toContain("<nav>");
        expect(result).toContain("Content with no block wrapper");
    });
});
