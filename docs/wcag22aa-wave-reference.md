# WCAG 2.2 AA Reference for WAVE Findings

This document maps WAVE accessibility findings to **why** they fail WCAG 2.2 Level A/AA and the exact success criterion. Use it to explain issues in JIRA and reports.

**Quick ref:** [How to Meet WCAG 2.2 (W3C)](https://www.w3.org/WAI/WCAG22/quickref/)

---

## Errors & Alerts (Details tab)

| WAVE finding | Why it fails | WCAG 2.2 criterion |
|--------------|--------------|---------------------|
| **Noscript element** | Content inside `<noscript>` is only shown when JavaScript is off. If the page relies on JS, users who disable it or use assistive tech that doesn’t run JS may get no equivalent content or functionality. | **2.1.1 Keyboard (A)** – All functionality must be keyboard operable. **1.1.1 Non-text Content (A)** – Text alternatives where needed. |
| **Missing form label** | Inputs without an associated `<label>` or `aria-label` are not announced properly by screen readers; users don’t know what to enter. | **1.3.1 Info and Relationships (A)**, **2.4.6 Headings and Labels (AA)**, **3.3.2 Labels or Instructions (A)** |
| **Empty form label** | A label exists but has no text, so it provides no usable name for the control. | Same as Missing form label. |
| **Missing alternative text** (images) | Images without `alt` (or appropriate ARIA) are invisible to screen reader users. | **1.1.1 Non-text Content (A)** |
| **Very low contrast** | Text that doesn’t meet contrast ratios is hard or impossible to read for people with low vision or in poor light. | **1.4.3 Contrast (Minimum) (AA)** – 4.5:1 normal text, 3:1 large text. |
| **Language missing or invalid** | Missing or wrong `lang` on `<html>` prevents correct pronunciation and language switching for screen readers. | **3.1.1 Language of Page (A)** |
| **Empty heading** | Headings with no content don’t provide structure and can confuse navigation. | **1.3.1 Info and Relationships (A)**, **2.4.6 Headings and Labels (AA)** |
| **Empty button** / **Empty link** | Buttons or links with no visible or accessible name can’t be understood or used reliably. | **2.4.4 Link Purpose (A)**, **4.1.2 Name, Role, Value (A)** |
| **Possible heading** | Text that looks like a heading but isn’t marked with heading elements breaks structure and skip navigation. | **1.3.1 Info and Relationships (A)**, **2.4.6 Headings and Labels (AA)** |
| **HTML5 video or audio** | Video/audio without captions, transcripts, or audio description excludes deaf/hard-of-hearing and blind users. | **1.2.1–1.2.5** (depending on content type). |

---

## ARIA (Details tab)

| WAVE finding | Why it fails | WCAG 2.2 criterion |
|--------------|--------------|---------------------|
| **ARIA** / **ARIA label** / **ARIA expanded** / **ARIA popup** / **ARIA tabindex** | ARIA is used to expose roles, names, and states. If it’s wrong or missing, assistive tech gets incorrect or no information. | **4.1.2 Name, Role, Value (A)** – Expose name, role, and state to assistive technologies. |
| **ARIA hidden** | Content marked `aria-hidden="true"` is hidden from assistive tech; ensure nothing critical is hidden without an equivalent. | **4.1.2 Name, Role, Value (A)** |

---

## Contrast (Contrast tab)

| WAVE finding | Why it fails | WCAG 2.2 criterion |
|--------------|--------------|---------------------|
| **Very low contrast** | Fails minimum contrast ratio for normal or large text, making content hard to read. | **1.4.3 Contrast (Minimum) (AA)** – 4.5:1 (normal), 3:1 (large). |

---

## Structure (Structure tab)

| WAVE finding | Why it fails | WCAG 2.2 criterion |
|--------------|--------------|---------------------|
| **Heading level 1–6** / **No heading structure** / **Skipped heading level** | Headings define structure and allow “by heading” navigation. Wrong or missing hierarchy confuses users. | **1.3.1 Info and Relationships (A)**, **2.4.6 Headings and Labels (AA)**, **2.4.1 Bypass Blocks (A)** |
| **Main content** / **Navigation** / **Header** / **Footer** | Landmarks (main, nav, header, footer) let users jump to regions. Missing or wrong landmarks make navigation harder. | **1.3.1 Info and Relationships (A)**, **2.4.1 Bypass Blocks (A)** |
| **Skip link** / **Skip link target** | A skip link lets keyboard users bypass repeated content. Missing or broken skip reduces efficiency and can trap focus. | **2.4.1 Bypass Blocks (A)** |
| **Unordered list** / **Ordered list** | Lists should be marked with `<ul>`/`<ol>` so structure is exposed to assistive tech. | **1.3.1 Info and Relationships (A)** |

---

## Tab Order (manual)

| Check | Why it matters | WCAG 2.2 criterion |
|-------|----------------|---------------------|
| **Tab order matches visual order** | Focus order should follow a logical sequence so keyboard users aren’t confused. | **2.4.3 Focus Order (A)** |
| **All interactive elements reachable** | Every control must be reachable and operable by keyboard. | **2.1.1 Keyboard (A)** |

---

## JIRA usage

- **h3. Reproduction** is JIRA wiki markup: it renders as a level-3 heading titled “Reproduction”. The text under it is the steps to reproduce the issue.
- In each issue, include:
  1. **Why this fails** – short explanation from this doc.
  2. **Fails:** – one or more “WCAG X.X.X Name (Level)” from the table.
  3. **Reproduction** – steps (e.g. run WAVE, open tab, verify/fix).
