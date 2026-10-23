/**
 * @fileoverview Writes `impressum.html` beside the app, for a build that names
 * its provider.
 *
 * German law asks a public site to say who runs it (§ 5 DDG, § 18 MStV), and
 * who that is depends on where a build is published, which the code does not
 * know: the instance TU Hamburg hosts has TU Hamburg's, and a build published
 * elsewhere must not borrow it. So the text is chosen at build time, like the
 * backend's address — `VITE_IMPRESSUM=tuhh` reads `legal/impressum.tuhh.html` —
 * and a build without the variable gets no page and no link to one.
 *
 * A page of its own rather than a dialog in the app, because the law wants it
 * reachable directly: it has an address another site can link to, and it reads
 * without JavaScript. Its stylesheet is a file of its own too, since the
 * Content-Security-Policy that `_headers` sends for every path allows no inline
 * style.
 *
 * The app learns only that the page exists, through `IMPRESSUM_URL` in
 * `src/config.js`; the provider's name stays out of `src/`.
 *
 * @module vite-plugins/impressum
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const PAGE = "impressum.html";
const STYLESHEET = "impressum.css";

/** A file name, so the variable cannot point the build at another directory. */
const NAME = /^[a-z0-9-]+$/;

/**
 * Where the text for `name` lives, relative to the app's root.
 *
 * @param {string} name  The value of VITE_IMPRESSUM.
 * @returns {string}
 */
export function impressumSource(name) {
  if (!NAME.test(name)) {
    throw new Error(
      `VITE_IMPRESSUM must name a file in app/legal/ (lowercase letters, digits and dashes), not ${JSON.stringify(name)}.`,
    );
  }
  return join("legal", `impressum.${name}.html`);
}

/**
 * The page, around a fragment of its content. Comments are dropped: they are
 * notes for whoever maintains the text, not part of it.
 *
 * @param {string} fragment
 * @returns {string}
 */
export function impressumPage(fragment) {
  const body = fragment.replace(/<!--[\s\S]*?-->/g, "").trim();
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Impressum · Reflective APPilibrium</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="stylesheet" href="${STYLESHEET}" />
  </head>
  <body>
    <main>
${body}
      <p class="back"><a href="./">Zurück zur Anwendung</a></p>
    </main>
  </body>
</html>
`;
}

export const IMPRESSUM_CSS = `body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }
main { max-width: 40rem; padding: 2rem 16px; margin: 0 auto; }
h1 { font-size: 1.6rem; }
h2 { font-size: 1.1rem; margin-top: 1.5rem; }
h3 { font-size: 1rem; margin: 1.2rem 0 0.2rem; }
p { margin: 0; }
.back { margin-top: 2rem; }
`;

/**
 * The Vite plugin. Builds emit the page; the dev server serves it, read afresh
 * on each request so an edit shows on reload.
 *
 * @returns {import("vite").Plugin}
 */
export function impressum() {
  let source = null;
  let base = "/";
  const page = () => impressumPage(readFileSync(source, "utf8"));
  return {
    name: "impressum",
    configResolved(config) {
      base = config.base;
      const name = config.env.VITE_IMPRESSUM;
      source = name ? join(config.root, impressumSource(name)) : null;
      // Read once here, so a name with no file behind it fails the build at
      // its start, naming the file, rather than shipping a link to nothing.
      if (source) page();
    },
    configureServer(server) {
      if (!source) return;
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (path === `${base}${PAGE}`) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(page());
        } else if (path === `${base}${STYLESHEET}`) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
          res.end(IMPRESSUM_CSS);
        } else {
          next();
        }
      });
    },
    generateBundle() {
      if (!source) return;
      this.emitFile({ type: "asset", fileName: PAGE, source: page() });
      this.emitFile({
        type: "asset",
        fileName: STYLESHEET,
        source: IMPRESSUM_CSS,
      });
    },
  };
}
