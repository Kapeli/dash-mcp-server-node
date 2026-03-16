#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { workingApiBaseUrl, estimateTokens } from "./dash-api.js";
import { parseFragment, extractSection, htmlToText } from "./html-processing.js";
import type { DocsetResult, SearchResult, DocsetResults, SearchResults, DocumentationPage } from "./types.js";

const server = new McpServer({
    name: "Dash Documentation API",
    version: "1.1.0",
});

type LogLevel = "debug" | "info" | "warning" | "error";
type LogFn = (level: LogLevel, message: string) => void;

function makeLogFn(): LogFn {
    return (level, message) => {
        server.sendLoggingMessage({ level, data: message }).catch(() => {});
    };
}

// ── list_installed_docsets ──

server.tool(
    "list_installed_docsets",
    "List all installed documentation sets in Dash. An empty list is returned if the user has no docsets installed. Results are automatically truncated if they would exceed 25,000 tokens.",
    {},
    async () => {
        const log = makeLogFn();
        try {
            const baseUrl = await workingApiBaseUrl(log);
            if(baseUrl == null) {
                return text({ docsets: [], error: "Failed to connect to Dash API Server. Please ensure Dash is running and the API server is enabled (in Dash Settings > Integration)." });
            }

            log("debug", "Fetching installed docsets from Dash API");

            const response = await fetch(`${baseUrl}/docsets/list`, {
                signal: AbortSignal.timeout(30000),
            });
            if(!response.ok) {
                if(response.status === 404) {
                    log("warning", "No docsets found. Install some in Settings > Downloads.");
                    return text({ docsets: [], error: "No docsets found. Instruct the user to install some docsets in Settings > Downloads." });
                }
                return text({ docsets: [], error: `HTTP error: ${response.status} ${response.statusText}` });
            }

            const result = await response.json();
            const docsets = result.docsets ?? [];
            log("info", `Found ${docsets.length} installed docsets`);

            // Build result list with token limit checking
            const tokenLimit = 25000;
            let currentTokens = 100;
            const limitedDocsets: DocsetResult[] = [];

            for(let i = 0; i < docsets.length; ++i) {
                const docset = docsets[i];
                const docsetInfo: DocsetResult = {
                    name: docset.name,
                    identifier: docset.identifier,
                    platform: docset.platform,
                    full_text_search: docset.full_text_search,
                    notice: docset.notice ?? null,
                };

                const docsetTokens = estimateTokens(docsetInfo);
                if(currentTokens + docsetTokens > tokenLimit) {
                    log("warning", `Token limit reached. Returning ${limitedDocsets.length} of ${docsets.length} docsets to stay under 25k token limit.`);
                    break;
                }

                limitedDocsets.push(docsetInfo);
                currentTokens += docsetTokens;
            }

            if(limitedDocsets.length < docsets.length) {
                log("info", `Returned ${limitedDocsets.length} docsets (truncated from ${docsets.length} due to token limit)`);
            }

            return text({ docsets: limitedDocsets } as DocsetResults);
        }
        catch(e) {
            log("error", `Failed to get installed docsets: ${e}`);
            return text({ docsets: [], error: `Failed to get installed docsets: ${e}` });
        }
    }
);

// ── search_documentation ──

server.tool(
    "search_documentation",
    "Search for documentation across docset identifiers and snippets. Results are automatically truncated if they would exceed 25,000 tokens.",
    {
        query: z.string().describe("The search query string"),
        docset_identifiers: z.string().describe("Comma-separated list of docset identifiers to search in (from list_installed_docsets)"),
        search_snippets: z.boolean().default(true).describe("Whether to include snippets in search results"),
        max_results: z.number().int().min(1).max(1000).default(100).describe("Maximum number of results to return (1-1000)"),
    },
    async (params) => {
        const log = makeLogFn();
        const { query, docset_identifiers, search_snippets, max_results } = params;

        if(!query.trim()) {
            log("error", "Query cannot be empty");
            return text({ results: [], error: "Query cannot be empty" });
        }

        if(!docset_identifiers.trim()) {
            log("error", "docset_identifiers cannot be empty. Get the docset identifiers using list_installed_docsets");
            return text({ results: [], error: "docset_identifiers cannot be empty. Get the docset identifiers using list_installed_docsets" });
        }

        try {
            const baseUrl = await workingApiBaseUrl(log);
            if(baseUrl == null) {
                return text({ results: [], error: "Failed to connect to Dash API Server. Please ensure Dash is running and the API server is enabled (in Dash Settings > Integration)." });
            }

            const url = new URL(`${baseUrl}/search`);
            url.searchParams.set("query", query);
            url.searchParams.set("docset_identifiers", docset_identifiers);
            url.searchParams.set("search_snippets", String(search_snippets));
            url.searchParams.set("max_results", String(max_results));

            log("debug", `Searching Dash API with query: '${query}'`);

            const response = await fetch(url.toString(), {
                signal: AbortSignal.timeout(30000),
            });

            if(!response.ok) {
                const errorText = await response.text();
                if(response.status === 400) {
                    if(errorText.includes("Docset with identifier") && errorText.includes("not found")) {
                        log("error", "Invalid docset identifier. Run list_installed_docsets to see available docsets.");
                        return text({ results: [], error: "Invalid docset identifier. Run list_installed_docsets to see available docsets, then use the exact identifier from that list." });
                    }
                    if(errorText.includes("No docsets found")) {
                        log("error", "No valid docsets found for search.");
                        return text({ results: [], error: "No valid docsets found for search. Either provide valid docset identifiers from list_installed_docsets, or set search_snippets=true to search snippets only." });
                    }
                    log("error", `Bad request: ${errorText}`);
                    return text({ results: [], error: `Bad request: ${errorText}. Please ensure Dash is running and the API server is enabled (in Dash Settings > Integration).` });
                }
                if(response.status === 403) {
                    if(errorText.includes("API access blocked due to Dash trial expiration")) {
                        log("error", "Dash trial expired. Purchase Dash to continue using the API.");
                        return text({ results: [], error: "Your Dash trial has expired. Purchase Dash at https://kapeli.com/dash to continue using the API. During trial expiration, API access is blocked." });
                    }
                    log("error", `Forbidden: ${errorText}`);
                    return text({ results: [], error: `Forbidden: ${errorText}. Please ensure Dash is running and the API server is enabled (in Dash Settings > Integration).` });
                }
                log("error", `HTTP error: ${response.status} ${errorText}`);
                return text({ results: [], error: `HTTP error: ${response.status}. Please ensure Dash is running and the API server is enabled (in Dash Settings > Integration).` });
            }

            const result = await response.json();

            let warningMessage: string | undefined;
            if(result.message) {
                warningMessage = result.message;
                log("warning", warningMessage!);
            }

            let results: any[] = result.results ?? [];
            // Filter out empty dict entries (Dash API returns [{}] for no results)
            results = results.filter((r: any) => r && Object.keys(r).length > 0);

            if(results.length === 0 && query.includes(" ")) {
                return text({ results: [], error: "Nothing found. Try to search for fewer terms." });
            }

            log("info", `Found ${results.length} results`);

            // Build result list with token limit checking
            const tokenLimit = 25000;
            let currentTokens = 100;
            const limitedResults: SearchResult[] = [];

            for(let i = 0; i < results.length; ++i) {
                const item = results[i];
                const searchResult: SearchResult = {
                    name: item.name,
                    type: item.type,
                    platform: item.platform ?? null,
                    load_url: item.load_url,
                    docset: item.docset ?? null,
                    description: item.description ?? null,
                    language: item.language ?? null,
                    tags: item.tags ?? null,
                };

                const resultTokens = estimateTokens(searchResult);
                if(currentTokens + resultTokens > tokenLimit) {
                    log("warning", `Token limit reached. Returning ${limitedResults.length} of ${results.length} results to stay under 25k token limit.`);
                    break;
                }

                limitedResults.push(searchResult);
                currentTokens += resultTokens;
            }

            if(limitedResults.length < results.length) {
                log("info", `Returned ${limitedResults.length} results (truncated from ${results.length} due to token limit)`);
            }

            return text({ results: limitedResults, error: warningMessage ?? null } as SearchResults);
        }
        catch(e) {
            log("error", `Search failed: ${e}`);
            return text({ results: [], error: `Search failed: ${e}. Please ensure Dash is running and the API server is enabled (in Dash Settings > Integration).` });
        }
    }
);

// ── enable_docset_fts ──

server.tool(
    "enable_docset_fts",
    "Enable full-text search for a specific docset.",
    {
        identifier: z.string().describe("The docset identifier (from list_installed_docsets)"),
    },
    async (params) => {
        const log = makeLogFn();
        const { identifier } = params;

        if(!identifier.trim()) {
            log("error", "Docset identifier cannot be empty");
            return text(false);
        }

        try {
            const baseUrl = await workingApiBaseUrl(log);
            if(baseUrl == null) {
                return text(false);
            }

            log("debug", `Enabling FTS for docset: ${identifier}`);

            const url = new URL(`${baseUrl}/docsets/enable_fts`);
            url.searchParams.set("identifier", identifier);

            const response = await fetch(url.toString(), {
                signal: AbortSignal.timeout(30000),
            });

            if(!response.ok) {
                if(response.status === 400) {
                    log("error", `Bad request: ${await response.text()}`);
                    return text(false);
                }
                if(response.status === 404) {
                    log("error", `Docset not found: ${identifier}`);
                    return text(false);
                }
                log("error", `HTTP error: ${response.status}`);
                return text(false);
            }

            return text(true);
        }
        catch(e) {
            log("error", `Failed to enable FTS: ${e}`);
            return text(false);
        }
    }
);

// ── load_documentation_page ──

server.tool(
    "load_documentation_page",
    "Load a documentation page from a load_url returned by search_documentation. Returns the page content as plain text with markdown-style links.",
    {
        load_url: z.string().describe("The load_url value from a search result (must point to the local Dash API at 127.0.0.1)"),
    },
    async (params) => {
        const log = makeLogFn();
        const { load_url } = params;

        if(!load_url.startsWith("http://127.0.0.1")) {
            log("error", "Invalid URL: load_url must point to the local Dash API (http://127.0.0.1)");
            return text({
                content: "",
                load_url,
                error: "Invalid URL: load_url must point to the local Dash API (http://127.0.0.1). Only URLs returned by search_documentation are supported.",
            } as DocumentationPage);
        }

        try {
            log("debug", `Loading documentation page: ${load_url}`);

            const response = await fetch(load_url, {
                signal: AbortSignal.timeout(30000),
            });

            if(!response.ok) {
                if(response.status === 403) {
                    const errorText = await response.text();
                    if(errorText.includes("API access blocked due to Dash trial expiration")) {
                        log("error", "Dash trial expired. Purchase Dash to continue using the API.");
                        return text({
                            content: "",
                            load_url,
                            error: "Your Dash trial has expired. Purchase Dash at https://kapeli.com/dash to continue using the API.",
                        } as DocumentationPage);
                    }
                    log("error", `Forbidden: ${errorText}`);
                    return text({ content: "", load_url, error: `Forbidden: ${errorText}` } as DocumentationPage);
                }
                if(response.status === 404) {
                    log("error", "Documentation page not found.");
                    return text({ content: "", load_url, error: "Documentation page not found." } as DocumentationPage);
                }
                log("error", `HTTP error: ${response.status}`);
                return text({ content: "", load_url, error: `HTTP error: ${response.status}` } as DocumentationPage);
            }

            const html = await response.text();
            const anchorId = parseFragment(load_url);
            const cleanedHtml = extractSection(html, anchorId);
            const content = htmlToText(cleanedHtml);

            log("info", `Successfully loaded documentation page (${content.length} characters)`);

            return text({ content, load_url } as DocumentationPage);
        }
        catch(e) {
            log("error", `Failed to load documentation page: ${e}`);
            return text({
                content: "",
                load_url,
                error: `Failed to load documentation page: ${e}`,
            } as DocumentationPage);
        }
    }
);

// ── helpers ──

function text(value: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
    };
}

// ── main ──

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});
