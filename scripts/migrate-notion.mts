/**
 * One-time migration: imports a Notion "export all workspace content" dump
 * (Markdown & CSV format) into Zotion/Supabase.
 *
 * Usage:
 *   npx tsx scripts/migrate-notion.mts \
 *     --export-dir ./scripts/migration-data/export \
 *     --owner-user-id <supabase-sub-uuid> \
 *     --supabase-url https://xxx.supabase.co \
 *     [--dry-run] [--only "Mbrand"]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (bypasses RLS so the
 * script can write on behalf of an arbitrary owner). --supabase-url falls
 * back to NEXT_PUBLIC_SUPABASE_URL if omitted.
 *
 * --dry-run parses/converts everything and prints a summary but writes
 * nothing to Supabase or EdgeStore. Run this first against the real export
 * before ever doing a real load. Re-running without --dry-run is safe:
 * documents are upserted by notion_source_id (see supabase/schema.sql), never
 * duplicated.
 */

import { JSDOM } from "jsdom";

// @blocknote/core's markdown->HTML->blocks pipeline calls document.createElement
// internally (see node_modules/@blocknote/core/src/api/parsers/html/util/nestedLists.ts).
// This must run before anything below calls tryParseMarkdownToBlocks.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
// Node >=21 defines a getter-only global `navigator`, so plain assignment throws.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
(globalThis as any).Node = dom.window.Node;
(globalThis as any).Element = dom.window.Element;
(globalThis as any).DocumentFragment = dom.window.DocumentFragment;

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  BlockNoteEditor,
  BlockNoteSchema,
  PartialBlock,
  createCodeBlockSpec,
} from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { parse as parseCsv } from "csv-parse/sync";
import { initEdgeStore } from "@edgestore/server";
import { initEdgeStoreClient } from "@edgestore/server/core";
import { createClient } from "@supabase/supabase-js";

// Mirrors the extended schema in components/editor.tsx so migrated content is
// structurally identical to what the live editor produces. Keep these in sync.
const schema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec({
      ...codeBlockOptions,
      defaultLanguage: "typescript",
      supportedLanguages: {
        typescript: { name: "TypeScript", aliases: ["ts"] },
        javascript: { name: "JavaScript", aliases: ["js"] },
        python: { name: "Python", aliases: ["py"] },
        cpp: { name: "C++", aliases: ["cpp", "c++"] },
        java: { name: "Java" },
        rust: { name: "Rust", aliases: ["rs"] },
        go: { name: "Go" },
        sql: { name: "SQL" },
        html: { name: "HTML" },
        css: { name: "CSS" },
      },
    }),
  },
});

// Bucket declared locally (not imported from app/api/edgestore/[...edgestore]/route.ts)
// because the backend SDK talks directly to EdgeStore's API with the secret key,
// bypassing the Next.js route's Supabase beforeUpload/beforeDelete guards entirely.
const edgeStoreRouter = initEdgeStore
  .create()
  .router({ publicFiles: initEdgeStore.create().fileBucket() });

const EXCLUDE_TITLE_PATTERN = /login\s*(de\s*)?apps?/i;
const EXCLUDE_FOLDER_NAMES = new Set(["the wave"]);
const SECRET_KEYWORD_PATTERN =
  /password|contraseñ|api[\s_-]?key|secret|token/i;
const NOTION_ID_SUFFIX =
  /^(.*?)[ _]([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const MEDIA_BLOCK_TYPES = new Set(["image", "video", "audio", "file"]);

type NodeKind = "page" | "database";

interface ContentNode {
  kind: NodeKind;
  notionId: string;
  title: string;
  filePath: string;
  relPath: string;
  dir: string;
  parent: ContentNode | null;
  children: ContentNode[];
  order: number;
}

interface ExclusionRecord {
  path: string;
  title: string;
  reason: string;
}

interface Stats {
  pages: number;
  databases: number;
  imagesRehosted: number;
  imagesMissing: string[];
  secretWarnings: { path: string; title: string }[];
  csvParseWarnings: { path: string; title: string; error: string }[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };
  return {
    exportDir: path.resolve(
      get("--export-dir") ?? "./scripts/migration-data/export",
    ),
    ownerUserId: get("--owner-user-id"),
    supabaseUrl: get("--supabase-url") ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    dryRun: args.includes("--dry-run"),
    only: get("--only"),
  };
}

function parseNotionFileName(
  baseName: string,
  fallbackSeed: string,
): { title: string; notionId: string } {
  // Notion exports a database as both "<Title> <id>.csv" (the page's own
  // view) and "<Title> <id>_all.csv" (an unfiltered view) — same database,
  // same id. Strip the "_all" suffix before parsing so both resolve to the
  // same notionId and get deduped as one.
  const normalized = baseName.replace(/_all$/, "");
  const match = normalized.match(NOTION_ID_SUFFIX);
  if (match) {
    return {
      title: match[1].trim(),
      notionId: match[2].replace(/-/g, "").toLowerCase(),
    };
  }
  return {
    title: baseName.trim(),
    notionId: crypto
      .createHash("md5")
      .update(fallbackSeed)
      .digest("hex"),
  };
}

function stripExt(fileName: string, ext: string): string {
  return fileName.slice(0, -ext.length);
}

/** Recursively walks an exported directory into a page/database tree. */
function walk(
  dir: string,
  exportRoot: string,
  parent: ContentNode | null,
  exclusions: ExclusionRecord[],
): ContentNode[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.filter(
    (e) => e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".csv")),
  );
  const dirs = entries.filter((e) => e.isDirectory());
  const consumedDirNames = new Set<string>();
  const nodes: ContentNode[] = [];
  let order = 0;

  for (const file of files) {
    const isCsv = file.name.endsWith(".csv");
    const ext = isCsv ? ".csv" : ".md";
    const baseName = stripExt(file.name, ext);
    const fullPath = path.join(dir, file.name);
    const relPath = path.relative(exportRoot, fullPath);
    const { title, notionId } = parseNotionFileName(baseName, relPath);

    if (EXCLUDE_TITLE_PATTERN.test(title)) {
      exclusions.push({ path: relPath, title, reason: "login-apps-pattern" });
      continue;
    }

    const node: ContentNode = {
      kind: isCsv ? "database" : "page",
      notionId,
      title,
      filePath: fullPath,
      relPath,
      dir,
      parent,
      children: [],
      order: order++,
    };

    // Notion's export names a page's child folder after its title only
    // (no id suffix), even though the page's own .md file does have one —
    // so match either convention.
    const childDir = dirs.find((d) => d.name === baseName || d.name === title);
    if (childDir) {
      consumedDirNames.add(childDir.name);
      const childDirPath = path.join(dir, childDir.name);
      if (EXCLUDE_FOLDER_NAMES.has(childDir.name.toLowerCase())) {
        exclusions.push({
          path: path.relative(exportRoot, childDirPath),
          title: childDir.name,
          reason: "excluded-folder",
        });
      } else {
        node.children = walk(childDirPath, exportRoot, node, exclusions);
      }
    }

    nodes.push(node);
  }

  // Directories not paired with a same-named .md/.csv are pure grouping
  // folders (e.g. a teamspace name) — recurse into them at the same parent
  // level instead of treating the folder itself as a document.
  for (const dirEntry of dirs) {
    if (consumedDirNames.has(dirEntry.name)) continue;

    const dirPath = path.join(dir, dirEntry.name);
    const relDirPath = path.relative(exportRoot, dirPath);

    if (EXCLUDE_FOLDER_NAMES.has(dirEntry.name.toLowerCase())) {
      exclusions.push({
        path: relDirPath,
        title: dirEntry.name,
        reason: "excluded-folder",
      });
      continue;
    }
    if (EXCLUDE_TITLE_PATTERN.test(dirEntry.name)) {
      exclusions.push({
        path: relDirPath,
        title: dirEntry.name,
        reason: "login-apps-pattern",
      });
      continue;
    }

    nodes.push(...walk(dirPath, exportRoot, parent, exclusions));
  }

  return nodes;
}

/**
 * Notion's export sometimes emits a whole page subtree twice under the same
 * ids: once correctly nested under its real parent, once again flattened as
 * extra top-level siblings (observed in practice, not just theoretical).
 * Dedup top-down: a node is only dropped in favor of another occurrence of
 * the same id that has a *non-null* parent somewhere else in the tree — and
 * once a parent instance is chosen, only ITS OWN children are ever
 * considered for that id going forward, so a surviving child always ends up
 * nested under the surviving parent (not some other discarded duplicate of
 * it).
 */
function dedupeTree(
  roots: ContentNode[],
): { roots: ContentNode[]; duplicatesSkipped: ExclusionRecord[] } {
  const isAllCsv = (n: ContentNode) => n.filePath.endsWith("_all.csv");

  const hasNestedOccurrence = new Map<string, boolean>();
  const collect = (nodes: ContentNode[]) => {
    for (const n of nodes) {
      if (n.parent !== null) hasNestedOccurrence.set(n.notionId, true);
      else if (!hasNestedOccurrence.has(n.notionId)) {
        hasNestedOccurrence.set(n.notionId, false);
      }
      collect(n.children);
    }
  };
  collect(roots);

  const duplicatesSkipped: ExclusionRecord[] = [];
  const placedIds = new Set<string>();

  function rebuild(nodes: ContentNode[]): ContentNode[] {
    // Within this one sibling list, prefer the "_all.csv" variant over the
    // plain one when both are present (Notion exports databases as both).
    const bySiblingId = new Map<string, ContentNode>();
    for (const n of nodes) {
      const existing = bySiblingId.get(n.notionId);
      if (!existing || (isAllCsv(n) && !isAllCsv(existing))) {
        bySiblingId.set(n.notionId, n);
      } else if (existing) {
        duplicatesSkipped.push({
          path: n.relPath,
          title: n.title,
          reason: "duplicate-copy",
        });
      }
    }

    const result: ContentNode[] = [];
    for (const n of bySiblingId.values()) {
      if (placedIds.has(n.notionId)) {
        duplicatesSkipped.push({
          path: n.relPath,
          title: n.title,
          reason: "duplicate-of-nested-copy",
        });
        continue;
      }
      if (n.parent === null && hasNestedOccurrence.get(n.notionId)) {
        // A correctly-nested occurrence exists elsewhere — defer to it
        // instead of keeping this flattened top-level copy.
        duplicatesSkipped.push({
          path: n.relPath,
          title: n.title,
          reason: "duplicate-of-nested-copy",
        });
        continue;
      }
      placedIds.add(n.notionId);
      n.children = rebuild(n.children);
      result.push(n);
    }
    return result;
  }

  return { roots: rebuild(roots), duplicatesSkipped };
}

function flattenPreOrder(nodes: ContentNode[]): ContentNode[] {
  const out: ContentNode[] = [];
  for (const node of nodes) {
    out.push(node);
    out.push(...flattenPreOrder(node.children));
  }
  return out;
}

function cell(text: string) {
  return [{ type: "text", text: text ?? "", styles: {} }];
}

function csvToTableBlock(filePath: string): { block: PartialBlock; parseError?: string } {
  const raw = fs.readFileSync(filePath, "utf-8");

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
  } catch (err) {
    // Malformed real-world CSV (stray quotes, mismatched columns, etc.) —
    // don't let one bad database crash the whole migration. Fall back to
    // dumping the raw text in a code block so no data is silently lost.
    return {
      block: {
        type: "codeBlock",
        props: { language: "text" },
        content: cell(raw),
      } as unknown as PartialBlock,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    block: {
      type: "table",
      content: {
        type: "tableContent",
        columnWidths: columns.map(() => undefined),
        headerRows: 1,
        rows: [
          { cells: columns.map(cell) },
          ...rows.map((row) => ({
            cells: columns.map((col) => cell(row[col] ?? "")),
          })),
        ],
      },
    } as unknown as PartialBlock,
  };
}

async function rehostMediaInBlocks(
  blocks: PartialBlock[],
  pageDir: string,
  edgestore: ReturnType<typeof initEdgeStoreClient<typeof edgeStoreRouter>> | null,
  dryRun: boolean,
  stats: Stats,
): Promise<PartialBlock[]> {
  for (const block of blocks as any[]) {
    if (
      MEDIA_BLOCK_TYPES.has(block.type) &&
      block.props?.url &&
      !/^https?:\/\//i.test(block.props.url)
    ) {
      const rawPath = path.resolve(pageDir, decodeURIComponent(block.props.url));
      // Markdown links use whatever Unicode normalization Notion stored the
      // text in, but exported filenames on disk can use a different one
      // (e.g. macOS decomposes accented letters, "í" -> "i" + combining
      // accent) — same string visually, different bytes. Try both forms.
      const localPath = [rawPath, rawPath.normalize("NFC"), rawPath.normalize("NFD")].find(
        (p) => fs.existsSync(p),
      );
      if (localPath) {
        stats.imagesRehosted++;
        if (!dryRun) {
          const buffer = fs.readFileSync(localPath);
          const extension = path.extname(localPath).slice(1) || "bin";
          const res = await edgestore!.publicFiles.upload({
            content: { blob: new Blob([buffer]), extension },
          });
          block.props.url = res.url;
        }
      } else {
        stats.imagesMissing.push(rawPath);
      }
    }
    if (block.children?.length) {
      block.children = await rehostMediaInBlocks(
        block.children,
        pageDir,
        edgestore,
        dryRun,
        stats,
      );
    }
  }
  return blocks;
}

async function main() {
  const { exportDir, ownerUserId, supabaseUrl, dryRun, only } = parseArgs();

  if (!fs.existsSync(exportDir)) {
    console.error(`Export directory not found: ${exportDir}`);
    console.error(
      "Export it from Notion (Settings & members -> Settings -> Export content " +
        '-> "Export all workspace content", Markdown & CSV) and unzip it there.',
    );
    process.exit(1);
  }
  if (!dryRun && !ownerUserId) {
    console.error("--owner-user-id is required unless running with --dry-run");
    process.exit(1);
  }
  if (!dryRun && !supabaseUrl) {
    console.error(
      "--supabase-url (or NEXT_PUBLIC_SUPABASE_URL) is required unless running with --dry-run",
    );
    process.exit(1);
  }
  if (!dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY is required in the environment unless running with --dry-run",
    );
    process.exit(1);
  }

  const exclusions: ExclusionRecord[] = [];
  let { roots, duplicatesSkipped } = dedupeTree(
    walk(exportDir, exportDir, null, exclusions),
  );

  if (only) {
    roots = roots.filter(
      (n) => n.relPath.split(path.sep)[0].toLowerCase().includes(only.toLowerCase()),
    );
  }

  const orderedNodes = flattenPreOrder(roots);

  const stats: Stats = {
    pages: 0,
    databases: 0,
    imagesRehosted: 0,
    imagesMissing: [],
    secretWarnings: [],
    csvParseWarnings: [],
  };

  const editor = BlockNoteEditor.create({ schema });
  // Constructing the real client eagerly throws without EDGE_STORE_* creds,
  // which dry runs (and any run before real infra exists) don't have.
  const edgestore = dryRun
    ? null
    : initEdgeStoreClient({
        router: edgeStoreRouter,
        accessKey: process.env.EDGE_STORE_ACCESS_KEY,
        secretKey: process.env.EDGE_STORE_SECRET_KEY,
      });

  // Service-role key bypasses RLS, needed since this writes on behalf of an
  // arbitrary --owner-user-id rather than an authenticated session.
  const supabase = dryRun
    ? null
    : createClient(supabaseUrl!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  const notionIdToSupabaseId = new Map<string, string>();

  for (const node of orderedNodes) {
    const markdown =
      node.kind === "page" ? fs.readFileSync(node.filePath, "utf-8") : "";

    if (node.kind === "page" && SECRET_KEYWORD_PATTERN.test(markdown)) {
      stats.secretWarnings.push({ path: node.relPath, title: node.title });
    }

    let blocks: PartialBlock[];
    if (node.kind === "database") {
      stats.databases++;
      const { block, parseError } = csvToTableBlock(node.filePath);
      if (parseError) {
        stats.csvParseWarnings.push({
          path: node.relPath,
          title: node.title,
          error: parseError,
        });
      }
      blocks = [
        { type: "heading", content: cell(node.title) } as unknown as PartialBlock,
        block,
      ];
    } else {
      stats.pages++;
      blocks = editor.tryParseMarkdownToBlocks(markdown) as PartialBlock[];
      blocks = await rehostMediaInBlocks(
        blocks,
        node.dir,
        edgestore,
        dryRun,
        stats,
      );
    }

    if (!dryRun && supabase) {
      const parentId = node.parent
        ? notionIdToSupabaseId.get(node.parent.notionId)
        : undefined;

      const { data, error } = await supabase
        .from("documents")
        .upsert(
          {
            user_id: ownerUserId,
            title: node.title,
            content: JSON.stringify(blocks, null, 2),
            parent_document: parentId ?? null,
            sort_order: node.order,
            notion_source_id: node.notionId,
            is_archived: false,
            is_published: false,
            full_width: true,
            show_toc: true,
          },
          { onConflict: "notion_source_id" },
        )
        .select("id")
        .single();

      if (error) throw error;
      notionIdToSupabaseId.set(node.notionId, data.id);
    }
  }

  console.log("\n=== Migration summary ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (nothing written)" : "LIVE"}`);
  console.log(`Pages: ${stats.pages}`);
  console.log(`Databases flattened: ${stats.databases}`);
  console.log(`Images rehosted: ${stats.imagesRehosted}`);
  if (stats.imagesMissing.length) {
    console.log(`Images referenced but not found on disk (${stats.imagesMissing.length}):`);
    stats.imagesMissing.forEach((p) => console.log(`  - ${p}`));
  }
  console.log(`Excluded (${exclusions.length}):`);
  exclusions.forEach((e) => console.log(`  - [${e.reason}] ${e.path}`));
  if (duplicatesSkipped.length) {
    console.log(`\nDuplicate copies skipped (kept the nested one) (${duplicatesSkipped.length}):`);
    duplicatesSkipped.forEach((d) => console.log(`  - ${d.title} (${d.path})`));
  }
  if (stats.secretWarnings.length) {
    console.log(
      `\nPossible credential/secret content found in ${stats.secretWarnings.length} page(s) — review manually before a live run:`,
    );
    stats.secretWarnings.forEach((w) => console.log(`  - ${w.title} (${w.path})`));
  }
  if (stats.csvParseWarnings.length) {
    console.log(
      `\nMalformed CSV — dumped as raw text instead of a table (${stats.csvParseWarnings.length}):`,
    );
    stats.csvParseWarnings.forEach((w) =>
      console.log(`  - ${w.title} (${w.path}): ${w.error}`),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
