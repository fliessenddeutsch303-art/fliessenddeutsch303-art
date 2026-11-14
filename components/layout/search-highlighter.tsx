"use client";

import { useEffect } from "react";
import { searchAliases } from "@/lib/tag-search";

/**
 * Highlights what is typed in any search or filter box inside the results next to it, across the whole app.
 *
 * It paints with the CSS Custom Highlight API, so it never changes the DOM: React keeps owning the markup and
 * the highlighter cannot trigger its own MutationObserver (the Arabic translator once looped that way).
 *
 * A field counts as a search field when it has `data-search`, or when it is a text box outside any form or
 * table whose placeholder/label reads like a search ("Search...", "Tag", "بحث", "التصنيف", ...).
 * Results are looked up in the closest `[data-search-scope]`, else the closest ancestor holding a table,
 * else <main>. Table headers, labels and `[data-no-search-highlight]` are skipped.
 * Text inside editable cells (inputs, e.g. the lead board) cannot be painted, so a matching cell gets
 * `data-search-hit` and is outlined instead; React does not own that attribute.
 */
const HIGHLIGHT = "fd-search";
const SEARCH_WORDS = /search|filter|tag|name or phone|بحث|ابحث|البحث|تصفية|فلتر|التصنيف|تصنيف|الاسم أو/i;
const SKIP = "script,style,noscript,textarea,input,select,option,thead,th,label,[data-no-search-highlight]";

type Normalized = { text: string; map: number[] };

/** Lower-case, unify Arabic letter forms and digits, drop diacritics; `map` points each character back to the original index. */
function normalize(value: string): Normalized {
  let text = "";
  const map: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let char = value[index];
    if (/[ً-ْـ]/.test(char)) continue;
    if (/[٠-٩]/.test(char)) char = String(char.charCodeAt(0) - 0x0660);
    else if (/[۰-۹]/.test(char)) char = String(char.charCodeAt(0) - 0x06f0);
    else if (/[أإآ]/.test(char)) char = "ا";
    else if (char === "ى") char = "ي";
    else if (char === "ة") char = "ه";
    else if (char.toLowerCase().length === 1) char = char.toLowerCase();
    text += char;
    map.push(index);
  }
  return { text, map };
}

function isSearchField(element: EventTarget | null): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  if (element.hasAttribute("data-search")) return true;
  if (!["text", "search", ""].includes(element.type) || element.readOnly || element.disabled) return false;
  if (element.closest("form, table, [role=dialog]")) return false;
  return SEARCH_WORDS.test(`${element.placeholder} ${element.getAttribute("aria-label") ?? ""}`);
}

function scopeOf(input: HTMLElement): Element | null {
  const explicit = input.closest("[data-search-scope]");
  if (explicit) return explicit;
  for (let node = input.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.querySelector("table")) return node;
    if (node.tagName === "MAIN") return node;
  }
  return document.querySelector("main");
}

/** What to look for: the query itself, its digits when it reads like a phone number, and bilingual tag aliases. */
function needlesFor(query: string) {
  const plain = normalize(query.trim()).text;
  if (!plain) return { words: [] as string[], digits: "" };
  const words = new Set([plain, ...searchAliases(query).map((alias) => normalize(alias).text)]);
  const digits = /^[\d\s+\-()]+$/.test(plain) ? plain.replace(/\D/g, "") : "";
  return { words: [...words].filter(Boolean), digits };
}

function rangesIn(node: Text, needles: ReturnType<typeof needlesFor>) {
  const source = node.nodeValue ?? "";
  if (!source.trim()) return [];
  const { text, map } = normalize(source);
  const found: Array<[number, number]> = [];
  for (const word of needles.words) {
    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + word.length)) found.push([map[at], map[at + word.length - 1] + 1]);
  }
  if (needles.digits.length) {
    // "010 1234" should still match a stored "0101234...": compare digits only.
    const positions: number[] = [];
    let digits = "";
    for (let index = 0; index < text.length; index += 1) if (/\d/.test(text[index])) { digits += text[index]; positions.push(map[index]); }
    for (let at = digits.indexOf(needles.digits); at !== -1; at = digits.indexOf(needles.digits, at + needles.digits.length)) found.push([positions[at], positions[at + needles.digits.length - 1] + 1]);
  }
  return found.map(([start, end]) => { const range = new Range(); range.setStart(node, start); range.setEnd(node, end); return range; });
}

function valueMatches(value: string, needles: ReturnType<typeof needlesFor>) {
  const { text } = normalize(value);
  if (needles.words.some((word) => text.includes(word))) return true;
  return Boolean(needles.digits) && text.replace(/\D/g, "").includes(needles.digits);
}

export function SearchHighlighter() {
  useEffect(() => {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
    const registry = (CSS as unknown as { highlights: Map<string, unknown> }).highlights;
    const highlight = new (window as unknown as { Highlight: new () => Set<Range> }).Highlight();
    registry.set(HIGHLIGHT, highlight);
    let timer: number | undefined;
    let active = false;

    const paint = () => {
      highlight.clear();
      const hits = new Set<Element>();
      const fields = [...document.querySelectorAll<HTMLInputElement>("input")].filter((input) => isSearchField(input) && input.value.trim() && input.isConnected);
      active = fields.length > 0;
      for (const field of fields) {
        const scope = scopeOf(field);
        if (!scope) continue;
        const needles = needlesFor(field.value);
        if (!needles.words.length && !needles.digits) continue;
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => node.parentElement && !node.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
        });
        for (let node = walker.nextNode(); node; node = walker.nextNode()) for (const range of rangesIn(node as Text, needles)) highlight.add(range);
        for (const cell of scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("td input:not([type=checkbox]):not([type=date]):not([type=time]):not([type=number]), td textarea")) {
          if (cell.value && valueMatches(cell.value, needles)) hits.add(cell);
        }
      }
      document.querySelectorAll("[data-search-hit]").forEach((element) => { if (!hits.has(element)) element.removeAttribute("data-search-hit"); });
      hits.forEach((element) => element.setAttribute("data-search-hit", ""));
    };
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 60); };
    const onInput = (event: Event) => { if (isSearchField(event.target)) schedule(); };

    // Results re-render after a filter changes or a page loads more rows; repaint then too.
    const observer = new MutationObserver(() => { if (active) schedule(); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("input", onInput, true);
    schedule();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", onInput, true);
      window.clearTimeout(timer);
      registry.delete(HIGHLIGHT);
      document.querySelectorAll("[data-search-hit]").forEach((element) => element.removeAttribute("data-search-hit"));
    };
  }, []);
  return null;
}
