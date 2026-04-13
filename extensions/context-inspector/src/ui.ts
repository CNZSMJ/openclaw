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
      --bg: #dce1ea;
      --bg-strong: #cfd6e3;
      --panel: #eef1f7;
      --panel-strong: #f7f8fb;
      --panel-subtle: #e4e9f2;
      --surface: #fbfcfe;
      --surface-muted: #f2f4f9;
      --line: rgba(20, 24, 32, 0.1);
      --line-strong: rgba(20, 24, 32, 0.16);
      --text: #0f1419;
      --muted: #5c6570;
      --muted-strong: #3d4450;
      --accent: #0b6b72;
      --accent-soft: rgba(11, 107, 114, 0.14);
      --accent-strong: #0a4e54;
      --warn: #9a5d06;
      --warn-soft: rgba(154, 93, 6, 0.2);
      --danger: #932f21;
      --danger-soft: rgba(147, 47, 33, 0.18);
      --shadow: 0 4px 24px rgba(15, 20, 30, 0.08), 0 1px 3px rgba(15, 20, 30, 0.06);
      --shadow-soft: 0 2px 12px rgba(15, 20, 30, 0.05);
      --radius: 20px;
      --radius-lg: 22px;
      --space: 20px;
      --space-lg: 28px;
      --mono: "SFMono-Regular", "IBM Plex Mono", "Menlo", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      --serif: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    button:focus-visible,
    .tab:focus-visible,
    .run-card:focus-visible {
      outline: 2px solid var(--accent-strong);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    mark.hl {
      background: rgba(11, 107, 114, 0.22);
      color: inherit;
      padding: 0 2px;
      border-radius: 4px;
    }
    .status-banner {
      margin: 0 0 var(--space);
      padding: 14px 18px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      background: var(--surface);
      border: 1px solid rgba(11, 107, 114, 0.2);
      color: var(--muted-strong);
    }
    .status-banner.warn {
      background: var(--warn-soft);
      box-shadow: inset 0 0 0 1px rgba(154, 93, 6, 0.25);
    }
    .status-banner.error {
      background: var(--danger-soft);
      box-shadow: inset 0 0 0 1px rgba(147, 47, 33, 0.22);
      color: var(--danger);
    }
    html, body { margin: 0; min-height: 100%; background:
      radial-gradient(ellipse 90% 60% at 50% -10%, rgba(11, 107, 114, 0.12), transparent 55%),
      radial-gradient(circle at 100% 0%, rgba(80, 100, 140, 0.08), transparent 40%),
      linear-gradient(165deg, var(--bg) 0%, #c8d0df 100%);
      color: var(--text);
      font-family: var(--sans);
      font-size: 15px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    body { padding: var(--space); }
    .app {
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
      gap: var(--space-lg);
      min-height: calc(100vh - var(--space) * 2);
      max-width: 1920px;
      margin-inline: auto;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: sticky;
      top: var(--space);
      max-height: calc(100vh - var(--space) * 2);
      background: linear-gradient(180deg, var(--panel-strong) 0%, var(--panel) 100%);
    }
    .hero {
      padding: var(--space-lg) var(--space-lg) 14px;
      border-bottom: 1px solid var(--line);
    }
    .hero h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.03em;
      color: var(--text);
    }
    .hero p {
      margin: 12px 0 0;
      color: var(--muted-strong);
      line-height: 1.55;
      font-size: 14px;
      max-width: 36ch;
    }
    .hero-guide {
      margin-top: 14px;
      padding: 0;
    }
    .hero-guide strong { display: block; font-size: 12px; margin-bottom: 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .hero-guide ol {
      margin: 0;
      padding-left: 22px;
      color: var(--muted-strong);
      font-size: 14px;
      line-height: 1.65;
    }
    .hero-tip {
      margin: 12px 0 0;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .hero-tip code {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted-strong);
    }
    .toolbar {
      display: flex;
      gap: 10px;
      padding: 14px var(--space-lg) 16px;
      background: var(--surface-muted);
      border-bottom: 1px solid var(--line);
    }
    .toolbar input {
      width: 100%;
      padding: 14px 18px;
      border-radius: 14px;
      border: 0;
      background: var(--surface);
      box-shadow: inset 0 0 0 1px var(--line-strong);
      font: inherit;
      color: inherit;
      font-size: 14px;
    }
    .toolbar input::placeholder { color: var(--muted); }
    .runs {
      overflow: auto;
      padding: 14px var(--space-lg) var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    button.run-card {
      display: block;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      padding: 16px 16px 16px 18px;
      border-radius: 16px;
      border: 1px solid var(--line);
      border-left: 4px solid transparent;
      background: var(--surface);
      cursor: pointer;
      transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
      box-shadow: var(--shadow-soft);
    }
    .run-card:hover, .run-card.active {
      transform: translateY(-1px);
      border-left-color: var(--accent);
      border-color: rgba(11, 107, 114, 0.22);
      background: var(--panel-strong);
      box-shadow: 0 4px 16px rgba(11, 107, 114, 0.08);
    }
    button.run-card h3 {
      margin: 0 0 8px;
      font-size: 15px;
      font-weight: 600;
    }
    .run-meta {
      color: var(--muted-strong);
      font-size: 13px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      line-height: 1.45;
    }
    .run-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
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
    
    .main {
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--panel);
    }
    .main-header {
      padding: var(--space-lg) var(--space-lg) 0;
      background: var(--panel-strong);
      border-bottom: 1px solid var(--line-strong);
      flex-shrink: 0;
    }
    .main-scroll {
      flex: 1;
      overflow: auto;
      padding: var(--space-lg);
    }
    .nav-tabs {
      display: flex;
      gap: 4px;
      margin-top: var(--space);
    }
    .nav-tab {
      padding: 12px 24px;
      border-radius: 12px 12px 0 0;
      border: 1px solid transparent;
      border-bottom: 0;
      background: transparent;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      transition: all 150ms ease;
      font-size: 15px;
    }
    .nav-tab:hover {
      color: var(--text);
      background: var(--panel-subtle);
    }
    .nav-tab.active {
      color: var(--accent-strong);
      background: var(--panel);
      border-color: var(--line-strong);
      position: relative;
      z-index: 1;
    }
    .nav-tab.active::after {
      content: "";
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--panel);
    }
    /* 新增：仪表盘样式 */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space);
      margin-top: var(--space);
    }
    .filter-section {
      margin-bottom: var(--space-lg);
      padding: var(--space);
      background: var(--surface-muted);
      border-radius: 16px;
      border: 1px solid var(--line);
    }
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filter-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--muted-strong);
      margin-right: 8px;
      text-transform: uppercase;
    }
    .chip {
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--line-strong);
      font-size: 13px;
      cursor: pointer;
      transition: all 120ms ease;
    }
    .chip:hover {
      background: var(--panel-subtle);
      border-color: var(--accent);
    }
    .chip.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .run-tile {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: var(--space);
      cursor: pointer;
      transition: all 150ms ease;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: var(--shadow-soft);
    }
    .run-tile:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow);
      border-color: var(--accent);
    }
    .run-tile h4 { margin: 0; font-size: 16px; }
    .run-tile .tile-meta { font-size: 12px; color: var(--muted); }
    .run-tile .tile-stats { display: flex; gap: 12px; font-size: 13px; font-weight: 600; }
    .topline {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
    }
    .topline h2 {
      margin: 0;
      font-size: 22px;
      font-family: var(--serif);
      font-weight: 600;
      letter-spacing: -0.025em;
    }
    .topline p { margin: 6px 0 0; color: var(--muted-strong); font-size: 14px; line-height: 1.45; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button {
      border: 0;
      background: var(--surface);
      color: var(--text);
      border-radius: 12px;
      padding: 10px 16px;
      font-weight: 600;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px var(--line-strong);
    }
    button.primary {
      background: var(--accent);
      color: #f6efe6;
      box-shadow: none;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space);
      margin-bottom: var(--space-lg);
    }
    @media (min-width: 1500px) {
      .overview-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    .overview-card,
    .stat {
      padding: 18px 20px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-soft);
    }
    .overview-card label,
    .stat label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-weight: 700;
    }
    .overview-card strong,
    .stat strong { display: block; font-size: 17px; line-height: 1.35; font-weight: 600; }
    .overview-card p {
      margin: 12px 0 0;
      color: var(--muted-strong);
      font-size: 14px;
      line-height: 1.5;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space);
      margin-bottom: var(--space-lg);
    }
    @media (min-width: 1500px) {
      .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-lg);
      align-items: start;
    }
    @media (min-width: 1280px) {
      .workspace-grid {
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.25fr) minmax(300px, 0.95fr);
        gap: var(--space-lg);
      }
    }
    .workspace-column {
      min-width: 0;
      padding: var(--space-lg);
      border-radius: var(--radius-lg);
      border: 1px solid var(--line-strong);
      box-shadow: var(--shadow-soft);
    }
    .workspace-column:nth-child(1) {
      background: linear-gradient(165deg, #f0f4fc 0%, #e6edf8 100%);
    }
    .workspace-column:nth-child(2) {
      background: linear-gradient(165deg, #f2f8f8 0%, #e8f2f2 100%);
    }
    .workspace-column:nth-child(3) {
      background: linear-gradient(165deg, #f8f5f0 0%, #f0ebe4 100%);
    }
    .workspace-column > .stack { gap: var(--space-lg); }
    .workspace-title {
      margin: 0 0 var(--space);
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(11, 107, 114, 0.2);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted-strong);
    }
    .stack { display: flex; flex-direction: column; gap: var(--space-lg); }
    .card {
      padding: var(--space-lg);
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-soft);
    }
    .card .card-title {
      margin: 0 0 12px;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.3;
      color: var(--text);
    }
    .card-lead {
      color: var(--muted-strong);
      font-size: 14px;
      line-height: 1.55;
      margin: 0 0 4px;
    }
    .tree, .timeline, .segments { display: flex; flex-direction: column; gap: 12px; }
    .tree-item, .timeline-item, .segment {
      border-radius: 14px;
      padding: 16px 18px;
      background: var(--surface-muted);
      border: 1px solid var(--line);
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
      background: var(--surface);
      border-color: rgba(11, 107, 114, 0.25);
      box-shadow: 0 4px 14px rgba(11, 107, 114, 0.07);
    }
    .tree-item.active,
    .timeline-item.active,
    .segment.active {
      background: var(--accent-soft);
      border-color: rgba(11, 107, 114, 0.35);
    }
    .tree-item small, .timeline-item small, .segment small {
      color: var(--muted-strong);
      display: block;
      margin-top: 6px;
      font-size: 13px;
      line-height: 1.45;
    }
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
      margin: 14px 0 0;
      white-space: pre-wrap;
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.62;
      color: #1a1f26;
      background: #e4e9f2;
      border: 1px solid rgba(24, 28, 33, 0.1);
      padding: 16px 18px;
      border-radius: 12px;
      max-height: min(52vh, 520px);
      overflow: auto;
    }
    .tabs { display: flex; gap: 10px; margin: 16px 0 14px; flex-wrap: wrap; }
    .tab {
      padding: 10px 18px;
      border-radius: 12px;
      border: 0;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      background: var(--surface-muted);
      box-shadow: inset 0 0 0 1px var(--line);
    }
    .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .muted { color: var(--muted-strong); }
    .empty {
      min-height: 44vh;
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--muted-strong);
      border-radius: var(--radius-lg);
      background: var(--surface-muted);
      border: 1px dashed var(--line-strong);
      padding: var(--space-lg);
      font-size: 15px;
      line-height: 1.55;
    }
    .diff { display: grid; gap: 12px; }
    .metric-line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
    }
    .metric-line:last-child { border-bottom: 0; }
    .pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .reading-path {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space);
      margin-bottom: var(--space-lg);
    }
    @media (min-width: 900px) {
      .reading-path { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    .path-step {
      border-radius: 16px;
      padding: 18px 20px;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-soft);
    }
    .path-step strong { display: block; font-size: 15px; margin-bottom: 10px; font-weight: 600; }
    .path-step p { margin: 0; color: var(--muted-strong); font-size: 14px; line-height: 1.55; }
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
      gap: 16px;
      margin-bottom: 16px;
      padding: 16px 18px;
      border-radius: 14px;
      background: var(--accent-soft);
      border: 1px solid rgba(11, 107, 114, 0.2);
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
    @media (max-width: 1279px) {
      .workspace-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) {
      body { padding: 16px; }
      .app { grid-template-columns: 1fr; gap: var(--space); }
      .sidebar { position: static; max-height: none; min-height: 280px; }
      .overview-grid,
      .stats { grid-template-columns: 1fr; }
      .topline { grid-template-columns: 1fr; align-items: start; }
      .reading-path { grid-template-columns: 1fr; }
      .summary-grid,
      .section-grid { grid-template-columns: 1fr; }
    }
  `;

  const script = `
    const state = {
      runs: [],
      currentRun: null,
      currentDiff: null,
      activeTab: "system",
      activeNav: "overview",
      cutFilter: "all",
      query: "",
      filterProvider: "", // 新增
      filterModel: "",    // 新增
      selectedOriginKey: "",
      selectedStage: "",
      selectedTimelineIndex: -1,
      loadDepth: 0,
      lastError: "",
      statusHint: "",
    };

    const el = {
      runs: document.querySelector("#runs"),
      search: document.querySelector("#search"),
      content: document.querySelector("#content"),
      main: document.querySelector("#inspector-main"),
      statusBanner: document.querySelector("#status-banner"),
    };

    const RUN_HASH_PREFIX = "#run=";

    const fmtNumber = new Intl.NumberFormat("zh-CN");
    const fmtDate = new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    function setBusy(delta) {
      state.loadDepth = Math.max(0, state.loadDepth + delta);
    }

    function captureScroll() {
      return {
        main: el.main ? el.main.scrollTop : 0,
        runs: el.runs ? el.runs.scrollTop : 0,
      };
    }

    function restoreScroll(saved) {
      requestAnimationFrame(() => {
        if (el.main) {
          el.main.scrollTop = saved.main;
        }
        if (el.runs) {
          el.runs.scrollTop = saved.runs;
        }
      });
    }

    function scrollSegmentsIntoView() {
      requestAnimationFrame(() => {
        const seg = document.getElementById("context-segments");
        if (seg && typeof seg.scrollIntoView === "function") {
          seg.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    }

    function setStatusBanner(message, kind) {
      if (!el.statusBanner) {
        return;
      }
      el.statusBanner.textContent = message || "";
      el.statusBanner.hidden = !message;
      el.statusBanner.classList.remove("warn", "error");
      if (kind === "warn") {
        el.statusBanner.classList.add("warn");
      }
      if (kind === "error") {
        el.statusBanner.classList.add("error");
      }
    }

    function flashHint(text) {
      state.statusHint = text;
      setStatusBanner(text, "warn");
      window.setTimeout(() => {
        if (state.statusHint === text) {
          state.statusHint = "";
          if (!state.lastError) {
            setStatusBanner("", "");
          }
        }
      }, 4200);
    }

    function readRunIdFromHash() {
      const raw = (location.hash || "").slice(1);
      if (!raw.startsWith("run=")) {
        return "";
      }
      try {
        return decodeURIComponent(raw.slice("run=".length));
      } catch {
        return "";
      }
    }

    function writeRunHash(runId) {
      const next = RUN_HASH_PREFIX + encodeURIComponent(runId);
      if (location.hash !== next) {
        history.replaceState(null, "", next);
      }
    }

    function highlightQuery(text, query) {
      const q = (query || "").trim();
      const base = escapeHtml(text);
      if (!q) {
        return base;
      }
      const lower = String(text).toLowerCase();
      const qi = lower.indexOf(q.toLowerCase());
      if (qi < 0) {
        return base;
      }
      return (
        escapeHtml(String(text).slice(0, qi)) +
        '<mark class="hl">' +
        escapeHtml(String(text).slice(qi, qi + q.length)) +
        "</mark>" +
        escapeHtml(String(text).slice(qi + q.length))
      );
    }

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
      return '<div class="tabs" role="tablist">' + filters.map(([key, label, count]) =>
        '<button type="button" role="tab" class="tab ' + (active === key ? 'active' : '') + '" data-cut-filter="' + key + '" aria-selected="' + (active === key ? 'true' : 'false') + '">' +
          escapeHtml(label + " (" + count + ")") +
        '</button>'
      ).join("") + '</div>';
    }

    function renderOriginDetails(origin) {
      const meta = origin.metadata || {};
      const details = [];
      if (origin.kind === "bootstrap-file") {
        if (typeof meta.rawChars === "number") {
          details.push("原始 " + fmtNumber.format(meta.rawChars) + " 字符");
        }
        if (typeof meta.injectedChars === "number") {
          details.push("注入 " + fmtNumber.format(meta.injectedChars) + " 字符");
        }
        if (meta.missing) {
          details.push("采集时文件缺失");
        }
      }
      if (origin.kind === "bootstrap-file-section") {
        if (origin.path) {
          details.push("片段来自 " + origin.path);
        }
        if (typeof meta.sectionIndex === "number") {
          details.push("片段序号 #" + (meta.sectionIndex + 1));
        }
      }
      if (origin.kind === "skill" && typeof meta.blockChars === "number") {
        details.push("技能块 " + fmtNumber.format(meta.blockChars) + " 字符");
      }
      if (origin.kind === "tool-schema") {
        if (typeof meta.schemaChars === "number") {
          details.push("Schema " + fmtNumber.format(meta.schemaChars) + " 字符");
        }
        if (typeof meta.summaryChars === "number") {
          details.push("摘要 " + fmtNumber.format(meta.summaryChars) + " 字符");
        }
        if (typeof meta.propertiesCount === "number") {
          details.push(fmtNumber.format(meta.propertiesCount) + " 个属性");
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
          details.push("压缩前 " + fmtNumber.format(meta.originalMessageCount) + " 条消息");
        }
        if (typeof meta.compactingCount === "number") {
          details.push("参与压缩 " + fmtNumber.format(meta.compactingCount) + " 条消息");
        }
        if (typeof meta.originalTokenCount === "number") {
          details.push("压缩前约 " + fmtNumber.format(meta.originalTokenCount) + " tok");
        }
        if (typeof meta.tokenCount === "number") {
          details.push("压缩段约 " + fmtNumber.format(meta.tokenCount) + " tok");
        }
      }
      if (item.type === "after_compaction") {
        if (typeof meta.tokensBefore === "number") {
          details.push("压缩前 " + fmtNumber.format(meta.tokensBefore) + " tok");
        }
        if (typeof meta.tokenCount === "number") {
          details.push("压缩后 " + fmtNumber.format(meta.tokenCount) + " tok");
        }
        if (typeof meta.firstKeptEntryId === "string" && meta.firstKeptEntryId) {
          details.push("首条保留 " + meta.firstKeptEntryId);
        }
        if (typeof meta.summary === "string" && meta.summary) {
          details.push("摘要：" + meta.summary);
        }
      }
      if (item.type === "after_tool_call" && typeof meta.durationMs === "number") {
        details.push("耗时 " + fmtNumber.format(meta.durationMs) + " ms");
      }
      return details.map((line) => '<small>' + escapeHtml(line) + '</small>').join("");
    }

    function renderStageBadges(stage) {
      const badges = [];
      if (stage.charsDelta) {
        badges.push('<span class="badge' + (stage.charsDelta > 0 ? ' warn' : '') + '">字符 ' + escapeHtml(prettyDelta(stage.charsDelta)) + '</span>');
      }
      if (typeof stage.tokenDelta === "number" && stage.tokenDelta !== 0) {
        badges.push('<span class="badge' + (stage.tokenDelta > 0 ? ' warn' : '') + '">tok ' + escapeHtml(prettyDelta(stage.tokenDelta)) + '</span>');
      }
      if (stage.duplicateDelta) {
        badges.push('<span class="badge' + (stage.duplicateDelta > 0 ? ' danger' : '') + '">重复 ' + escapeHtml(prettyDelta(stage.duplicateDelta)) + '</span>');
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
      return '<small>来源 · ' + escapeHtml(parts.join(" · ")) + '</small>';
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
            title: "聚焦来源",
            body:
              origin.label +
              " · " +
              fmtNumber.format(origin.chars) +
              " 字符 · " +
              fmtNumber.format(origin.estimatedTokens) +
              " tok",
          });
        }
      }
      if (state.selectedStage) {
        const stage = (run.input.contextStages || []).find((item) => item.stage === state.selectedStage);
        if (stage) {
          chunks.push({
            title: "聚焦阶段",
            body:
              prettyDelta(stage.charsDelta || 0) +
              " 字符 · " +
              prettyDelta(stage.tokenDelta || 0) +
              " tok · " +
              fmtNumber.format(stage.messageCount || 0) +
              " 条消息",
          });
        }
      }
      if (state.selectedTimelineIndex >= 0) {
        const item = (run.timeline || [])[state.selectedTimelineIndex];
        if (item) {
          chunks.push({
            title: "聚焦时间线",
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
        " 个片段。</p></div><button type='button' id='clear-focus'>清除聚焦</button></div>"
      );
    }

    function renderRuns() {
      const saved = captureScroll();
      const query = state.query.trim().toLowerCase();
      const rawQuery = state.query.trim();
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
            const titleLine = run.provider + "/" + run.model;
            return (
              '<button type="button" class="run-card ' +
              (active ? "active" : "") +
              '" data-run-id="' +
              escapeHtml(run.runId) +
              '"' +
              (active ? ' aria-current="true"' : "") +
              ">" +
              "<h3>" +
              highlightQuery(titleLine, rawQuery) +
              "</h3>" +
              '<div class="run-meta">' +
              "<span>" +
              highlightQuery(String(run.sessionKey || run.runId), rawQuery) +
              "</span>" +
              "<span>" +
              escapeHtml(fmtDate.format(new Date(run.startedAt))) +
              "</span>" +
              "</div>" +
              '<div class="run-badges">' +
              badges +
              "</div>" +
              "</button>"
            );
          }).join("")
        : '<div class="empty">还没有采集到运行记录。先触发一次 agent 运行，再刷新这里。</div>';

      for (const card of el.runs.querySelectorAll("button.run-card")) {
        card.addEventListener("click", () => loadRun(card.getAttribute("data-run-id")));
      }
      restoreScroll({ main: saved.main, runs: saved.runs });
    }

    function renderContent() {
      const scrollSnap = captureScroll();
      
      if (!state.currentRun) {
        const header = document.querySelector(".main-header");
        if (header) {
          header.innerHTML = '<section class="topline"><div><h2>运行历史概览</h2><p>点击下方卡片或左侧列表开始分析。</p></div><div class="actions"><button type="button" id="refresh-all">刷新数据</button></div></section>';
        }

        // 提取所有 Provider 和 Model 用于筛选
        const providers = [...new Set(state.runs.map(r => r.provider))].filter(Boolean);
        const models = [...new Set(state.runs.map(r => r.model))].filter(Boolean);

        const filterHtml = [
          '<div class="filter-section">',
            '<div class="filter-group" style="margin-bottom:12px">',
              '<span class="filter-label">Provider:</span>',
              '<button class="chip ' + (!state.filterProvider ? 'active' : '') + '" data-filter-p="">全部</button>',
              providers.map(p => '<button class="chip ' + (state.filterProvider === p ? 'active' : '') + '" data-filter-p="' + escapeHtml(p) + '">' + escapeHtml(p) + '</button>').join(""),
            '</div>',
            '<div class="filter-group">',
              '<span class="filter-label">模型:</span>',
              modelChip("全部", ""),
              models.map(m => modelChip(m, m)).join(""),
            '</div>',
          '</div>'
        ].join("");

        function modelChip(label, val) {
          return '<button class="chip ' + (state.filterModel === val ? 'active' : '') + '" data-filter-m="' + escapeHtml(val) + '">' + escapeHtml(label) + '</button>';
        }

        const filteredRuns = state.runs.filter(r => {
          if (state.filterProvider && r.provider !== state.filterProvider) return false;
          if (state.filterModel && r.model !== state.filterModel) return false;
          if (state.query) {
            const q = state.query.toLowerCase();
            return [r.runId, r.sessionKey, r.provider, r.model].some(s => String(s || "").toLowerCase().includes(q));
          }
          return true;
        });

        const tilesHtml = filteredRuns.length ? 
          '<div class="dashboard-grid">' + filteredRuns.map(r => 
            '<div class="run-tile" data-run-id="' + r.runId + '">' +
              '<h4>' + escapeHtml(r.provider + '/' + r.model) + '</h4>' +
              '<div class="tile-meta">' + escapeHtml(fmtDate.format(new Date(r.startedAt))) + '</div>' +
              '<div class="tile-stats">' +
                '<span class="' + (r.noiseScore > 40 ? 'badge warn' : 'badge') + '">噪音 ' + r.noiseScore + '</span>' +
                '<span class="badge">' + fmtNumber.format(r.estimatedTokens) + ' tok</span>' +
              '</div>' +
              '<div class="tile-meta" style="margin-top:auto">会话: ' + escapeHtml(r.sessionKey || r.runId) + '</div>' +
            '</div>'
          ).join("") + '</div>' :
          '<div class="empty">没有符合筛选条件的运行记录。</div>';

        el.content.innerHTML = filterHtml + tilesHtml;

        // 绑定筛选事件
        for (const btn of el.content.querySelectorAll("[data-filter-p]")) {
          btn.addEventListener("click", () => { state.filterProvider = btn.getAttribute("data-filter-p"); renderContent(); });
        }
        for (const btn of el.content.querySelectorAll("[data-filter-m]")) {
          btn.addEventListener("click", () => { state.filterModel = btn.getAttribute("data-filter-m"); renderContent(); });
        }
        for (const tile of el.content.querySelectorAll(".run-tile")) {
          tile.addEventListener("click", () => loadRun(tile.getAttribute("data-run-id")));
        }
        document.querySelector("#refresh-all")?.addEventListener("click", refresh);
        return;
      }

      const run = state.currentRun;
      
      // 渲染主导航
      const navs = [
        ["overview", "1. 诊断概览"],
        ["structure", "2. 来源与成本"],
        ["content", "3. 最终正文"],
      ];
      const navHtml = '<div class="nav-tabs">' + navs.map(([key, label]) => 
        '<button type="button" class="nav-tab ' + (state.activeNav === key ? 'active' : '') + '" data-nav="' + key + '">' + label + '</button>'
      ).join("") + '</div>';

      // 准备数据
      const originsSorted = [...(run.input.origins || [])].sort((a, b) => (b.chars || 0) - (a.chars || 0));
      const tabs = [["system", "系统"], ["prompt", "提示词"], ["history", "历史"]];
      const tabHtml = tabs.map(([key, label]) =>
        '<button type="button" role="tab" class="tab ' + (state.activeTab === key ? "active" : "") + '" data-tab="' + key + '" aria-selected="' + (state.activeTab === key ? "true" : "false") + '">' + label + "</button>"
      ).join("");
      
      const segments = state.activeTab === "system" ? run.input.systemSegments : state.activeTab === "prompt" ? run.input.promptSegments : run.input.historySegments;
      const filteredSegments = segments.filter(s => !state.selectedOriginKey || getSegmentOriginKey(s) === state.selectedOriginKey);
      
      const segmentHtml = filteredSegments.length ? filteredSegments.map(segment => {
        const attention = typeof segment.attentionProxyScore === "number" ? '<span class="badge">attention 近似分 ' + segment.attentionProxyScore + "</span>" : "";
        const active = state.selectedOriginKey && getSegmentOriginKey(segment) === state.selectedOriginKey;
        return '<article class="segment clickable ' + (active ? 'active' : '') + '" data-segment-origin="' + escapeHtml(getSegmentOriginKey(segment)) + '" title="点击联动筛选来源">' +
          '<strong>' + escapeHtml(segment.label) + '</strong>' +
          '<small>' + fmtNumber.format(segment.chars) + ' 字符 · ' + fmtNumber.format(segment.estimatedTokens) + ' tok</small>' +
          '<pre>' + escapeHtml(segment.text || "（空）") + '</pre>' +
        '</article>';
      }).join("") : '<div class="muted">当前筛选下无内容。</div>';

      const originsHtml = originsSorted.map(origin => {
        const key = buildOriginKey(origin.kind, origin.path, origin.label);
        return '<div class="tree-item clickable ' + (state.selectedOriginKey === key ? 'active' : '') + '" data-origin-key="' + escapeHtml(key) + '">' +
          '<strong>' + escapeHtml(origin.label) + '</strong>' +
          '<small>' + fmtNumber.format(origin.chars) + ' 字符 · ' + fmtNumber.format(origin.estimatedTokens) + ' tok</small>' +
        '</div>';
      }).join("");

      const contextStages = (run.input.contextStages || []).map(stage => {
        const labels = { "sanitized": "清洗", "validated": "校验", "history-limited": "裁剪", "context-engine-assembled": "组装", "final": "最终" };
        return '<div class="tree-item clickable ' + (state.selectedStage === stage.stage ? 'active' : '') + '" data-stage="' + escapeHtml(stage.stage) + '">' +
          '<strong>' + escapeHtml(labels[stage.stage] || stage.stage) + '</strong>' +
          '<div class="pill-row">' + renderStageBadges(stage) + '</div>' +
        '</div>';
      }).join("");

      let bodyHtml = "";
      if (state.activeNav === "overview") {
        const topOrigin = originsSorted[0];
        bodyHtml = [
          '<section class="overview-grid">',
            overviewCard("健康度诊断", (run.input.noiseScore > 40 ? "⚠️ 噪音较高" : "✅ 结构良好"), "噪音分：" + run.input.noiseScore + "。过高的噪音会分散模型注意力。"),
            overviewCard("冗余度", (run.input.duplicateChars > 5000 ? "⚠️ 存在大量重复" : "✅ 重复率低"), "重复字符：" + fmtNumber.format(run.input.duplicateChars) + "。建议检查工具定义或历史消息。"),
            overviewCard("最大成本项", topOrigin ? topOrigin.label : "无", topOrigin ? fmtNumber.format(topOrigin.chars) + " 字符 (" + topOrigin.kind + ")" : ""),
            overviewCard("优化建议", (run.input.suggestions?.length || 0) + " 条", "点击「来源与成本」查看具体改进动作。"),
          '</section>',
          '<section class="stats">',
            stat("总长度", fmtNumber.format(run.input.chars) + " 字符"),
            stat("估算 Token", fmtNumber.format(run.input.estimatedTokens)),
            stat("工具调用", String(run.counters.toolCalls)),
            stat("压缩次数", String(run.counters.compactions)),
          '</section>',
          card("下一步动作", "基于分析结果建议的操作：", (run.input.suggestions?.length ? 
            '<div class="tree">' + run.input.suggestions.map(s => '<div class="tree-item"><strong>' + escapeHtml(s.title) + '</strong><small>' + escapeHtml(s.detail) + '</small></div>').join("") + '</div>' : 
            '<div class="muted">目前一切良好，暂无建议。</div>'))
        ].join("");
      } else if (state.activeNav === "structure") {
        bodyHtml = [
          '<div class="workspace-grid">',
            '<div class="workspace-column"><div class="workspace-title">成本分布 (Origins)</div><div class="stack">',
              card("来源地图", "按体积排序，点击项可在「最终正文」中高亮。", '<div class="tree">' + originsHtml + '</div>'),
              card("注入文件", "工作区上下文注入情况。", (run.input.report?.injectedWorkspaceFiles?.length ? '<div class="tree">' + run.input.report.injectedWorkspaceFiles.map(f => '<div class="tree-item"><strong>' + escapeHtml(f.name) + '</strong><small>' + fmtNumber.format(f.injectedChars) + ' 字符</small></div>').join("") + '</div>' : '<div class="muted">无文件注入。</div>')),
            '</div></div>',
            '<div class="workspace-column"><div class="workspace-title">处理阶段 (Stages)</div><div class="stack">',
              card("流水线变化", "查看 Prompt 在各阶段的增减。", '<div class="tree">' + contextStages + '</div>'),
              card("会话对比", "与上一条运行的差异。", state.currentDiff ? '<div class="diff"><div class="metric-line"><span>字符变化</span><strong>' + prettyDelta(state.currentDiff.metrics.charsDelta) + '</strong></div><div class="metric-line"><span>Token 变化</span><strong>' + prettyDelta(state.currentDiff.metrics.tokenDelta) + '</strong></div></div>' : '<div class="muted">无对比数据。</div>'),
            '</div></div>',
            '<div class="workspace-column"><div class="workspace-title">优化建议 (Actions)</div><div class="stack">',
              card("优先裁剪项", "建议删除或缩减的内容。", '<div class="tree">' + (run.input.cutFirst?.length ? run.input.cutFirst.map(c => '<div class="tree-item"><strong>' + escapeHtml(c.title) + '</strong><small>' + escapeHtml(c.reason) + '</small><small>建议：' + escapeHtml(c.action) + '</small></div>').join("") : '<div class="muted">无明显可裁剪项。</div>') + '</div>'),
            '</div></div>',
          '</div>'
        ].join("");
      } else {
        bodyHtml = [
          card("最终送模文本", "这是模型真正看到的 Prompt 内容。", renderFocusBar(run, filteredSegments.length, segments.length) + '<div class="tabs" role="tablist">' + tabHtml + '</div><div class="segments" id="context-segments">' + segmentHtml + '</div>'),
          '<div class="section-grid">',
            card("执行时间线", "工具调用与压缩事件。", '<div class="timeline">' + (run.timeline?.map((t, i) => '<div class="timeline-item clickable ' + (state.selectedTimelineIndex === i ? 'active' : '') + '" data-timeline-index="' + i + '"><strong>' + escapeHtml(t.title) + '</strong><small>' + (t.summary || "") + '</small></div>').join("") || "") + '</div>'),
            card("模型思考", "Reasoning / Thinking 内容。", (run.output?.thinkingTexts?.length ? run.output.thinkingTexts.map(t => '<pre>' + escapeHtml(t) + '</pre>').join("") : '<div class="muted">无思考内容。</div>')),
          '</div>'
        ].join("");
      }

      const header = document.querySelector(".main-header");
      if (header) {
        header.innerHTML = [
          '<section class="topline">',
            '<div><button type="button" id="back-to-dash" style="margin-bottom:8px; padding:4px 10px; font-size:12px">← 返回历史概览</button><h2>' + escapeHtml(run.provider + '/' + run.model) + '</h2><p>' + escapeHtml(run.sessionKey || run.runId) + '</p></div>',
            '<div class="actions"><button type="button" class="primary" id="copy-json">复制 JSON</button><button type="button" id="refresh-all">刷新</button></div>',
          '</section>',
          navHtml
        ].join("");
      }

      el.content.innerHTML = bodyHtml;

      // 绑定
      for (const btn of document.querySelectorAll("[data-nav]")) {
        btn.addEventListener("click", () => { 
          state.activeNav = btn.getAttribute("data-nav"); 
          renderContent(); 
        });
      }
      const backBtn = document.querySelector("#back-to-dash");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          state.currentRun = null;
          state.currentDiff = null;
          writeRunHash("");
          renderContent();
        });
      }
      for (const btn of el.content.querySelectorAll("[data-tab]")) {
        btn.addEventListener("click", () => { state.activeTab = btn.getAttribute("data-tab"); renderContent(); });
      }
      for (const item of el.content.querySelectorAll("[data-origin-key]")) {
        item.addEventListener("click", () => { 
          state.selectedOriginKey = state.selectedOriginKey === item.getAttribute("data-origin-key") ? "" : item.getAttribute("data-origin-key");
          if (state.selectedOriginKey) { state.activeNav = "content"; }
          renderContent(); 
        });
      }
      for (const item of el.content.querySelectorAll("[data-segment-origin]")) {
        item.addEventListener("click", () => {
          state.selectedOriginKey = state.selectedOriginKey === item.getAttribute("data-segment-origin") ? "" : item.getAttribute("data-segment-origin");
          renderContent();
        });
      }
      for (const item of el.content.querySelectorAll("[data-stage]")) {
        item.addEventListener("click", () => {
          state.selectedStage = state.selectedStage === item.getAttribute("data-stage") ? "" : item.getAttribute("data-stage");
          renderContent();
        });
      }
      for (const item of el.content.querySelectorAll("[data-timeline-index]")) {
        item.addEventListener("click", () => {
          const idx = Number(item.getAttribute("data-timeline-index"));
          state.selectedTimelineIndex = state.selectedTimelineIndex === idx ? -1 : idx;
          renderContent();
        });
      }
      document.querySelector("#refresh-all")?.addEventListener("click", refresh);
      document.querySelector("#copy-json")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(JSON.stringify(run, null, 2));
        flashHint("已复制 JSON");
      });
      el.content.querySelector("#clear-focus")?.addEventListener("click", () => {
        state.selectedOriginKey = "";
        state.selectedStage = "";
        state.selectedTimelineIndex = -1;
        renderContent();
      });
      
      restoreScroll(scrollSnap);
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
      return (
        '<section class="card"><h3 class="card-title">' +
        escapeHtml(title) +
        '</h3><p class="card-lead">' +
        escapeHtml(lead) +
        "</p>" +
        body +
        "</section>"
      );
    }

    async function loadRunBody(runId) {
      if (!runId) {
        throw new Error("缺少 runId");
      }
      state.currentRun = await fetchJson(
        "/plugins/context-inspector/api/runs/" + encodeURIComponent(runId),
      );
      state.currentDiff = await fetchJson(
        "/plugins/context-inspector/api/runs/" + encodeURIComponent(runId) + "/diff",
      );
      writeRunHash(runId);
      state.lastError = "";
      setStatusBanner("", "");
    }

    async function loadRun(runId) {
      if (!runId) return;
      setBusy(1);
      try {
        await loadRunBody(runId);
      } catch (error) {
        state.lastError = String(error);
        setStatusBanner("加载运行失败：" + state.lastError, "error");
        state.currentRun = null;
        state.currentDiff = null;
      } finally {
        setBusy(-1);
      }
      renderRuns();
      renderContent();
    }

    async function refresh() {
      setBusy(1);
      state.lastError = "";
      try {
        state.runs = await fetchJson("/plugins/context-inspector/api/runs?limit=80");
        const hashId = readRunIdFromHash();
        if (hashId && state.runs.some((run) => run.runId === hashId)) {
          await loadRunBody(hashId);
        } else if (hashId && state.runs.length > 0) {
          flashHint("地址中的运行已不在保留列表（可能已被修剪），已改为打开最新一条。");
          await loadRunBody(state.runs[0].runId);
        } else if (state.currentRun) {
          const fresh = state.runs.find((run) => run.runId === state.currentRun.runId);
          if (fresh) {
            await loadRunBody(fresh.runId);
          }
        }
        renderRuns();
        renderContent();
      } catch (error) {
        state.lastError = String(error);
        setStatusBanner("刷新失败：" + state.lastError, "error");
        el.content.innerHTML =
          '<div class="empty">无法加载运行列表。请确认插件已启用且网关可达，然后重试。<br/><br/>' +
          escapeHtml(state.lastError) +
          "</div>";
      } finally {
        setBusy(-1);
      }
    }

    el.search.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderRuns();
    });
    window.addEventListener("hashchange", () => {
      const id = readRunIdFromHash();
      if (id) {
        void loadRun(id);
      }
    });
    refresh().catch((error) => {
      state.lastError = String(error);
      setStatusBanner("初始化失败：" + state.lastError, "error");
      el.content.innerHTML = '<div class="empty">加载运行记录失败：' + escapeHtml(String(error)) + "</div>";
    });
  `;

  return `<!doctype html>
  <html lang="zh-CN">
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
              <p class="hero-tip">协作排障：选中某次运行后地址栏会出现 <code>#run=…</code>，复制整段 URL 可让别人打开同一条记录。</p>
            </div>
          </section>
          <section class="toolbar">
            <input id="search" type="search" placeholder="搜索运行、会话、模型或 provider" aria-label="搜索运行记录" />
          </section>
          <section class="runs" id="runs"></section>
        </aside>
        <main class="panel main" id="inspector-main">
          <header class="main-header"></header>
          <div id="status-banner" class="status-banner" role="status" aria-live="polite" hidden></div>
          <div class="main-scroll">
            <section id="content"></section>
          </div>
        </main>
      </div>
      <script>
        const escapeHtml = ${escapeHtml.toString()};
        ${script}
      </script>
    </body>
  </html>`;
}
