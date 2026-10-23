// node test/markdown.test.js
const assert = require("node:assert/strict");
const { parse, render } = require("../markdown.js");

const page = parse("# My title\n\nSome **bold**, *italic* and `code` with a [link](https://example.com/a?b=1&c=2).\n\n- one\n- two\n\n## More\n\nSecond paragraph\nwraps.");
assert.equal(page.title, "My title");
assert.ok(page.html.includes("<strong>bold</strong>"));
assert.ok(page.html.includes("<em>italic</em>"));
assert.ok(page.html.includes("<code>code</code>"));
assert.ok(page.html.includes('<a href="https://example.com/a?b=1&c=2" rel="noopener">link</a>'));
assert.ok(page.html.includes("<ul><li>one</li><li>two</li></ul>"));
assert.ok(page.html.includes("<h2>More</h2>"));
assert.ok(page.html.includes("<p>Second paragraph wraps.</p>"));
assert.ok(!page.html.includes("My title"));              // the title is not repeated in the description

// no title heading: everything is description
assert.equal(parse("Just text").title, null);
assert.equal(parse("Just text").html, "<p>Just text</p>");

// raw HTML and script links are never run
const nasty = parse("# <b>t</b>\n\n<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>");
assert.equal(nasty.title, "<b>t</b>");                    // the page sets it with textContent
assert.ok(!/<script|<img/.test(nasty.html));
assert.ok(nasty.html.includes('href="#"'));
assert.ok(!nasty.html.includes("javascript:"));

// code spans keep their content literally; plain text is available for the meta description
assert.ok(render("`**not bold**`").includes("<code>**not bold**</code>"));
assert.equal(parse("# T\n\nA **b** [c](https://d.e)").text, "A b c");

// Windows line endings
assert.equal(parse("# T\r\n\r\nHello\r\n").html, "<p>Hello</p>");

console.log("markdown.js: all checks passed");
