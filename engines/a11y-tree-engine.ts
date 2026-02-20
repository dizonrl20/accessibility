import type { Page } from '@playwright/test';
import type { A11yTreeResult, A11yTreeInventory, A11yTreeIssue } from '../types/a11y-tree.types.js';

/** Playwright accessibility snapshot node (loose shape) */
interface SnapshotNode {
  role?: string;
  name?: string;
  description?: string;
  children?: SnapshotNode[];
  [key: string]: unknown;
}

/** CDP AXNode (flat list from Accessibility.getFullAXTree) */
interface AXValue {
  type?: string;
  value?: unknown;
}
interface AXNode {
  nodeId: string;
  ignored?: boolean;
  role?: AXValue;
  name?: AXValue;
  description?: AXValue;
  parentId?: string;
  childIds?: string[];
}

function axValueToString(v: AXValue | undefined): string | undefined {
  if (v?.value == null) return undefined;
  return String(v.value).trim() || undefined;
}

/** Build tree from CDP flat node list. Skips ignored nodes and reparents their children to the nearest non-ignored ancestor. */
function buildTreeFromAXNodes(nodes: AXNode[]): SnapshotNode | null {
  const k = (id: unknown) => String(id);
  const byId = new Map<string, AXNode>();
  nodes.forEach((n) => byId.set(k(n.nodeId), n));

  const treeNodes = new Map<string, SnapshotNode>();
  nodes.forEach((n) => {
    if (n.ignored) return;
    treeNodes.set(k(n.nodeId), {
      role: axValueToString(n.role),
      name: axValueToString(n.name),
      description: axValueToString(n.description),
      children: [],
    });
  });

  /** Recursively collect non-ignored descendants, skipping through ignored intermediaries. */
  function collectVisibleChildren(childIds: string[]): SnapshotNode[] {
    const result: SnapshotNode[] = [];
    for (const cid of childIds) {
      const snap = treeNodes.get(k(cid));
      if (snap) {
        result.push(snap);
      } else {
        const raw = byId.get(k(cid));
        if (raw?.childIds?.length) result.push(...collectVisibleChildren(raw.childIds));
      }
    }
    return result;
  }

  treeNodes.forEach((snap, nid) => {
    const ax = byId.get(nid);
    if (ax?.childIds?.length) snap.children = collectVisibleChildren(ax.childIds);
  });

  const rootNode = nodes.find((n) => !n.ignored && (!n.parentId || !byId.has(k(n.parentId))));
  if (rootNode) {
    const rootSnap = treeNodes.get(k(rootNode.nodeId));
    if (rootSnap) return rootSnap;
  }

  // Fallback: root itself may be ignored — walk from the very first node through ignored intermediaries
  const firstNode = nodes[0];
  if (firstNode) {
    const snap = treeNodes.get(k(firstNode.nodeId));
    if (snap) return snap;
    if (firstNode.childIds?.length) {
      const virtual: SnapshotNode = { role: 'RootWebArea', children: collectVisibleChildren(firstNode.childIds) };
      return virtual;
    }
  }

  return treeNodes.size > 0 ? treeNodes.values().next().value ?? null : null;
}

const ROLES_LINK = new Set(['link']);
const ROLES_BUTTON = new Set(['button']);
const ROLES_IMAGE = new Set(['image', 'img']);
const ROLES_VIDEO = new Set(['video']);
const ROLES_AUDIO = new Set(['audio']);
const ROLES_MEDIA_OR_EMBED = new Set(['video', 'audio', 'iframe', 'embed']);

function isEmptyName(name: string | undefined): boolean {
  return name == null || String(name).trim() === '';
}

function walk(
  node: SnapshotNode | null | undefined,
  inventory: A11yTreeInventory,
  issues: A11yTreeIssue[]
): void {
  if (!node) return;
  const role = (node.role ?? '').toLowerCase();
  const name = node.name;
  const desc = node.description;

  if (ROLES_LINK.has(role)) {
    inventory.links++;
    if (isEmptyName(name)) {
      issues.push({
        kind: 'nameless-link',
        role: 'link',
        name: name as string | undefined,
        description: desc as string | undefined,
        summary: 'Link has no accessible name (screen reader will not announce purpose).',
        actionable: true,
      });
    }
  }
  if (ROLES_BUTTON.has(role)) {
    inventory.buttons++;
    if (isEmptyName(name)) {
      issues.push({
        kind: 'nameless-button',
        role: 'button',
        name: name as string | undefined,
        description: desc as string | undefined,
        summary: 'Button has no accessible name (e.g. icon-only with no aria-label or text).',
        actionable: true,
      });
    }
  }
  if (role === 'textbox' || role === 'searchbox' || role === 'combobox') {
    if (isEmptyName(name)) {
      issues.push({
        kind: 'nameless-input',
        role,
        name: name as string | undefined,
        summary: `Input (${role}) has no accessible name/label.`,
        actionable: true,
      });
    }
  }
  if (ROLES_IMAGE.has(role)) inventory.images++;
  if (ROLES_VIDEO.has(role)) inventory.videos++;
  if (ROLES_AUDIO.has(role)) inventory.audio++;
  if (role === 'iframe' || role === 'embed') inventory.iframes++;

  for (const child of node.children ?? []) {
    walk(child as SnapshotNode, inventory, issues);
  }
}

/** Add one "manual review" issue per media type present, so report has a ticket. */
function addMediaReviewIssues(inventory: A11yTreeInventory, issues: A11yTreeIssue[]): void {
  if (inventory.videos > 0) {
    issues.push({
      kind: 'media-manual-review',
      role: 'video',
      summary: `Video component(s) detected (${inventory.videos}). Manual verification required: accurate Closed Captions and Audio Descriptions (WCAG 1.2).`,
      actionable: true,
    });
  }
  if (inventory.audio > 0) {
    issues.push({
      kind: 'media-manual-review',
      role: 'audio',
      summary: `Audio component(s) detected (${inventory.audio}). Manual verification required: captions/transcript or alternative.`,
      actionable: true,
    });
  }
  if (inventory.iframes > 0) {
    issues.push({
      kind: 'media-manual-review',
      role: 'iframe',
      summary: `Embed/iframe(s) detected (${inventory.iframes}). If they contain video/audio, verify captions and accessibility.`,
      actionable: false,
    });
  }
}

/**
 * Audits the Accessibility Tree (what screen readers see) via CDP.
 * page.accessibility was removed in Playwright 1.57; we use Accessibility.getFullAXTree (Chromium only).
 */
export async function runA11yTreeScan(page: Page, url: string): Promise<A11yTreeResult> {
  const context = page.context();
  const newCDPSession = (context as { newCDPSession?(target: unknown): Promise<{ send(method: string, params?: object): Promise<unknown> }> }).newCDPSession;
  if (typeof newCDPSession !== 'function') {
    throw new Error('A11y Tree engine requires Chromium (CDP). Use --engine axe with Chromium or run with Chromium for --engine tree.');
  }
  const client = await newCDPSession.call(context, page);
  await (client.send as (m: string, p?: object) => Promise<unknown>)('Accessibility.enable');

  // Force a fresh tree: wait for pending DOM/accessibility updates (e.g. after Axe injection)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise((r) => setTimeout(r, 1000));

  const result = (await (client.send as (m: string, p?: object) => Promise<{ nodes?: AXNode[] }>)('Accessibility.getFullAXTree')) as { nodes?: AXNode[] };
  const nodes = result?.nodes ?? [];
  const snapshot = buildTreeFromAXNodes(nodes);

  const inventory: A11yTreeInventory = {
    links: 0,
    buttons: 0,
    images: 0,
    videos: 0,
    audio: 0,
    iframes: 0,
  };
  const issues: A11yTreeIssue[] = [];
  walk(snapshot, inventory, issues);
  addMediaReviewIssues(inventory, issues);

  return {
    url,
    timestamp: new Date().toISOString(),
    inventory,
    issues,
  };
}
