# Verification

Date: 2026-10-11. Host: Windows. Test data: controlled local fixtures; no user's website content was captured.

Capture fidelity update, 2026-10-12: eight browser regressions compare source and exported default/hover background images, colors, and box shadows. They also compare the forced Hover preview. Covered cases are hover custom properties, positive functional state selectors, type intersections and state-only selector groups, gradient variable fallbacks, inherited variables on pseudo-elements and children, and stylesheets containing a selected button inside an open shadow root. Six cases reproduced a mismatch before their respective fixes. All eight passed afterward. The original Chromium extension integration checks also passed. The reported YouTube button has not been recaptured or compared with the live source.

## Passed

- Three Node unit tests cover ZIP CRCs/binary assets/UTF-8 filenames, export escaping, and multi-button file separation.
- Manifest/resource validation and JavaScript syntax checks cover source plus Chromium, Firefox, and Safari-source packages.
- The actual Chromium extension was loaded with a service worker, picker, library, and isolated preview frames.
- Selecting fixture buttons left their original click counter at zero.
- Default capture and standalone HTML export matched source background, foreground, border radius, padding, font size/weight, width, and height.
- Hover matched source background and transform; pressed matched background and scale; the disabled preview matched source opacity.
- A 600px responsive preview matched source dimensions and styling at that viewport.
- Pseudo-element rules, CSS keyframes, and a running Web Animations animation were present in saved captures.
- Cross-origin CSS recovery preserved hover rules. An image and background image were embedded as data URLs with no missing asset warnings.
- Rename, search/filter reset, bulk selection, ZIP download, JSON backup, sanitized import, deletion, and persistence after reload passed.
- Imported scopes were replaced to avoid collisions with existing captures. Event attributes and scripts were stripped.
- Library and sandbox previews emitted no unexpected script/CSP errors during the core flow.
- Closing details restored keyboard focus to the originating button.
- Desktop 1440px, compact desktop 900px, detail-panel, and toolbar-popup screenshots were reviewed. Full-page capture used an expanded physical viewport at 900px to avoid Chromium omitting offscreen cross-process iframe paint.

## Limits of these results

Computed-style assertions compare the properties listed above. They are not a universal pixel comparison of every website or every rendering engine. Infinite animation data and CSS keyframes were checked; their entire time evolution was not pixel-diffed. Arbitrary website JavaScript, complex selector/cascade behavior, unavailable assets, SVG declarative animation, and closed shadow roots remain documented limitations.

No actual Firefox, Safari, Edge, Brave, Opera, or Vivaldi runtime was tested. Firefox has a separate manifest/package. Safari conversion, signing, and runtime testing require a Mac. Browser-store submission and permanent signing have not been performed.

## Reproduce

Run `npm run build`, `npm test`, and `npm run verify` with Node. With Playwright and a full Chromium available, run `node tests/browser.mjs`. `BC_PLAYWRIGHT` can identify the Playwright module by file URL, and `BC_BROWSER` can point to an installed test Chromium executable.

The browser test adds localhost access to a test-only copied manifest to reproduce the toolbar's activeTab grant. Source and release manifests request no persistent automatic page access. Test artifacts are under ignored `test-results` and `.impeccable/review` directories.
