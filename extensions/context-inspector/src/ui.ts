function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildContextInspectorHtml(): string {
  const css = `
    :root {
      color-scheme: light;
      --bg: #f4f1eb;
      --bg-strong: #ece7de;
      --panel: rgba(255, 255, 255, 0.72);
      --panel-strong: rgba(255, 255, 255, 0.88);
      --panel-subtle: rgba(255, 255, 255, 0.58);
      --line: rgba(24, 28, 33, 0.08);
      --line-strong: rgba(24, 28, 33, 0.14);
      --text: #111418;
      --muted: #68707c;
      --muted-strong: #49515b;
      --accent: #0b6b72;
      --accent-soft: rgba(11, 107, 114, 0.1);
      --accent-strong: #0a4e54;
      --warn: #9a5d06;
      --warn-soft: rgba(154, 93, 6, 0.16);
      --danger: #932f21;
      --danger-soft: rgba(147, 47, 33, 0.14);
      --shadow: 0 12px 36px rgba(17, 20, 24, 0.08);
      --radius: 24px;
      --mono: "SFMono-Regular", "IBM Plex Mono", "Menlo", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      --serif: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background:
      radial-gradient(circle at top left, rgba(11, 107, 114, 0.08), transparent 22%),
      radial-gradient(circle at top right, rgba(147, 47, 33, 0.05), transparent 24%),
      linear-gradient(180deg, #f7f5f1 0%, #f0ece5 100%);
      color: var(--text);
      font-family: var(--sans);
    }
    body { padding: 12px; }
    .app { display: grid; grid-template-columns: 312px 1fr; gap: 14px; min-height: calc(100vh - 40px); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      backdrop-filter: blur(24px);
    }
    .sidebar { display: flex; flex-direction: column; overflow: hidden; position: sticky; top: 18px; max-height: calc(100vh - 36px); }
    .hero { padding: 20px 20px 10px; background: linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0)); }
    .hero h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    .hero p { margin: 8px 0 0; color: var(--muted-strong); line-height: 1.45; font-size: 13px; max-width: 28ch; }
    .hero-guide {
      margin-top: 14px;
      padding: 0;
    }
    .hero-guide strong { display: block; font-size: 12px; margin-bottom: 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .hero-guide ol { margin: 0; padding-left: 18px; color: var(--muted-strong); font-size: 13px; line-height: 1.5; }
    .toolbar { display: flex; gap: 8px; padding: 10px 16px 12px; background: transparent; }
    .toolbar input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 999px;
      border: 0;
      background: rgba(255,255,255,0.9);
      box-shadow: inset 0 0 0 1px var(--line);
      font: inherit;
      color: inherit;
    }
    .toolbar input::placeholder { color: var(--muted); }
    .runs { overflow: auto; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
    .run-card {
      padding: 12px 12px 12px 14px;
      border-radius: 18px;
      border: 0;
      border-left: 3px solid transparent;
      background: transparent;
      cursor: pointer;
      transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
    }
    .run-card:hover, .run-card.active {
      transform: translateY(-1px);
      border-left-color: var(--accent);
      background: rgba(255,255,255,0.72);
    }
    .run-card h3 { margin: 0 0 6px; font-size: 15px; }
    .run-meta { color: var(--muted-strong); font-size: 12px; display: flex; gap: 10px; flex-wrap: wrap; }
    .run-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 6px 9px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      border: 0;
    }
    .badge.warn { background: var(--warn-soft); color: var(--warn); }
    .badge.danger { background: var(--danger-soft); color: var(--danger); }
    .main { padding: 12px 14px 16px; overflow: auto; }
    .topline {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }
    .topline h2 { margin: 0; font-size: 18px; font-family: var(--serif); font-weight: 600; letter-spacing: -0.025em; }
    .topline p { margin: 4px 0 0; color: var(--muted-strong); font-size: 12px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button {
      border: 0;
      background: rgba(255,255,255,0.9);
      color: var(--text);
      border-radius: 999px;
      padding: 8px 12px;
      font-weight: 600;
      font: inherit;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px var(--line);
    }
    button.primary {
      background: var(--accent);
      color: #f6efe6;
      box-shadow: none;
    }
    .overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .overview-card,
    .stat { padding: 14px; border: 0; border-radius: 18px; background: rgba(255,255,255,0.52); box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.05); }
    .overview-card label,
    .stat label { display: block; color: var(--muted); font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em; }
    .overview-card strong,
    .stat strong { display: block; font-size: 17px; line-height: 1.2; }
    .overview-card p { margin: 8px 0 0; color: var(--muted-strong); font-size: 12px; line-height: 1.4; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.55fr) minmax(320px, 0.95fr);
      gap: 16px;
      align-items: start;
    }
    .workspace-column {
      min-width: 0;
      padding: 14px;
      border-radius: 26px;
      background: rgba(255, 255, 255, 0.36);
      box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.05);
    }
    .workspace-column > .stack { gap: 14px; }
    .workspace-title {
      margin: 0 0 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .stack { display: flex; flex-direction: column; gap: 16px; }
    .card { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
    .card + .card { padding-top: 8px; border-top: 1px solid var(--line); }
    .card h3 { margin: 0 0 4px; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }
    .card-head { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 10px; }
    .card-lead { color: var(--muted-strong); font-size: 13px; line-height: 1.45; margin: 0; }
    .tree, .timeline, .segments { display: flex; flex-direction: column; gap: 10px; }
    .tree-item, .timeline-item, .segment {
      border: 0;
      border-radius: 20px;
      padding: 12px;
      background: rgba(255,255,255,0.6);
      box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.05);
    }
    .tree-item.clickable,
    .timeline-item.clickable,
    .segment.clickable {
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
    }
    .tree-item.clickable:hover,
    .timeline-item.clickable:hover,
    .segment.clickable:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,0.82);
      box-shadow: inset 0 0 0 1px rgba(11, 107, 114, 0.12);
    }
    .tree-item.active,
    .timeline-item.active,
    .segment.active {
      background: rgba(11, 107, 114, 0.1);
      box-shadow: inset 0 0 0 1px rgba(11, 107, 114, 0.18);
    }
    .tree-item small, .timeline-item small, .segment small { color: var(--muted-strong); display: block; margin-top: 4px; }
    .timeline-item strong, .segment strong { display: block; margin-bottom: 6px; }
    .tree-item strong { display: block; margin-bottom: 4px; }
    .section-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .section-label::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
    }
    .segment pre, .diff pre {
      margin: 10px 0 0;
      white-space: pre-wrap;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.58;
      color: #20242a;
      background: rgba(244, 246, 248, 0.95);
      border: 0;
      padding: 12px;
      border-radius: 16px;
      max-height: 360px;
      overflow: auto;
      box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.06);
    }
    .tabs { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .tab { padding: 8px 12px; border-radius: 999px; border: 0; cursor: pointer; font-weight: 600; background: rgba(255,255,255,0.9); box-shadow: inset 0 0 0 1px var(--line); }
    .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .muted { color: var(--muted-strong); }
    .empty {
      min-height: 50vh;
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--muted-strong);
      border-radius: 28px;
      background: rgba(255,255,255,0.4);
      box-shadow: inset 0 0 0 1px var(--line);
    }
    .diff { display: grid; gap: 10px; }
    .metric-line { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .metric-line:last-child { border-bottom: 0; }
    .pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .reading-path {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .path-step {
      border: 0;
      border-radius: 22px;
      padding: 14px;
      background: rgba(255,255,255,0.45);
      box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.05);
    }
    .path-step strong { display: block; font-size: 14px; margin-bottom: 8px; }
    .path-step p { margin: 0; color: var(--muted-strong); font-size: 13px; line-height: 1.45; }
    .lane-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .focus-bar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(11, 107, 114, 0.08);
      box-shadow: inset 0 0 0 1px rgba(11, 107, 114, 0.1);
    }
    .focus-bar strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .focus-bar p {
      margin: 0;
      color: var(--muted-strong);
      font-size: 12px;
      line-height: 1.42;
    }
    .focus-bar button {
      white-space: nowrap;
      padding: 8px 12px;
      font-size: 12px;
    }
    .workflow {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .workflow-tab {
      padding: 9px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.9);
      box-shadow: inset 0 0 0 1px var(--line);
      color: var(--muted-strong);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .workflow-tab.active {
      background: var(--text);
      color: #fff;
      box-shadow: none;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .hero-card {
      padding: 16px 18px;
      border-radius: 20px;
      background: rgba(255,255,255,0.62);
      box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.05);
    }
    .hero-card h3 {
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .hero-card p {
      margin: 0;
      color: var(--muted-strong);
      font-size: 13px;
      line-height: 1.5;
    }
    .hero-card strong {
      display: block;
      margin-top: 10px;
      font-size: 13px;
    }
    .next-steps {
      display: grid;
      gap: 10px;
    }
    .step-card {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,0.52);
      box-shadow: inset 0 0 0 1px rgba(24, 28, 33, 0.05);
    }
    .step-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
    }
    .step-card p {
      margin: 0;
      color: var(--muted-strong);
      font-size: 13px;
      line-height: 1.45;
    }
    .section-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    .single-column {
      display: grid;
      gap: 14px;
    }
    .guide-callout {
      margin-bottom: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(11, 107, 114, 0.08);
      box-shadow: inset 0 0 0 1px rgba(11, 107, 114, 0.1);
    }
    .guide-callout strong {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    .guide-callout p {
      margin: 0;
      color: var(--muted-strong);
      font-size: 13px;
      line-height: 1.45;
    }
    @media (max-width: 1320px) {
      .overview-grid,
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .reading-path { grid-template-columns: 1fr; }
      .workspace-grid { grid-template-columns: 1fr; }
      .summary-grid,
      .section-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) {
      body { padding: 14px; }
      .app { grid-template-columns: 1fr; }
      .sidebar { position: static; max-height: none; min-height: 340px; }
      .overview-grid,
      .stats { grid-template-columns: 1fr; }
      .topline { grid-template-columns: 1fr; align-items: start; }
    }
  `;

  const script = `
    const state = {
      runs: [],
      currentRun: null,
      currentDiff: null,
      activeTab: "system",
      cutFilter: "all",
      query: "",
      selectedOriginKey: "",
      selectedStage: "",
      selectedTimelineIndex: -1,
    };

    const el = {
      runs: document.querySelector("#runs"),
      search: document.querySelector("#search"),
      content: document.querySelector("#content"),
      refresh: document.querySelector("#refresh"),
      compare: document.querySelector("#compare"),
      heading: document.querySelector("#heading"),
      subtitle: document.querySelector("#subtitle"),
    };

    const fmtNumber = new Intl.NumberFormat("zh-CN");
    const fmtDate = new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    async function fetchJson(url) {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    }

    function prettyDelta(value) {
      if (!value) return "0";
      return (value > 0 ? "+" : "") + fmtNumber.format(value);
    }

    function classifyCutItem(item) {
      if (item.kind === "history-message") return "history";
      if (item.kind === "tool-schema" || item.kind === "tool-list") return "tools";
      return "bootstrap";
    }

    function renderFilterChips(filters, active) {
      return '<div class="tabs">' + filters.map(([key, label, count]) =>
        '<button class="tab ' + (active === key ? 'active' : '') + '" data-cut-filter="' + key + '">' +
          escapeHtml(label + " (" + count + ")") +
        '</button>'
      ).join("") + '</div>';
    }

    function renderOriginDetails(origin) {
      const meta = origin.metadata || {};
      const details = [];
      if (origin.kind === "bootstrap-file") {
        if (typeof meta.rawChars === "number") {
          details.push("raw " + fmtNumber.format(meta.rawChars) + " chars");
        }
        if (typeof meta.injectedChars === "number") {
          details.push("injected " + fmtNumber.format(meta.injectedChars) + " chars");
        }
        if (meta.missing) {
          details.push("missing at capture time");
        }
      }
      if (origin.kind === "bootstrap-file-section") {
        if (origin.path) {
          details.push("section from " + origin.path);
        }
        if (typeof meta.sectionIndex === "number") {
          details.push("section #" + (meta.sectionIndex + 1));
        }
      }
      if (origin.kind === "skill" && typeof meta.blockChars === "number") {
        details.push("skill block " + fmtNumber.format(meta.blockChars) + " chars");
      }
      if (origin.kind === "tool-schema") {
        if (typeof meta.schemaChars === "number") {
          details.push("schema " + fmtNumber.format(meta.schemaChars) + " chars");
        }
        if (typeof meta.summaryChars === "number") {
          details.push("summary " + fmtNumber.format(meta.summaryChars) + " chars");
        }
        if (typeof meta.propertiesCount === "number") {
          details.push(fmtNumber.format(meta.propertiesCount) + " properties");
        }
      }
      if (details.length === 0) return "";
      return details.map((line) => '<small>' + escapeHtml(line) + '</small>').join("");
    }

    function renderTimelineDetails(item) {
      const meta = item.meta || {};
      const details = [];
      if (item.type === "before_compaction") {
        if (typeof meta.originalMessageCount === "number") {
          details.push("original " + fmtNumber.format(meta.originalMessageCount) + " messages");
        }
        if (typeof meta.compactingCount === "number") {
          details.push("compacting " + fmtNumber.format(meta.compactingCount) + " messages");
        }
        if (typeof meta.originalTokenCount === "number") {
          details.push("original " + fmtNumber.format(meta.originalTokenCount) + " tok");
        }
        if (typeof meta.tokenCount === "number") {
          details.push("compacting " + fmtNumber.format(meta.tokenCount) + " tok");
        }
      }
      if (item.type === "after_compaction") {
        if (typeof meta.tokensBefore === "number") {
          details.push("before " + fmtNumber.format(meta.tokensBefore) + " tok");
        }
        if (typeof meta.tokenCount === "number") {
          details.push("after " + fmtNumber.format(meta.tokenCount) + " tok");
        }
        if (typeof meta.firstKeptEntryId === "string" && meta.firstKeptEntryId) {
          details.push("first kept " + meta.firstKeptEntryId);
        }
        if (typeof meta.summary === "string" && meta.summary) {
          details.push("summary: " + meta.summary);
        }
      }
      if (item.type === "after_tool_call" && typeof meta.durationMs === "number") {
        details.push("duration " + fmtNumber.format(meta.durationMs) + " ms");
      }
      return details.map((line) => '<small>' + escapeHtml(line) + '</small>').join("");
    }

    function renderStageBadges(stage) {
      const badges = [];
      if (stage.charsDelta) {
        badges.push('<span class="badge' + (stage.charsDelta > 0 ? ' warn' : '') + '">chars ' + escapeHtml(prettyDelta(stage.charsDelta)) + '</span>');
      }
      if (typeof stage.tokenDelta === "number" && stage.tokenDelta !== 0) {
        badges.push('<span class="badge' + (stage.tokenDelta > 0 ? ' warn' : '') + '">tok ' + escapeHtml(prettyDelta(stage.tokenDelta)) + '</span>');
      }
      if (stage.duplicateDelta) {
        badges.push('<span class="badge' + (stage.duplicateDelta > 0 ? ' danger' : '') + '">dup ' + escapeHtml(prettyDelta(stage.duplicateDelta)) + '</span>');
      }
      return badges.join("");
    }

    function renderSegmentSource(segment) {
      const meta = segment.metadata || {};
      if (!meta.originLabel && !meta.originPath) {
        return "";
      }
      const parts = [];
      if (meta.originKind) {
        parts.push(String(meta.originKind));
      }
      if (meta.originPath) {
        parts.push(String(meta.originPath));
      } else if (meta.originLabel) {
        parts.push(String(meta.originLabel));
      }
      return '<small>source · ' + escapeHtml(parts.join(" · ")) + '</small>';
    }

    function buildOriginKey(kind, path, label) {
      return [kind || "", path || "", label || ""].join("::");
    }

    function getSegmentOriginKey(segment) {
      const meta = segment.metadata || {};
      return buildOriginKey(meta.originKind, meta.originPath, meta.originLabel);
    }

    function renderFocusBar(run, filteredCount, totalCount) {
      const chunks = [];
      if (state.selectedOriginKey) {
        const origin = (run.input.origins || []).find((item) =>
          buildOriginKey(item.kind, item.path, item.label) === state.selectedOriginKey,
        );
        if (origin) {
          chunks.push({
            title: "Focused source",
            body:
              origin.label +
              " · " +
              fmtNumber.format(origin.chars) +
              " chars · " +
              fmtNumber.format(origin.estimatedTokens) +
              " tok",
          });
        }
      }
      if (state.selectedStage) {
        const stage = (run.input.contextStages || []).find((item) => item.stage === state.selectedStage);
        if (stage) {
          chunks.push({
            title: "Focused stage",
            body:
              prettyDelta(stage.charsDelta || 0) +
              " chars · " +
              prettyDelta(stage.tokenDelta || 0) +
              " tok · " +
              fmtNumber.format(stage.messageCount || 0) +
              " messages",
          });
        }
      }
      if (state.selectedTimelineIndex >= 0) {
        const item = (run.timeline || [])[state.selectedTimelineIndex];
        if (item) {
          chunks.push({
            title: "Focused event",
            body: item.title + (item.summary ? " · " + item.summary : ""),
          });
        }
      }
      if (chunks.length === 0) {
        return "";
      }
      return (
        '<div class="focus-bar"><div>' +
        chunks
          .map((chunk) => '<strong>' + escapeHtml(chunk.title) + '</strong><p>' + escapeHtml(chunk.body) + '</p>')
          .join("") +
        '<p>当前分栏显示 ' +
        escapeHtml(String(filteredCount)) +
        " / " +
        escapeHtml(String(totalCount)) +
        " 个片段。</p></div><button id='clear-focus'>清除聚焦</button></div>"
      );
    }

    function renderRuns() {
      const query = state.query.trim().toLowerCase();
      const runs = state.runs.filter((run) => {
        if (!query) return true;
        return [run.runId, run.sessionKey, run.provider, run.model]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
      el.runs.innerHTML = runs.length
        ? runs.map((run) => {
            const active = state.currentRun && state.currentRun.runId === run.runId;
            const badges = [
              '<span class="badge">' + fmtNumber.format(run.estimatedTokens) + ' tok</span>',
              '<span class="badge' + (run.noiseScore >= 45 ? ' warn' : '') + '">噪音 ' + run.noiseScore + '</span>',
              '<span class="badge' + (run.duplicateChars > 8000 ? ' danger' : '') + '">重复 ' + fmtNumber.format(run.duplicateChars) + '</span>',
            ].join("");
            return '<article class="run-card ' + (active ? 'active' : '') + '" data-run-id="' + run.runId + '">' +
              '<h3>' + escapeHtml(run.provider + '/' + run.model) + '</h3>' +
              '<div class="run-meta">' +
                '<span>' + escapeHtml(run.sessionKey || run.runId) + '</span>' +
                '<span>' + escapeHtml(fmtDate.format(new Date(run.startedAt))) + '</span>' +
              '</div>' +
              '<div class="run-badges">' + badges + '</div>' +
            '</article>';
          }).join("")
        : '<div class="empty">还没有采集到运行记录。先触发一次 agent 运行，再刷新这里。</div>';

      for (const card of el.runs.querySelectorAll(".run-card")) {
        card.addEventListener("click", () => loadRun(card.getAttribute("data-run-id")));
      }
    }

    function renderContent() {
      if (!state.currentRun) {
        el.heading.textContent = "上下文工作台";
        el.subtitle.textContent = "先从左侧选择一次运行，再查看真实送模内容、噪音、重复和执行过程。";
        el.content.innerHTML = [
          '<section class="reading-path">',
            pathStep("1. 先挑一条最贵的运行", "优先看噪音分高、重复字符多、token 开销异常大的那条。"),
            pathStep("2. 先看来源和切削点", "先读来源地图、优先裁剪和阶段变化，这三块最能解释为什么上下文会变大。"),
            pathStep("3. 最后再看原始文本", "确定问题区域后，再进入上下文分栏读 system、prompt、history 的具体内容。"),
          '</section>',
          '<div class="empty">从左侧选一条运行记录。第一条真实采集结果就是你分析上下文的基准视图。</div>',
        ].join("");
        return;
      }
      const run = state.currentRun;
      el.heading.textContent = run.provider + "/" + run.model;
      el.subtitle.textContent = (run.sessionKey || run.runId) + " · " + fmtDate.format(new Date(run.startedAt));

      const tabs = [
        ["system", "系统"],
        ["prompt", "提示词"],
        ["history", "历史"],
      ];
      const tabHtml = tabs.map(([key, label]) =>
        '<button class="tab ' + (state.activeTab === key ? 'active' : '') + '" data-tab="' + key + '">' + label + '</button>'
      ).join("");
      const segments =
        state.activeTab === "system" ? run.input.systemSegments :
        state.activeTab === "prompt" ? run.input.promptSegments :
        run.input.historySegments;
      const filteredSegments = segments.filter((segment) => {
        if (!state.selectedOriginKey) return true;
        return getSegmentOriginKey(segment) === state.selectedOriginKey;
      });
      const segmentHtml = filteredSegments.length
        ? filteredSegments.map((segment) => {
            const attention = typeof segment.attentionProxyScore === "number"
              ? '<span class="badge">attention proxy ' + segment.attentionProxyScore + '</span>'
              : "";
            const active = state.selectedOriginKey && getSegmentOriginKey(segment) === state.selectedOriginKey;
            return '<article class="segment clickable ' + (active ? 'active' : '') + '" data-segment-origin="' + escapeHtml(getSegmentOriginKey(segment)) + '">' +
              '<strong>' + escapeHtml(segment.label) + '</strong>' +
              '<small>' + fmtNumber.format(segment.chars) + ' chars · ' + fmtNumber.format(segment.estimatedTokens) + ' tok · duplicate ' + fmtNumber.format(segment.duplicateChars) + '</small>' +
              renderSegmentSource(segment) +
              '<div class="pill-row">' + attention + '</div>' +
              '<pre>' + escapeHtml(segment.text || "(empty)") + '</pre>' +
            '</article>';
          }).join("")
        : '<div class="muted">No segments match the current focus in this lane.</div>';

      const origins = [...(run.input.origins || [])]
        .sort((a, b) => (b.chars || 0) - (a.chars || 0))
        .map((origin) => {
        const originKey = buildOriginKey(origin.kind, origin.path, origin.label);
        return '<div class="tree-item clickable ' + (state.selectedOriginKey === originKey ? 'active' : '') + '" data-origin-key="' + escapeHtml(originKey) + '">' +
          '<strong>' + escapeHtml(origin.label) + '</strong>' +
          '<small>' + escapeHtml(origin.kind + (origin.path ? ' · ' + origin.path : '')) + '</small>' +
          '<small>' + fmtNumber.format(origin.chars) + ' 字符 · ' + fmtNumber.format(origin.estimatedTokens) + ' tok' + (origin.truncated ? ' · 已截断' : '') + '</small>' +
          renderOriginDetails(origin) +
        '</div>';
      }).join("");
      const workspaceFiles = ((run.input.report && run.input.report.injectedWorkspaceFiles) || []).map((file) =>
        '<div class="tree-item">' +
          '<strong>' + escapeHtml(file.name || "workspace file") + '</strong>' +
          '<small>' + escapeHtml((file.path || "") + (file.missing ? " · 缺失" : "")) + '</small>' +
          '<small>原始 ' + fmtNumber.format(file.rawChars || 0) + ' · 注入 ' + fmtNumber.format(file.injectedChars || 0) + (file.truncated ? ' · 已截断' : '') + '</small>' +
        '</div>'
      ).join("");
      const suggestions = (run.input.suggestions || []).map((item) =>
        '<div class="tree-item">' +
          '<div class="pill-row"><span class="badge ' + (item.severity === "danger" ? "danger" : item.severity === "warn" ? "warn" : "") + '">' + escapeHtml(item.severity === "danger" ? "高" : item.severity === "warn" ? "中" : "低") + '</span></div>' +
          '<strong>' + escapeHtml(item.title) + '</strong>' +
          '<small>' + escapeHtml(item.detail) + '</small>' +
          (item.evidence ? '<small>证据：' + escapeHtml(item.evidence) + '</small>' : '') +
          (item.action ? '<small>建议动作：' + escapeHtml(item.action) + '</small>' : '') +
        '</div>'
      ).join("");
      const cutItems = [...(run.input.cutFirst || [])];
      const cutCounts = {
        all: cutItems.length,
        bootstrap: cutItems.filter((item) => classifyCutItem(item) === "bootstrap").length,
        history: cutItems.filter((item) => classifyCutItem(item) === "history").length,
        tools: cutItems.filter((item) => classifyCutItem(item) === "tools").length,
      };
      const visibleCutItems = cutItems.filter((item) =>
        state.cutFilter === "all" ? true : classifyCutItem(item) === state.cutFilter
      );
      const cutFilters = renderFilterChips(
        [
          ["all", "全部", cutCounts.all],
          ["bootstrap", "静态注入", cutCounts.bootstrap],
          ["history", "历史", cutCounts.history],
          ["tools", "工具", cutCounts.tools],
        ],
        state.cutFilter,
      );
      const cutFirst = visibleCutItems.map((item, index) =>
        '<div class="tree-item clickable" data-cut-kind="' + escapeHtml(item.kind || "") + '" data-cut-path="' + escapeHtml(item.path || "") + '" data-cut-label="' + escapeHtml(item.title || "") + '">' +
          '<strong>' + escapeHtml((index + 1) + ". " + item.title) + '</strong>' +
          '<small>' + escapeHtml(item.kind + (item.path ? ' · ' + item.path : '')) + '</small>' +
          '<small>' + fmtNumber.format(item.chars) + ' 字符 · ' + fmtNumber.format(item.estimatedTokens) + ' tok</small>' +
          '<small>' + escapeHtml(item.reason) + '</small>' +
          '<small>建议动作：' + escapeHtml(item.action) + '</small>' +
        '</div>'
      ).join("");

      const timeline = (run.timeline || []).map((item, index) =>
        '<div class="timeline-item clickable ' + (state.selectedTimelineIndex === index ? 'active' : '') + '" data-timeline-index="' + index + '">' +
          '<strong>' + escapeHtml(item.title) + '</strong>' +
          '<small>' + escapeHtml(fmtDate.format(new Date(item.at))) + '</small>' +
          (item.summary ? '<small>' + escapeHtml(item.summary) + '</small>' : '') +
          renderTimelineDetails(item) +
        '</div>'
      ).join("");
      const stageLabels = {
        "sanitized": "清洗后",
        "validated": "Provider 校验后",
        "history-limited": "历史裁剪后",
        "tool-pair-repaired": "工具配对修复后",
        "context-engine-assembled": "上下文组装后",
        "final": "最终送模前快照",
      };
      const contextStages = (run.input.contextStages || []).map((stage) =>
        '<div class="tree-item clickable ' + (state.selectedStage === stage.stage ? 'active' : '') + '" data-stage="' + escapeHtml(stage.stage) + '">' +
          '<strong>' + escapeHtml(stageLabels[stage.stage] || stage.stage) + '</strong>' +
          '<small>' + fmtNumber.format(stage.messageCount) + ' 条消息 · ' + fmtNumber.format(stage.chars) + ' 字符 · ' + fmtNumber.format(stage.estimatedTokens || 0) + ' tok</small>' +
          '<small>重复 ' + fmtNumber.format(stage.duplicateChars) + '</small>' +
          '<div class="pill-row">' + renderStageBadges(stage) + '</div>' +
        '</div>'
      ).join("");

      const diff = state.currentDiff
        ? '<div class="diff">' +
            '<div class="metric-line"><span>字符变化</span><strong>' + prettyDelta(state.currentDiff.metrics.charsDelta) + '</strong></div>' +
            '<div class="metric-line"><span>Token 变化</span><strong>' + prettyDelta(state.currentDiff.metrics.tokenDelta) + '</strong></div>' +
            '<div class="metric-line"><span>噪音变化</span><strong>' + prettyDelta(state.currentDiff.metrics.noiseDelta) + '</strong></div>' +
            '<div class="metric-line"><span>重复变化</span><strong>' + prettyDelta(state.currentDiff.metrics.duplicateDelta) + '</strong></div>' +
            '<pre>' + escapeHtml(state.currentDiff.base ? ('对比基线：' + state.currentDiff.base.runId + '\\n会话：' + (state.currentDiff.base.sessionKey || 'n/a')) : '没有找到同会话中的上一条可对比运行。') + '</pre>' +
          '</div>'
        : '<div class="muted">先选中一条运行，再和同会话里的上一条运行做对比。</div>';

      const thinking = ((run.output && run.output.thinkingTexts) || []).length
        ? run.output.thinkingTexts.map((text, index) => '<article class="segment"><strong>思考 ' + (index + 1) + '</strong><pre>' + escapeHtml(text) + '</pre></article>').join("")
        : '<div class="muted">这次运行没有暴露可见的 thinking / reasoning 内容。</div>';

      const topOrigin = (run.input.origins || [])[0];
      const topCut = (run.input.cutFirst || [])[0];
      const worstStage = [...(run.input.contextStages || [])].sort((a, b) => Math.abs((b.charsDelta || 0)) - Math.abs((a.charsDelta || 0)))[0];
      const laneSummary = [
        '<span class="badge">system ' + fmtNumber.format(run.input.systemChars || 0) + ' 字符</span>',
        '<span class="badge">prompt ' + fmtNumber.format(run.input.promptChars || 0) + ' 字符</span>',
        '<span class="badge">history ' + fmtNumber.format(run.input.historyChars || 0) + ' 字符</span>',
      ].join("");

      el.content.innerHTML = [
        '<section class="topline">',
          '<div><h2>' + escapeHtml(run.provider + '/' + run.model) + '</h2><p>' + escapeHtml(run.sessionKey || run.runId) + '</p></div>',
          '<div class="actions"><button class="primary" id="copy-json">复制运行 JSON</button><button id="reload-diff">刷新对比</button></div>',
        '</section>',
        '<section class="overview-grid">',
          overviewCard("建议顺序", "来源地图 -> 优先裁剪 -> 上下文分栏", "先看最大来源，再看最高收益裁剪项，最后再读原始文本。"),
          overviewCard("最大来源", topOrigin ? (topOrigin.label + " · " + fmtNumber.format(topOrigin.chars) + " 字符") : "没有来源数据", topOrigin ? (topOrigin.kind + (topOrigin.path ? " · " + topOrigin.path : "")) : "这次运行没有暴露来源归因信息。"),
          overviewCard("最优先裁剪", topCut ? (topCut.title + " · " + fmtNumber.format(topCut.chars) + " 字符") : "没有明显裁剪点", topCut ? topCut.reason : "当前没有识别到高收益的裁剪候选项。"),
          overviewCard("变化最大阶段", worstStage ? ((stageLabels[worstStage.stage] || worstStage.stage) + " · " + prettyDelta(worstStage.charsDelta || 0) + " 字符") : "没有阶段数据", worstStage ? "这是上下文变化最大的步骤。" : "这次运行没有采到阶段快照。"),
        '</section>',
        '<section class="stats">',
          stat("上下文大小", fmtNumber.format(run.input.chars) + " 字符"),
          stat("估算 Token", fmtNumber.format(run.input.estimatedTokens)),
          stat("噪音分", String(run.input.noiseScore)),
          stat("重复字符", fmtNumber.format(run.input.duplicateChars)),
        '</section>',
        '<section class="reading-path">',
          pathStep("先看哪里", "先看来源地图和优先裁剪，它们会告诉你钱花在了哪里。"),
          pathStep("在哪里变大", "再看阶段变化，确认是历史裁剪、上下文组装还是修复步骤让它膨胀。"),
          pathStep("模型真正看到了什么", "最后进入上下文分栏，只读你已经确认过最可疑的区域。"),
        '</section>',
        '<section class="workspace-grid">',
          '<div class="workspace-column"><div class="workspace-title">来源与阶段</div><div class="stack">',
            card("来源地图", "按体积从大到小排序。这里决定了 prompt 的主要成本。", '<div class="tree">' + origins + '</div>'),
            card("注入的工作区文件", "先看是否被截断、实际注入了多少，再决定要不要深入读文件内容。", workspaceFiles || '<div class="muted">这次运行没有检测到注入的工作区文件。</div>'),
            card("Prompt 阶段变化", "用 delta 找出上下文在哪一步变大或变小。", contextStages || '<div class="muted">这次运行没有采到阶段快照。</div>'),
            card("近似对比", "和同一会话中的上一条可比运行做对照。", diff),
          '</div></div>',
          '<div class="workspace-column"><div class="workspace-title">真实送模内容</div><div class="stack">',
            card("上下文分栏", "这里是最终送给模型的真实文本。先确认问题区域，再来读这一栏。", renderFocusBar(run, filteredSegments.length, segments.length) + '<div class="lane-summary">' + laneSummary + '</div><div class="tabs">' + tabHtml + '</div><div class="segments">' + segmentHtml + '</div>'),
          '</div></div>',
          '<div class="workspace-column"><div class="workspace-title">动作与运行过程</div><div class="stack">',
            card(
              "优先裁剪",
              "按来源类型分组的最高收益削减项。",
              cutFilters +
                (cutFirst || '<div class="muted">当前筛选条件下没有明显的高收益削减项。</div>'),
            ),
            card("优化建议", "基于阶段变化、重复率和来源结构生成的下一步建议。", suggestions || '<div class="muted">当前没有生成建议。</div>'),
            card("执行时间线", "运行级事件、工具调用和 compaction 检查点。", '<div class="timeline">' + timeline + '</div>'),
            card("可见思考", "这里只展示 provider 明确暴露出来的 reasoning / thinking。", thinking),
          '</div></div>',
        '</section>',
      ].join("");

      for (const tab of el.content.querySelectorAll(".tab")) {
        tab.addEventListener("click", () => {
          const lane = tab.getAttribute("data-tab");
          if (lane) {
            state.activeTab = lane;
            renderContent();
          }
        });
      }
      for (const item of el.content.querySelectorAll("[data-origin-key]")) {
        item.addEventListener("click", () => {
          const key = item.getAttribute("data-origin-key") || "";
          state.selectedOriginKey = state.selectedOriginKey === key ? "" : key;
          renderContent();
        });
      }
      for (const item of el.content.querySelectorAll("[data-cut-label]")) {
        item.addEventListener("click", () => {
          const kind = item.getAttribute("data-cut-kind") || "";
          const path = item.getAttribute("data-cut-path") || "";
          const label = item.getAttribute("data-cut-label") || "";
          const matched = (run.input.origins || []).find((origin) =>
            path ? origin.path === path : origin.label === label,
          );
          const key = matched
            ? buildOriginKey(matched.kind, matched.path, matched.label)
            : buildOriginKey(kind, path, label);
          state.selectedOriginKey = state.selectedOriginKey === key ? "" : key;
          renderContent();
        });
      }
      for (const item of el.content.querySelectorAll("[data-stage]")) {
        item.addEventListener("click", () => {
          const stage = item.getAttribute("data-stage") || "";
          state.selectedStage = state.selectedStage === stage ? "" : stage;
          renderContent();
        });
      }
      for (const item of el.content.querySelectorAll("[data-timeline-index]")) {
        item.addEventListener("click", () => {
          const index = Number(item.getAttribute("data-timeline-index"));
          if (!Number.isFinite(index)) return;
          state.selectedTimelineIndex = state.selectedTimelineIndex === index ? -1 : index;
          const eventItem = (run.timeline || [])[index];
          if (eventItem?.type === "before_compaction" || eventItem?.type === "after_compaction") {
            state.selectedStage = "history-limited";
            state.activeTab = "history";
          }
          if (eventItem?.type === "before_tool_call" || eventItem?.type === "after_tool_call") {
            state.activeTab = "history";
          }
          renderContent();
        });
      }
      for (const tab of el.content.querySelectorAll("[data-cut-filter]")) {
        tab.addEventListener("click", () => {
          const filter = tab.getAttribute("data-cut-filter");
          if (filter) {
            state.cutFilter = filter;
            renderContent();
          }
        });
      }
      el.content.querySelector("#clear-focus")?.addEventListener("click", () => {
        state.selectedOriginKey = "";
        state.selectedStage = "";
        state.selectedTimelineIndex = -1;
        renderContent();
      });
      el.content.querySelector("#copy-json")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(JSON.stringify(run, null, 2));
      });
      el.content.querySelector("#reload-diff")?.addEventListener("click", async () => {
        if (!state.currentRun) return;
        state.currentDiff = await fetchJson("/plugins/context-inspector/api/runs/" + encodeURIComponent(state.currentRun.runId) + "/diff");
        renderContent();
      });
    }

    function stat(label, value) {
      return '<article class="stat"><label>' + escapeHtml(label) + '</label><strong>' + escapeHtml(value) + '</strong></article>';
    }

    function overviewCard(label, value, body) {
      return '<article class="overview-card stat"><label>' + escapeHtml(label) + '</label><strong>' + escapeHtml(value) + '</strong><p>' + escapeHtml(body) + '</p></article>';
    }

    function pathStep(title, body) {
      return '<article class="path-step"><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(body) + '</p></article>';
    }

    function card(title, lead, body) {
      return '<section class="card"><div class="card-head"><div><div class="section-label">' + escapeHtml(title) + '</div><h3>' + escapeHtml(title) + '</h3></div></div><p class="card-lead">' + escapeHtml(lead) + '</p>' + body + '</section>';
    }

    async function loadRun(runId) {
      if (!runId) return;
      state.currentRun = await fetchJson("/plugins/context-inspector/api/runs/" + encodeURIComponent(runId));
      state.currentDiff = await fetchJson("/plugins/context-inspector/api/runs/" + encodeURIComponent(runId) + "/diff");
      renderRuns();
      renderContent();
    }

    async function refresh() {
      state.runs = await fetchJson("/plugins/context-inspector/api/runs?limit=80");
      if (!state.currentRun && state.runs[0]) {
        await loadRun(state.runs[0].runId);
        return;
      }
      if (state.currentRun) {
        const fresh = state.runs.find((run) => run.runId === state.currentRun.runId);
        if (fresh) {
          state.currentRun = await fetchJson("/plugins/context-inspector/api/runs/" + encodeURIComponent(fresh.runId));
          state.currentDiff = await fetchJson("/plugins/context-inspector/api/runs/" + encodeURIComponent(fresh.runId) + "/diff");
        }
      }
      renderRuns();
      renderContent();
    }

    el.search.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderRuns();
    });
    el.refresh.addEventListener("click", refresh);
    el.compare.addEventListener("click", async () => {
      if (!state.currentRun) return;
      state.currentDiff = await fetchJson("/plugins/context-inspector/api/runs/" + encodeURIComponent(state.currentRun.runId) + "/diff");
      renderContent();
    });
    refresh().catch((error) => {
      el.content.innerHTML = '<div class="empty">加载运行记录失败：' + escapeHtml(String(error)) + '</div>';
    });
  `;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>上下文分析台</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="app">
        <aside class="panel sidebar">
          <section class="hero">
            <h1>上下文分析台</h1>
            <p>在一个浏览器工作台里查看真实送模内容、来源归因、Prompt 噪音、重复信息、差异和执行过程。</p>
            <div class="hero-guide">
              <strong>建议阅读顺序</strong>
              <ol>
                <li>先挑一条噪音高的运行。</li>
                <li>先看来源地图和优先裁剪。</li>
                <li>最后再打开上下文分栏。</li>
              </ol>
            </div>
          </section>
          <section class="toolbar">
            <input id="search" type="search" placeholder="搜索运行、会话、模型或 provider" />
          </section>
          <section class="runs" id="runs"></section>
        </aside>
        <main class="panel main">
          <section class="topline">
            <div>
              <h2 id="heading">上下文工作台</h2>
              <p id="subtitle">先选择一条运行记录，再进入分析。</p>
            </div>
            <div class="actions">
              <button id="refresh" class="primary">刷新运行</button>
              <button id="compare">刷新对比</button>
            </div>
          </section>
          <section id="content"></section>
        </main>
      </div>
      <script>
        const escapeHtml = ${escapeHtml.toString()};
        ${script}
      </script>
    </body>
  </html>`;
}
