import { z } from "zod";

export const DocsetResultSchema = z.object({
    name: z.string().describe("Display name of the docset"),
    identifier: z.string().describe("Unique identifier"),
    platform: z.string().describe("Platform/type of the docset"),
    full_text_search: z.string().describe("Full-text search status: 'not supported', 'disabled', 'indexing', or 'enabled'"),
    notice: z.string().nullable().optional().describe("Optional notice about the docset status"),
});
export type DocsetResult = z.infer<typeof DocsetResultSchema>;

export const DocsetResultsSchema = z.object({
    docsets: z.array(DocsetResultSchema).default([]).describe("List of installed docsets"),
    error: z.string().nullable().optional().describe("Error message if there was an issue"),
});
export type DocsetResults = z.infer<typeof DocsetResultsSchema>;

export const SearchResultSchema = z.object({
    name: z.string().describe("Name of the documentation entry"),
    type: z.string().describe("Type of result (Function, Class, etc.)"),
    platform: z.string().nullable().optional().describe("Platform of the result"),
    load_url: z.string().describe("URL to load the documentation"),
    docset: z.string().nullable().optional().describe("Name of the docset"),
    description: z.string().nullable().optional().describe("Additional description"),
    language: z.string().nullable().optional().describe("Programming language (snippet results only)"),
    tags: z.string().nullable().optional().describe("Tags (snippet results only)"),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResultsSchema = z.object({
    results: z.array(SearchResultSchema).default([]).describe("List of search results"),
    error: z.string().nullable().optional().describe("Error message if there was an issue"),
});
export type SearchResults = z.infer<typeof SearchResultsSchema>;

export const DocumentationPageSchema = z.object({
    content: z.string().describe("The documentation page content"),
    load_url: z.string().describe("The URL that was loaded"),
    error: z.string().nullable().optional().describe("Error message if there was an issue"),
});
export type DocumentationPage = z.infer<typeof DocumentationPageSchema>;
