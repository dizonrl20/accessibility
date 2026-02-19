# WAVE Actual vs Generated Report – Comparison

## Your actual WAVE summary (qa.mfsg.com)

| Category            | Count | Notes |
|---------------------|-------|--------|
| **Errors**          | 0     | None |
| **Contrast Errors** | 1     | Very low contrast |
| **Alerts**          | 9     | 6 Possible heading, 1 Noscript, 2 HTML5 video/audio |
| **Features**        | 16    | Informational (e.g. null alt, skip link, language) |
| **Structure**       | 14    | Informational (headings, lists, header, nav, main, footer) |
| **ARIA**            | 47    | Informational (ARIA usage on the page) |

**Actionable for WCAG:** 1 contrast + 9 alerts = **10 items** to review/fix.

---

## Generated report (wave-jira-qa.mfsg.com.-2026-02-19T21-16-59.html)

- **26 JIRA issues** across 5 tabs (Details, Contrast, Structure, Tab Order, Reference).

---

## Mismatches

### 1. Over-reporting (main mismatch)

The generated report creates one JIRA issue for **every unique finding type** in the captured HTML, including:

- **Details:** Noscript, ARIA, ARIA label, ARIA expanded, ARIA popup, HTML5 video/audio, ARIA tabindex, ARIA button, Possible heading, ARIA hidden → 10 issues.
- **Contrast:** Very low contrast → 1 issue.
- **Structure:** Language, Skip link, Header, Navigation, Main content, Footer, Heading levels, Unordered list, Figure, Null or empty alt, Linked image with alt, Skip link target → multiple issues.
- **Tab Order / Reference** → placeholders.

In WAVE:

- **Errors** and **Contrast Errors** = real failures.
- **Alerts** = need review (possible issues).
- **Features**, **Structure**, **ARIA** = mostly **inventory** (e.g. “Skip link” = good, “Language” = good). They are not necessarily failures.

So we treat Features/Structure/ARIA as “issues” when many are positive or informational. That inflates the count: **26 reported vs 10 actionable** (1 contrast + 9 alerts).

### 2. No instance counts

WAVE shows **6** “Possible heading” and **2** “HTML5 video or audio.” The report has one issue per **type** (e.g. one “Possible heading”) and does not say “6 instances.” So the report under-represents how many instances there are.

### 3. ARIA as failures

WAVE’s “ARIA” section (47 items) describes **where ARIA is used**, not necessarily failures. Our report lists “ARIA”, “ARIA label”, “ARIA button”, etc. with “Why this fails” and WCAG 4.1.2, which implies they are all failures. Only **incorrect or missing** ARIA is a failure; presence of ARIA is often correct.

### 4. Summary

| Aspect              | Actual WAVE              | Generated report                    |
|---------------------|--------------------------|-------------------------------------|
| Total “issues”      | 10 (1 contrast + 9 alerts)| 26 (all finding types)              |
| Contrast            | 1 ✓                      | 1 ✓                                 |
| Alerts              | 9 ✓                      | Covered (Noscript, Possible heading, HTML5 video) ✓ |
| Features/Structure  | Informational            | Treated as issues ✗                 |
| ARIA                | Informational            | Treated as issues ✗                 |
| Instance counts     | Yes (e.g. 6 Possible heading) | No (one issue per type only)   |

---

## Recommendation

- Use **Errors + Contrast + Alerts** for “must fix” / JIRA (10 items in your case).
- Treat **Features / Structure / ARIA** as reference only unless a specific item is clearly a failure (e.g. missing landmark, wrong ARIA).
- Add a **“JIRA issues only”** mode that reports only: Contrast Errors + Alerts (and Errors if any), so the generated report aligns with the actual WAVE failure/review list. **Done:** use `npm run a11y:wave-to-jira -- --actionable-only` to get only Errors + Contrast + Alerts.
