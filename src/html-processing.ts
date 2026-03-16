import * as cheerio from "cheerio";
import TurndownService from "turndown";

/**
 * Extract the HTML anchor ID from a Dash load_url fragment.
 *
 * Handles Dash-specific format: //dash_ref_{html-id}/Type/Name/Index
 * Falls back to plain #anchor for non-Dash docsets.
 */
export function parseFragment(loadUrl: string): string | null {
    let fragment: string;
    try {
        const url = new URL(loadUrl);
        fragment = decodeURIComponent(url.hash.slice(1)); // remove leading #
    }
    catch {
        return null;
    }

    if(!fragment) {
        return null;
    }

    if(fragment.startsWith("//dash_ref_")) {
        const anchor = fragment.slice("//dash_ref_".length).split("/")[0];
        return anchor || null;
    }

    return fragment;
}

/**
 * Extract a specific section from HTML by anchor ID, or strip navigation.
 *
 * With anchor_id: finds the element with that id and returns it. If the element
 * is a thin anchor tag, walks up to the nearest block-level parent.
 * Falls back to nav-stripping if the anchor is not found.
 *
 * Without anchor_id: removes nav/sidebar elements and returns the body.
 */
export function extractSection(html: string, anchorId: string | null): string {
    const $ = cheerio.load(html);

    if(anchorId) {
        const element = $(`[id="${anchorId}"]`).first();
        if(element.length) {
            const tagName = element.prop("tagName")?.toLowerCase();
            if(tagName === "a" || tagName === "span") {
                // Walk up from thin elements
                const blockParent = element.closest("div, section, article, li");
                if(blockParent.length) {
                    return $.html(blockParent);
                }
            }
            else {
                return $.html(element);
            }
        }
        // Anchor not found or thin element with no suitable parent — fall through
    }

    // Strip navigation and sidebar noise
    $("nav, aside, header, footer").remove();

    const body = $("body");
    if(body.length) {
        // Check if body has toc-related classes - if so, return inner html to avoid decomposing it
        const bodyClass = body.attr("class") || "";
        if(bodyClass) {
            return body.html() || $.html();
        }
        return $.html(body);
    }
    return $.html();
}

/**
 * Convert HTML to Markdown using Turndown.
 * Links are preserved, images are ignored, no line wrapping.
 */
export function htmlToText(html: string): string {
    const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
    });
    turndown.remove("img");
    return turndown.turndown(html);
}
