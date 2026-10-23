/*
 * A tiny markdown reader for content.md: the first "# heading" is the page title, everything after it
 * is the description. Supported: paragraphs, "##"/"###" headings, "- " lists, **bold**, *italic*,
 * `code` and [links](https://...). Raw HTML is shown as text, not run.
 */
(function (root) {
  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const safeUrl = (url) => (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "#");

  function inline(text) {
    const codes = [];
    let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) =>
      `<a href="${safeUrl(url.replace(/&amp;/g, "&")).replace(/"/g, "%22")}" rel="noopener">${label}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, "$1<em>$2</em>").replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, "$1<em>$2</em>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  }

  function render(md) {
    const blocks = md.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
    const html = [];
    for (const block of blocks) {
      const lines = block.split("\n").filter((l) => l.trim() !== "");
      if (!lines.length) continue;
      const heading = /^(#{2,3})\s+(.+)$/.exec(lines[0]);
      if (heading && lines.length === 1) {
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      } else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        html.push("<ul>" + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("") + "</ul>");
      } else {
        html.push(`<p>${inline(lines.map((l) => l.trim()).join(" "))}</p>`);
      }
    }
    return html.join("\n");
  }

  /** {title, html, text}: title from the first "# heading" (null if there is none), the rest rendered. */
  function parse(md) {
    const lines = md.replace(/\r\n?/g, "\n").split("\n");
    const at = lines.findIndex((l) => /^#\s+\S/.test(l));
    const title = at < 0 ? null : lines[at].replace(/^#\s+/, "").trim();
    const rest = (at < 0 ? lines : lines.filter((_, i) => i !== at)).join("\n");
    const html = render(rest);
    return { title, html, text: html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() };
  }

  const api = { render, parse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SalsaMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis);
