---
title: Button Copy
status: Draft
author:
date: 2026-10-11
version: 0.1
---

# Button Copy

## Summary

A desktop WebExtension lets users explicitly select website buttons, store their appearance and available interaction states locally, preview them, and export one or several as reusable HTML, CSS, and JavaScript. Its own interface is dark with #004225 forest green. Incomplete captures remain savable and show fidelity warnings.

## Problem and users

Copying button markup alone loses fonts, icons, inherited styles, state rules, and motion. The user wants the reusable button and its styling together. Assumption: users collect buttons for design or frontend development. Audience research and a launch deadline were not supplied.

## Goals and exclusions

Preserve appearance and readable states; keep copying under explicit user control; make local collections easy to inspect and export. Exclude mobile browsers, cloud sync, accounts, and React exports in this release. The original application's business logic and unrestricted one-to-one capture on every website are technically unsupported.

## Flow

1. Activate the extension on a website.
2. Choose a button and review its outline.
3. Explicitly save the capture.
4. Preview, rename, search, and inspect its capture notes in the local library.
5. Export one or several captures, or back up the library.

## Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Inject the picker only after explicit extension activation. Selection must not run the source button's normal click action. | P0 |
| FR-2 | Store descendant markup, computed defaults, readable CSS state rules, pseudo-elements, fonts, icons, and asset references. | P0 |
| FR-3 | Include readable CSS transitions and keyframes and running serializable Web Animations. Report missing triggers or effects. | P0 |
| FR-4 | Save incomplete captures with specific notes, including unavailable stylesheets and assets. | P0 |
| FR-5 | Persist the collection in local extension storage and offer live isolated previews. | P0 |
| FR-6 | Export one or several captures in a ZIP with HTML, CSS, animation replay JavaScript, and notes. | P0 |
| FR-7 | Offer a standalone preview HTML export, rename, search, selection, and deletion. | P1 |
| FR-8 | Offer JSON backup/import and sanitize imported executable markup. | P1 |
| FR-9 | Embed accessible images/fonts and offer optional domain access for retrying failures. | P0 |
| FR-10 | Provide Chromium and Firefox packages and document the macOS Safari conversion path. | P0 |
| NFR-1 | Use a dark forest interface, visible keyboard focus, labeled controls, and reduced-motion support. | P0 |
| NFR-2 | Keep captures local and omit analytics and uploads. Previews cannot execute website scripts or access extension APIs. | P0 |
| NFR-3 | Preserve all existing captures if capture, parsing, or storage fails. Report the failed action. | P0 |

## Edge cases

Empty collections explain how to capture. Search misses offer reset. Restricted pages show an actionable error. Embedded frames must be opened directly. Missing assets are warned about and remain external until embedding succeeds. Source JavaScript actions are omitted. Imported captures receive new scopes and IDs. Bulk deletion requires confirmation. Limits are explained when exceeded. Assumption: backup is the recovery mechanism for deleted local captures.

## Success and verification

Proposed engineering acceptance: on controlled fixtures, compare default and state computed styles, confirm selection does not trigger the original click, validate responsive rules and motion serialization, exercise persistence and exports, and verify import sanitization. These targets are implementation checks, not supplied customer metrics. Broader capture accuracy across real websites remains an evaluation task.

## Risks and dependencies

WebExtensions API support differs by browser. Safari packaging requires macOS/Xcode and signing. Page security and source servers can block external CSS and assets. Arbitrary framework handlers and closed shadow roots are not generally inspectable. Rendering varies across engines and font environments. Exact visual verification is currently limited to controlled Chromium fixtures.

## Rollout

Local unpacked Chromium installation, temporary Firefox installation, and prepared Safari converter source. Store submission and signing are outside the current deliverable. Back up local data before replacing or uninstalling the extension.

## Open questions

Final product name, browser-store publishing accounts, supported-browser release matrix, real-world benchmark websites, customer success metrics, and any future sync or framework exports remain undecided.
