import { describe, it, expect } from "vitest";
import { DocsetResultSchema, SearchResultSchema, DocumentationPageSchema } from "../src/types.js";

describe("DocsetResultSchema", () => {
    it("parses valid docset", () => {
        const data = {
            name: "Python 3",
            identifier: "python3",
            platform: "python",
            full_text_search: "enabled",
        };
        const result = DocsetResultSchema.parse(data);
        expect(result.name).toBe("Python 3");
        expect(result.notice).toBeUndefined();
    });

    it("includes optional notice", () => {
        const data = {
            name: "Python 3",
            identifier: "python3",
            platform: "python",
            full_text_search: "enabled",
            notice: "Some notice",
        };
        const result = DocsetResultSchema.parse(data);
        expect(result.notice).toBe("Some notice");
    });

    it("rejects missing required fields", () => {
        expect(() => DocsetResultSchema.parse({ name: "Test" })).toThrow();
    });
});

describe("SearchResultSchema", () => {
    it("parses valid search result", () => {
        const data = {
            name: "sort_by",
            type: "Method",
            load_url: "http://127.0.0.1:1234/page.html",
        };
        const result = SearchResultSchema.parse(data);
        expect(result.name).toBe("sort_by");
        expect(result.platform).toBeUndefined();
    });
});

describe("DocumentationPageSchema", () => {
    it("parses valid page", () => {
        const data = {
            content: "# Hello",
            load_url: "http://127.0.0.1:1234/page.html",
        };
        const result = DocumentationPageSchema.parse(data);
        expect(result.content).toBe("# Hello");
        expect(result.error).toBeUndefined();
    });
});
