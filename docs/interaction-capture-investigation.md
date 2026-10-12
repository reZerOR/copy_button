# Interaction capture investigation

Investigated on 2026-10-12 after reports of missing hover styles on Facebook and shadcn/ui, and missing animations after clicking copied buttons.

The capture is not universal. It copies the selected DOM subtree, readable matching CSS rules, computed defaults, and Web Animations running at capture time. It does not observe future website events or copy application handlers. The previous YouTube fixes addressed variable fallbacks and selector weights, not every interaction mechanism.

## Reproduced results

| Mechanism | Result before this investigation | Result after changes |
| --- | --- | --- |
| Plain `.button:hover` | Passed | Passed |
| Hover inside `@layer` | Failed. The unlayered computed snapshot beat layered hover rules. | Fixed. Snapshots now use a shared lowest-priority layer. |
| Native nested `&:hover` | Failed. Traversal stopped at the parent style rule. | Fixed. Nested selectors and declarations are visited and flattened. |
| Explicit layer order | Failed. Layer-order statement rules were omitted. | Fixed. Layer statements and first occurrences are preserved. |
| Hover changes a variable on an outer wrapper | Failed. The wrapper's variable rules do not match the copied subtree. | Still requires ancestor state context or observed state capture. |
| JavaScript adds a hover class | Failed. No pointer handler or resulting class change is copied. | Still requires observed interactions. |
| JavaScript starts an animation after clicking | Failed. Source had one paused animation and a scale of 0.9 after clicking; export had zero animations and no transform. | Still requires observed interactions and replay triggers. |

The live Secondary button on [shadcn/ui](https://ui.shadcn.com/) reproduced the layered-hover failure. Its source hover background was `oklch(0.928748 0.0000236058 none)`, while the export stayed at its default `lab(96.52 -0.0000298023 0.0000119209)` background. After the fixes, background, foreground, transform, and shadow matched the source on hover. This comparison used the public homepage in a fresh Chromium context.

No particular Facebook button was supplied or verified. The JavaScript cases above are controlled fixtures, not claims about Facebook's current implementation.

## Fixes and validation

Computed snapshots and pseudo-element snapshots now live in `button-copy-computed-defaults`, declared before source layers. A shared name keeps this default layer below source layers when captures are combined. Source `@layer` statements and first declarations preserve ordering. Anonymous layer blocks receive stable generated names so separate declarations from one block remain in the same layer.

Nested selectors resolve `&` against the parent selector, preserving a selector-list parent through `:is()`. Nested media/supports rules carry their parent selector. Nested declaration blocks remain in traversal order. Quoted and escaped ampersands are not treated as nesting selectors.

Browser regression cases cover layered hover, nested hover, explicit layer order, media inside a nested style, declarations following nested rules, and anonymous layer priority. The existing gradient, variable, backdrop, and shadow-root cases remain in the same suite.

Diagnostic probes are kept in the ignored `test-results/interaction-investigation.mjs` and `test-results/shadcn-investigation.mjs`. They invoke the real capture function and compare the result with original source interactions. They are excluded from the shipped extension. Run `npm run test:fidelity` with `BC_PLAYWRIGHT` and `BC_BROWSER` configured for the maintained local regression suite.

## What broader interaction capture needs

Preserve external ancestor variable/state context for CSS-only wrapper interactions. Merely assigning a wrapper's variables directly to the button can change inheritance and cascade behavior, so this needs its own context model and regression cases.

Add an interaction-recording mode for scripted effects. Observe interactions the user performs on the source button, including pointer entry/exit, press/release, and click. Record visual style changes, class/attribute changes, added visual nodes, and animations that begin during each event. Export a small replay implementation tied to those events. Keep normal picker click suppression; ordinary selection must not activate the source button.

Do not serialize arbitrary website handlers as if they were standalone functions. They can depend on framework state, closures, and other parts of the application. Recorded visual replay can reproduce observed effects but cannot guarantee all future behavior, network results, canvas drawing, or closed component internals.

Layer order and nested-declaration behavior follow the CSSOM mechanisms described in [CSSLayerStatementRule](https://developer.mozilla.org/en-US/docs/Web/API/CSSLayerStatementRule) and [CSSNestedDeclarations](https://developer.mozilla.org/en-US/docs/Web/API/CSSNestedDeclarations).
