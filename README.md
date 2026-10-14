# Button Copy

A desktop browser extension for manually collecting website buttons. The interface uses a light studio theme with #004225 forest-green actions and an optional dark theme. Switch themes in the popup, library, or help page; the picker follows your choice. Captured buttons retain their source colors.

## Install in Chrome, Edge, Brave, Opera, or Vivaldi

1. Open the browser's extensions manager. In Chrome this is `chrome://extensions`; in Edge it is `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select `dist/chromium` from this project. The `extension` folder also works for development.
4. Pin Button Copy to the browser toolbar.
5. Open a regular website, click the extension, and choose **Choose a button**.

The Chromium package was exercised in an actual Chromium browser. Other Chromium browsers use the same package but have not been individually tested here.

## Install in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist/firefox/manifest.json`.

Firefox 128 or later is the declared target. The Firefox manifest uses background scripts rather than a Chromium service worker. This package has been checked for syntax and file references, but an actual Firefox session has not been tested. Temporary add-ons are removed when Firefox restarts; persistent distribution requires Mozilla signing.

## Safari on macOS

Safari requires an Apple extension wrapper. The source is prepared in `dist/safari-source`; it is not an installable Safari app.

On a Mac with Xcode, run Apple's converter:

```sh
xcrun safari-web-extension-converter /absolute/path/to/dist/safari-source --app-name "Button Copy"
```

Follow Xcode's build and signing steps, then enable the extension in Safari's extension settings. Conversion, signing, and Safari runtime verification require macOS and have not been done in this Windows workspace. See [Apple's packaging instructions](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).

## Capture and export

- Point at a button and click to select it. The picker blocks its usual website action. Move to the picker toolbar and click **Save button**.
- Alt + click selects a custom element. **Select parent** includes a wrapper when needed. Escape cancels.
- Open the library to rename, search, preview, and select saved buttons.
- Click a button's name area to view its states, code, source, and capture notes.
- Previews use the source viewport width. In details, choose 600, 900, or 1440 px to test captured responsive rules.
- **Export button** and **Export selected** download ZIPs. Each contains an `index.html` preview plus separate HTML, CSS, JavaScript replay, and capture notes for each button.
- **Save preview HTML** downloads a single HTML document with embedded CSS and animation replay.
- **Back up library** and **Import backup** move local captures between browsers. Removing the extension or clearing its data removes its local library.

## Fidelity and known limits

The capture combines computed defaults with readable matched CSS rules, including pseudo-elements, interaction states, media queries, transitions, keyframes, fonts, and embedded image assets. Running Web Animations API animations are serialized for replay. SVG IDs and animation names are scoped so several exported buttons can coexist.

CSS variables and shorthand declarations remain in the captured rules so hover can change gradients, shadows, and inherited values on child elements and pseudo-elements. Positive `:is()` and `:where()` selector groups are expanded before state matching. Capture also reads the containing open shadow-root stylesheets when a button is selected inside one.

Unset variable snapshots retain their invalid state so nested color fallbacks still work. Rewritten selector weights distinguish class rules from element resets, preserving light-wash layers. Previews default to the composited ancestor background color, and exported preview stages use that color too. Choose Dark or Light in the detail view to test another backdrop. Ancestor background images and gradients still need the original page context.

Computed defaults use a lowest-priority cascade layer so layered source hover rules can override them. Native nested CSS selectors and nested media/supports declarations are traversed and flattened. Source layer ordering and anonymous layer blocks are retained.

Inline declarations retain their original cascade priority, including variable-based fills and effect layers. Inherited text styles retain the source typography when button rules use `font: inherit`. Ancestor size-query containers retain their names and captured content dimensions without expanding the exported button's footprint. Their sizes remain fixed when changing the preview viewport. Empty, positioned decorative layers beside the button or nearby ancestors are included when they match the selected button's bounds. This preserves tab highlights positioned outside the tablist, including their own variables and paint order. Other tabs and link controls are excluded. Shared indicator movement is not replayed. Reload the extension and recapture older buttons to use these fixes; existing library entries retain their saved data.

Unitless line heights are retained through typed computed styles, so smaller labels keep their original text alignment instead of inheriting a parent's resolved pixel height. Pixel and percentage line heights retain their resolved lengths. Engines without typed computed styles use the existing pixel snapshot fallback.

This is not a universal guarantee of identical rendering. Every capture carries notes about website JavaScript and rendering context. Additional notes identify inaccessible stylesheets, missing assets, external state triggers, shadow content, unresolved variables, nested CSS, SVG declarative animation, and canvas content.

- Arbitrary original JavaScript, click actions, framework state, event listeners, unobserved animations, scroll triggers, and animation-library logic are not copied.
- CSS selector specificity is reconstructed approximately; advanced selectors and layer names from different source sites may differ when combined. Inherited page layout, ancestor variable states, and style-query contexts are not reproduced wholesale. Ancestor size-query containers use their captured dimensions.
- Open shadow content is flattened. Closed shadow roots and custom element internals cannot be guaranteed.
- Fonts/images are embedded when the servers and browser permissions allow downloading them. Use **Allow resources and retry** for the specific affected domains. Recapture after allowing unreadable stylesheet domains to recover their rules.
- A missing asset remains an external dependency in exports and appears in the notes. Previews block external resources, so unavailable fonts and images may appear differently until embedded.
- Capture bounds are 160 elements, 64 assets, 5 MB per resource, and 20 MB of embedded capture data. These bounds prevent selecting an entire page accidentally.
- Browser settings, extension stores, local files, and other privileged pages may prohibit capture. For embedded frames, open the frame URL in its own tab.
- SVG declarative animation nodes and executable markup are omitted. Preview frames have opaque origins, no extension APIs, and no network access.

## Privacy and permissions

No account, sync, analytics, or upload service. Captures are stored in `storage.local`. The extension uses `activeTab` and `scripting` after toolbar activation, plus local/unlimited storage. Optional website permissions are requested only after an explicit resource retry or choosing a website from the library. Asset requests omit credentials. Source URLs and visible button content become part of the saved capture.

## Development and checks

The extension has no production dependencies or bundling requirement. With Node.js:

```sh
npm run build
npm test
npm run verify
node scripts/serve-fixtures.mjs
```

The fixture server opens at `http://127.0.0.1:4173`. Use it to test normal, hover, pressed, focus, disabled, pseudo-element, responsive, and animated buttons. Choosing them must not increment the website action count.

`tests/browser.mjs` uses Playwright and a full Chromium executable. Install Playwright separately for these integration checks, or provide `BC_PLAYWRIGHT` as an absolute module URL and `BC_BROWSER` as the executable path. Run `node tests/browser.mjs`. The test copies the extension under `test-results` and adds localhost host permissions only to that test copy. Shipping manifests do not include them.

With the same Playwright configuration, run `npm run test:fidelity` to compare default and hover gradients, colors, and shadows against the source in standalone HTML and the forced-state preview. The cases cover changing CSS variables, grouped state selectors, nested fallbacks, invalid and intentionally empty variables, variable inheritance, class rules versus element resets, source backdrops, and containing open shadow-root stylesheets.

Generated packages are in `dist`. See `docs/verification.md` for the checks run in this workspace.

See `docs/interaction-capture-investigation.md` for the shadcn/ui hover reproduction and the remaining limits of JavaScript hover/click animations.
