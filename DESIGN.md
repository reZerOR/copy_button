---
name: Button Copy
description: A local collection of interactive website button captures.
colors:
  bg: "#0d120f"
  surface: "#141b16"
  surface-2: "#1b251e"
  border: "#2e3c32"
  ink: "#eef4ef"
  muted: "#acbeb0"
  forest: "#004225"
  forest-hover: "#075a35"
  focus: "#8bc7a5"
  action-ink: "#f0faf4"
  secondary-hover: "#27372b"
  rail: "#101813"
  preview: "#19221c"
  detail: "#111a14"
  detail-border: "#4a6252"
  selected-border: "#91bda3"
  state-bg: "#24372b"
  state-ink: "#bfdac8"
  code-bg: "#0b100d"
  code-ink: "#c6ddce"
  note-ink: "#d6c6a3"
typography:
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    lineHeight: 1.5
  action:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 550
    lineHeight: 1.5
  card-title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "11px"
    lineHeight: 1.7
rounded:
  state: "4px"
  chip: "5px"
  field: "6px"
  action: "7px"
  code: "8px"
  container: "12px"
spacing:
  tight: "6px"
  control: "9px"
  small: "12px"
  medium: "16px"
  grid: "22px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.action-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "11px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "9px 13px"
  navigation-selected:
    backgroundColor: "{colors.forest}"
    rounded: "{rounded.action}"
    padding: "11px 12px"
  state-chip:
    backgroundColor: "{colors.state-bg}"
    textColor: "{colors.state-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.state}"
    padding: "3px 7px"
  capture-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
  code-panel:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-ink}"
    typography: "{typography.code}"
    rounded: "{rounded.code}"
    padding: "16px"
---

# Design System: Button Copy

## Overview

**Creative North Star: "The button specimen collection"**

Button Copy uses a dark, forest-tinted interface around locally captured website buttons. The library gives each capture an interactive preview with its original appearance, followed by its name, website, state count, and capture notes. The interface's own controls use forest green.

The fixed collection rail, preview grid, and right-hand detail panel keep filters, bulk actions, inspection, and code export distinct. Borders and background changes define these regions. Small system text carries metadata; the captured button is the main visual content.

**Key Characteristics:**

- Dark backgrounds with a pinned forest-green action color.
- Original button styling inside isolated previews.
- Visible capture notes beside each specimen and in its details.
- Compact controls with explicit keyboard focus.
- Flat containers with rounded corners and thin borders.

## Colors

### Primary

Forest is the pinned action color. It fills primary buttons, the selected collection filter, and selected state or code controls. Forest hover changes action feedback without changing the palette. Action ink supplies the lighter text on these controls.

**The Capture Color Rule.** Apply the interface palette to collection controls; preserve each captured button's source colors.

### Neutral

Background is the page base. Surface contains cards and search fields; surface-2 contains secondary controls, form fields, and the tab picker. Rail and detail distinguish fixed navigation and inspection. Preview is the empty space around a captured specimen.

Ink is general text. Muted carries labels, domains, secondary actions, and explanatory copy. Border separates regions and controls. Focus marks keyboard targets. Selected border identifies chosen cards. State background and ink distinguish the compact state-count chip. Code background and ink separate exported code from surrounding fields. Note ink gives capture limitations a warm, readable treatment.

No secondary brand accent is established. Source-page colors belong to the captures rather than the interface palette.

## Typography

Body, control, and metadata text use the system UI stack defined in the frontmatter. Code uses a monospace stack. The interface has no downloaded font dependency.

- Body text is 14px with a 1.5 line height.
- Metadata, state controls, field labels, and compact actions use 12px.
- Search text and library descriptions use 13px.
- Card names use 14px at weight 600; ordinary actions use weight 550.
- Code uses 11px with a 1.7 line height, preserved whitespace, and a two-space tab size.

The shipped library heading is 32px, weight 600, line height 1.15, and letter spacing -0.03em. It becomes 27px at the compact breakpoint. The popup heading is 27px with a 1.22 line height. These observed system-font headings document the artifact; they do not establish a display-face rule for future screens.

Section headings generally use 21px at weight 550 with -0.02em tracking. Detail headings use 17px. Field-group headings use 14px at weight 650. Count badges use tabular numerals. Headings balance their wrapping; names and source domains truncate to a single line.

## Layout

The desktop library has a fixed 224px left rail. The remaining workspace starts after that rail and uses 44px top and horizontal padding, with 22px at the bottom. The header pairs the collection title with capture initiation. Search and sorting occupy one toolbar; selection and bulk export have their own row.

The collection uses an auto-fill grid with a 240px minimum card width and a 22px gap. Each preview is 182px high. Card metadata has 15px top, 17px horizontal, and 16px bottom padding. Search grows to a maximum of 460px.

The fixed detail panel is 520px wide with a sticky header, scrolling contents, 24px content padding, and a 225px preview. It overlays the workspace. The popup is 352px wide with 24px padding and full-width main actions.

- At 1600px and above, horizontal workspace padding becomes 60px and the grid minimum becomes 270px.
- At 1000px and below, the rail becomes 190px, workspace padding becomes 30px vertically and 26px horizontally, the heading becomes 27px, and the detail panel becomes 480px wide.
- At 700px and below, the rail enters document flow, navigation wraps horizontally, the workspace uses 25px vertical and 18px horizontal padding, and the detail panel occupies the full width. The grid uses a 210px minimum and a 16px gap. This is a narrow-window fallback for a desktop extension.

## Elevation & Depth

The interface uses no box shadows. Tonal backgrounds, one-pixel borders, and fixed positioning convey depth. The tab picker sits above the workspace; the detail panel sits above the collection; the toast sits above both. A native confirmation dialog dims the page with a translucent black backdrop. Captured source buttons can retain their own shadows.

**The Flat Container Rule.** Separate collection regions with their shipped backgrounds and borders rather than adding interface shadows.

## Shapes

Cards, preview containers, the tab picker, and dialogs use 12px corners. Main actions, search, and collection navigation use 7px corners. Fields and icon buttons use 6px; code and toast containers use 8px. Small count badges and state selectors use 5px, while the state-count chip uses 4px. Checkboxes remain native, 16px controls.

Outline icons generally use a 19px box and a 1.65px round-ended stroke. The brand mark uses a 32px box with its own overlapping-button geometry. Icons are inline SVG and accompany text or accessible labels.

## Components

### Buttons

Main actions have a minimum 42px height with the frontmatter's action padding. Secondary actions add a one-pixel border. Compact actions use 7px by 12px padding, a 34px minimum height, and 12px text. Text buttons use transparent backgrounds and muted text, which brightens on hover. Icon buttons occupy a 34px square.

Background feedback lasts 160ms with ease-out easing. Keyboard focus uses a 2px focus-colored outline at a 3px offset. Disabled buttons use 0.45 opacity and a not-allowed cursor. Reduced-motion preferences remove button transitions.

### Chips

State counts use the static state chip in the frontmatter. Collection counts use compact rounded badges with tabular numerals. State selectors and code tabs are buttons with a bordered surface-2 default and a forest selected state. Selection must remain represented by the control's accessible state, as implemented by collection filters and code buttons.

### Cards / Containers

Each card clips a live preview above its metadata. Its thin border changes to selected border when the user checks the native checkbox in the preview corner. The metadata block is a separate button that opens details. Its hover background changes to a darker green-tinted layer. Names and domains truncate; the lower row carries the state count and capture-note status.

### Inputs / Fields

Search combines an outline SVG with a borderless input inside one bordered container. Focus-within outlines that complete container. Name inputs use surface-2 and a thin border. Select controls use surface, 6px corners, and compact text. Placeholders use muted at full opacity; input carets use focus.

**The Visible Focus Rule.** Preserve the focus outline on buttons, links, inputs, selects, and summaries; search outlines its enclosing field.

### Navigation

Collection filters are full-width rail buttons, with left-aligned icons and text and right-aligned counts. Selected navigation uses forest. Unselected navigation uses muted text and a transparent background, then surface-2 and ink on hover. Backup tools stay at the rail's bottom on desktop and beside each other in narrow windows.

### Interactive specimen and code

Previews use isolated iframes centered within a clipped viewport. Details expose background, viewport width, motion replay, and captured-state controls. The specimen's own hover and press interaction remains distinct from those forced-state controls. Capture notes sit directly above the code group. HTML, CSS, and JavaScript selectors precede the scrollable monospace code container and export actions.

## Do's and Don'ts

### Do:

- Do keep the pinned dark interface and forest action color.
- Do preserve the source styling of captured buttons.
- Do keep capture notes accessible from each specimen and its details.
- Do use the existing focus outline and reduced-motion behavior.
- Do use borders and tonal backgrounds to separate interface regions.

### Don't:

- Don't recolor captured buttons to match the interface palette.
- Don't replace empty collections with synthetic saved buttons.
- Don't describe capture metadata as proof of guaranteed fidelity.
- Don't add interface shadows to flat collection containers.
- Don't turn the observed system-font page headings into a display typography mandate.
