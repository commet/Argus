#!/usr/bin/env node
/**
 * Argus Status Line for Claude Code
 *
 * Design principle: show what changes behavior, not what decorates the screen.
 * Every line must contain information the user CANNOT see in the conversation.
 *
 * Line 1: Model + Context forecast + Cost + Duration
 * Line 2: Decision intelligence (journal-based) — DQ trend, blind spot nudge
 * Line 3: Live quality metrics (during pipeline only) — assumptions, pushback, risks
 *
 * Zero dependencies — pure Node.js (CommonJS).
 */

const { readFileSync, existsSync, statSync, openSync, readSync, closeSync } = require("fs");
const { execSync } = require("child_process");
const { basename, join } = require("path");

// ─── ANSI ────────────────────────────────────────────────

const E = "\x1b[";
const R = `${E}0m`;
const BOLD = `${E}1m`;
const DIM = `${E}2m`;
const C = {
  g: `${E}32m`, y: `${E}33m`, r: `${E}31m`,
  c: `${E}36m`, m: `${E}35m`, b: `${E}34m`,
  w: `${E}37m`, d: `${E}90m`,
};

// ─── Stdin ───────────────────────────────────────────────

function readStdin() {
  try {
    const chunks = [];
    const buf = Buffer.alloc(4096);
    while (true) {
      try {
        const n = readSync(process.stdin.fd, buf, 0, 4096);
        if (n === 0) break;
        chunks.push(Buffer.from(buf.slice(0, n)));
      } catch { break; }
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
}

// ─── Journal parser (cached) ─────────────────────────────

let journalCache = { mtime: 0, data: null };

function parseJournal(cwd) {
  const jpath = join(cwd, ".argus", "journal.md");
  if (!existsSync(jpath)) return null;

  try {
    const stat = statSync(jpath);
    const mtime = stat.mtimeMs;
    if (journalCache.mtime === mtime && journalCache.data) return journalCache.data;

    const raw = readFileSync(jpath, "utf8");
    const entries = [];
    let current = null;

    for (const line of raw.split("\n")) {
      if (line.startsWith("## ")) {
        if (current) entries.push(current);
        current = { header: line, fields: {} };
      } else if (current && line.startsWith("- ")) {
        const m = line.match(/^- (\w[\w\s]*?):\s*(.+)/);
        if (m) current.fields[m[1].trim().toLowerCase()] = m[2].trim();
      }
    }
    if (current) entries.push(current);

    // Extract DQ scores
    const dqScores = [];
    const blindSpots = [];
    const growthEdges = [];
    const skills = { reframe: 0, recast: 0, rehearse: 0, refine: 0, argus: 0 };
    let assumptionStats = { confident: 0, uncertain: 0, doubtful: 0 };

    for (const e of entries) {
      // Count skills
      const hdr = e.header.toLowerCase();
      for (const s of Object.keys(skills)) {
        if (hdr.includes(s)) { skills[s]++; break; }
      }

      // DQ scores
      const score = e.fields["score"];
      if (score) {
        const m = score.match(/DQ\s*(\d+)/i);
        if (m) dqScores.push(parseInt(m[1]));
      }

      // Blind spots
      if (e.fields["blind spots"]) {
        blindSpots.push(e.fields["blind spots"]);
      }

      // Growth edges
      if (e.fields["growth edge"]) {
        growthEdges.push(e.fields["growth edge"]);
      }

      // Assumption stats
      const assumptions = e.fields["assumptions"];
      if (assumptions) {
        const cm = assumptions.match(/(\d+)\s*confident/i);
        const um = assumptions.match(/(\d+)\s*uncertain/i);
        const dm = assumptions.match(/(\d+)\s*doubtful/i);
        if (cm) assumptionStats.confident += parseInt(cm[1]);
        if (um) assumptionStats.uncertain += parseInt(um[1]);
        if (dm) assumptionStats.doubtful += parseInt(dm[1]);
      }
    }

    // Find recurring blind spot (most mentioned keyword pattern)
    const blindSpotNudge = findRecurringPattern(blindSpots.concat(growthEdges));

    // DQ trend
    let dqTrend = null;
    if (dqScores.length >= 2) {
      const recent = dqScores.slice(-5);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dir = last > first ? "\u2191" : last < first ? "\u2193" : "\u2192";
      dqTrend = { scores: recent, direction: dir, latest: last };
    }

    const data = {
      totalRuns: entries.length,
      dqTrend,
      blindSpotNudge,
      assumptionStats,
      skills,
    };

    journalCache = { mtime, data };
    return data;
  } catch { return null; }
}

function findRecurringPattern(texts) {
  if (texts.length < 2) return texts[0] || null;

  // Extract meaningful phrases and find the most common theme
  const wordFreq = {};
  const stopWords = new Set([
    "the", "a", "an", "is", "was", "are", "in", "on", "at", "to", "for",
    "of", "with", "that", "this", "you", "your", "and", "or", "but", "not",
    "가", "을", "를", "이", "의", "에", "는", "은", "로", "에서", "와", "과",
    "한", "된", "하는", "있는", "없는", "것", "수", "등", "더", "도",
  ]);

  for (const t of texts) {
    // Split on whitespace and common punctuation
    const words = t.toLowerCase().split(/[\s,;:—\-·]+/).filter(w => w.length > 2 && !stopWords.has(w));
    // Use bigrams for better phrase detection
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + " " + words[i + 1];
      wordFreq[bigram] = (wordFreq[bigram] || 0) + 1;
    }
    for (const w of words) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  }

  // Find most frequent non-trivial pattern
  let best = null;
  let bestCount = 1; // Must appear at least twice
  for (const [word, count] of Object.entries(wordFreq)) {
    if (count > bestCount || (count === bestCount && word.includes(" "))) {
      best = word;
      bestCount = count;
    }
  }

  // Return the full text that contains the best pattern, truncated
  if (best) {
    const source = texts.find(t => t.toLowerCase().includes(best));
    if (source) return truncate(source, 40);
  }
  return truncate(texts[texts.length - 1], 40);
}

function truncate(s, max) {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1) + "\u2026";
}

// ─── Transcript parser — live quality metrics ────────────

function parseTranscriptQuality(transcriptPath) {
  const result = {
    pipelineActive: false,
    currentStage: null,
    assumptions: { confirmed: 0, uncertain: 0, doubtful: 0 },
    pushback: { reframed: false, blindSpotsFound: false, planChanged: false },
    risks: { critical: 0, unspoken: 0 },
    personaNames: [],
    decisionMaker: null,
    projectName: null,
  };

  if (!transcriptPath || !existsSync(transcriptPath)) return result;

  let content;
  try {
    const stat = statSync(transcriptPath);
    const maxBytes = 2 * 1024 * 1024;
    if (stat.size > maxBytes) {
      const fd = openSync(transcriptPath, "r");
      const buffer = Buffer.alloc(maxBytes);
      readSync(fd, buffer, 0, maxBytes, stat.size - maxBytes);
      closeSync(fd);
      content = buffer.toString("utf8");
      const nl = content.indexOf("\n");
      if (nl > 0) content = content.slice(nl + 1);
    } else {
      content = readFileSync(transcriptPath, "utf8");
    }
  } catch { return result; }

  const lines = content.split("\n").filter(Boolean);

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry.message?.content) continue;

    for (const block of entry.message.content) {
      // Detect Argus pipeline
      if (block.type === "tool_use" && block.name === "Skill" && block.input?.skill) {
        const sk = block.input.skill.toLowerCase();
        if (sk.includes("argus")) result.pipelineActive = true;
        for (const s of ["reframe", "recast", "rehearse", "refine"]) {
          if (sk.includes(s)) result.currentStage = s;
        }
      }

      if (block.type !== "text" || typeof block.text !== "string") continue;
      const t = block.text;

      // Detect stage from card headers
      const hm = t.match(/Argus\s*·\s*(Reframe|Recast|Rehearse|Refine)/i);
      if (hm) result.currentStage = hm[1].toLowerCase();

      // Extract decision maker (DM / 판단자)
      if (!result.decisionMaker) {
        const dmm =
          t.match(/판단자\s*[:：]\s*([^\n,·|]{2,30})/i) ||
          t.match(/Decision[\s-]?[Mm]aker\s*[:：]\s*([^\n,·|]{2,30})/i) ||
          t.match(/\bDM\s*[:：]\s*([^\n,·|]{2,30})/i) ||
          t.match(/persona_name["']?\s*:\s*["']([^"'\n]{2,30})/i);
        if (dmm) {
          const raw = dmm[1].trim().split(/[\n·|,]/)[0].trim();
          if (raw.length >= 2) result.decisionMaker = truncate(raw, 25);
        }
      }

      // Extract project name
      if (!result.projectName) {
        const pnm =
          t.match(/프로젝트\s*[:：]\s*([^\n·|]{2,40})/i) ||
          t.match(/Project\s*[:：]\s*([^\n·|]{2,40})/i) ||
          t.match(/\*\*([^*\n]{3,40})\*\*\s*\n.*(?:Argus|Reframe|판단)/i);
        if (pnm) {
          const raw = pnm[1].trim().split(/[\n·|]/)[0].trim();
          if (raw.length >= 2) result.projectName = truncate(raw, 35);
        }
      }

      // Count assumption evaluations (from reframe cards and tables)
      const confMatches = (t.match(/✓/g) || []).length;
      const uncMatches = (t.match(/\?/g) || []).length;
      const doubMatches = (t.match(/✗/g) || []).length;

      // Only count in assumption context (near "Assumption" or "가정")
      if (t.includes("ssumption") || t.includes("가정") || t.includes("Confident") || t.includes("Doubtful")) {
        result.assumptions.confirmed += confMatches;
        result.assumptions.uncertain += uncMatches;
        result.assumptions.doubtful += doubMatches;
      }

      // Anti-sycophancy pushback signals
      if (t.includes("✓ Initial framing challenged") || t.includes("✓ 초기 프레이밍")) {
        result.pushback.reframed = true;
      }
      if (t.includes("blind spot") || t.includes("맹점") || t.includes("🔇")) {
        result.pushback.blindSpotsFound = true;
      }
      if (t.includes("✓ Plan revised") || t.includes("✓ 계획 수정") || t.includes("Changes") || t.includes("변경")) {
        if (t.includes("→")) result.pushback.planChanged = true;
      }

      // Count risks
      if (t.includes("critical") || t.includes("치명")) {
        const rm = t.match(/(\d+)\s*(?:critical|치명)/i);
        if (rm) result.risks.critical = Math.max(result.risks.critical, parseInt(rm[1]));
      }
      if (t.includes("unspoken") || t.includes("🔇")) {
        const um = t.match(/(\d+)\s*(?:unspoken|암묵)/i);
        if (um) result.risks.unspoken = Math.max(result.risks.unspoken, parseInt(um[1]));
      }

      // Extract persona names
      const personaMatch = t.match(/(?:▸|·)\s*(\w[\w\s]{1,15})(?:\s*[—:]|\s*\()/g);
      if (personaMatch && result.currentStage === "rehearse") {
        for (const pm of personaMatch) {
          const name = pm.replace(/[▸·\s—:(]+/g, " ").trim().split(/\s+/)[0];
          if (name.length > 1 && !result.personaNames.includes(name)) {
            result.personaNames.push(name);
          }
        }
      }
    }
  }

  return result;
}

// ─── Git ─────────────────────────────────────────────────

function getGitBranch(cwd) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd, encoding: "utf8", timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch { return null; }
}

// ─── Render ──────────────────────────────────────────────

function bar(pct, w) {
  w = w || 10;
  if (pct == null || isNaN(pct)) pct = 0;
  pct = Math.round(pct);
  const f = Math.min(Math.floor((pct / 100) * w), w);
  const e = w - f;
  const color = pct < 70 ? C.g : pct < 85 ? C.y : C.r;
  return `${color}${"\u2588".repeat(f)}${DIM}${"\u2591".repeat(e)}${R} ${color}${pct}%${R}`;
}

function miniBar(pct, w) {
  w = w || 5;
  if (pct == null) return null;
  pct = Math.round(pct);
  const f = Math.min(Math.floor((pct / 100) * w), w);
  const e = w - f;
  const color = pct < 70 ? C.g : pct < 85 ? C.y : C.r;
  return `${color}${"\u2588".repeat(f)}${DIM}${"\u2591".repeat(e)}${R}${color}${pct}%${R}`;
}

function formatDuration(ms) {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

function estimateExchangesLeft(stdin) {
  const ctx = stdin.context_window;
  if (!ctx) return null;

  const size = ctx.context_window_size || 200000;
  const pct = ctx.used_percentage;
  if (pct == null) return null;

  const usedTokens = (pct / 100) * size;
  const remaining = size - usedTokens;

  // Estimate tokens per exchange from session data
  const cost = stdin.cost;
  if (cost && cost.total_api_duration_ms && usedTokens > 1000) {
    // Rough: each exchange averages ~3000-8000 tokens depending on complexity
    // Use actual session data if available
    const totalInputOutput =
      (ctx.current_usage?.input_tokens || 0) +
      (ctx.current_usage?.output_tokens || 0);
    // Assume this represents roughly N exchanges based on duration
    const durationMin = (cost.total_duration_ms || 60000) / 60000;
    const tokensPerMin = totalInputOutput / Math.max(durationMin, 1);
    const estimatedPerExchange = Math.max(tokensPerMin * 2, 4000); // At least 4k per exchange
    return Math.floor(remaining / estimatedPerExchange);
  }

  // Fallback: assume ~5000 tokens per exchange
  return Math.floor(remaining / 5000);
}

// ─── Main ────────────────────────────────────────────────

function main() {
  const stdin = readStdin();
  if (!stdin) { process.stdout.write("Argus"); return; }

  const out = [];
  const cwd = stdin.cwd || stdin.workspace?.current_dir || ".";
  const model = stdin.model?.display_name || "Claude";
  const branch = getGitBranch(cwd);

  // ═══ LINE 1: Model │ Context forecast │ Cost │ Duration ═══

  const ctxPct = stdin.context_window?.used_percentage ?? 0;
  const exchLeft = estimateExchangesLeft(stdin);
  const cost = stdin.cost?.total_cost_usd;
  const duration = formatDuration(stdin.cost?.total_duration_ms);

  let l1 = `${C.c}${model}${R} ${bar(ctxPct, 8)}`;

  // Context forecast — the genuinely useful part
  if (exchLeft != null) {
    const fColor = exchLeft < 5 ? C.r : exchLeft < 15 ? C.y : C.d;
    l1 += ` ${fColor}~${exchLeft} left${R}`;
  }

  // Session metadata
  const meta = [];
  if (cost != null && cost > 0) meta.push(`${C.d}$${cost.toFixed(2)}${R}`);
  if (duration) meta.push(`${C.d}${duration}${R}`);
  if (branch) meta.push(`${C.m}${branch}${R}`);
  if (meta.length) l1 += ` ${C.d}\u2502${R} ${meta.join(" ")}`;

  // Rate limits (only when meaningful)
  const rl5h = stdin.rate_limits?.five_hour?.used_percentage;
  if (rl5h != null && rl5h > 30) {
    l1 += ` ${C.d}5h${R}${miniBar(rl5h, 4)}`;
  }

  out.push(l1);

  // ═══ LINE 2: Decision intelligence (from journal) ═══

  const journal = parseJournal(cwd);
  if (journal && journal.totalRuns >= 1) {
    const parts = [];

    // Decision count
    parts.push(`${C.m}\u266B${R} ${C.c}${journal.totalRuns}${R}${C.d} decisions${R}`);

    // DQ trend (if available)
    if (journal.dqTrend) {
      const t = journal.dqTrend;
      const tColor = t.direction === "\u2191" ? C.g : t.direction === "\u2193" ? C.r : C.y;
      const scoreStr = t.scores.join("\u2192");
      parts.push(`${C.d}DQ${R} ${tColor}${scoreStr}${t.direction}${R}`);
    }

    // Assumption tendency (overconfident? overthinking?)
    const as = journal.assumptionStats;
    const total = as.confident + as.uncertain + as.doubtful;
    if (total >= 6) {
      const confPct = Math.round((as.confident / total) * 100);
      if (confPct > 70) {
        parts.push(`${C.y}\u26A0 ${confPct}% confident${R}`);
      } else if (as.doubtful > as.confident) {
        parts.push(`${C.y}\u26A0 cautious pattern${R}`);
      }
    }

    // Blind spot nudge — the most valuable part
    if (journal.blindSpotNudge) {
      parts.push(`${C.d}Watch:${R} ${C.y}${journal.blindSpotNudge}${R}`);
    }

    out.push(parts.join(` ${C.d}\u2502${R} `));
  }

  // ═══ LINE 3: Live quality metrics (during pipeline only) ═══

  const q = parseTranscriptQuality(stdin.transcript_path);

  // Project name: prefer session_name from stdin, fall back to transcript parse
  const sessionName = stdin.session_name || q.projectName || null;

  if (q.pipelineActive || q.currentStage || sessionName) {
    const parts = [];

    // Project / session name — anchors the user in the right decision context
    if (sessionName) {
      parts.push(`${C.w}${BOLD}${sessionName}${R}`);
    }

    // Current stage indicator
    if (q.currentStage) {
      const stageLabel = {
        reframe: "Reframe",
        recast: "Recast",
        rehearse: "Rehearse",
        refine: "Refine",
      };
      const stageColor = {
        reframe: C.b,
        recast: C.c,
        rehearse: C.m,
        refine: C.g,
      };
      const sc = stageColor[q.currentStage] || C.c;
      parts.push(`${sc}${stageLabel[q.currentStage] || q.currentStage}${R}`);
    }

    // Decision maker
    if (q.decisionMaker) {
      parts.push(`${C.d}DM:${R} ${C.y}${q.decisionMaker}${R}`);
    }

    // Assumption pattern label (confirmed / mixed / doubtful)
    const ac = q.assumptions;
    const acTotal = ac.confirmed + ac.uncertain + ac.doubtful;
    if (acTotal > 0) {
      let patternLabel, patternColor;
      const confPct = ac.confirmed / acTotal;
      const doubtPct = ac.doubtful / acTotal;
      if (doubtPct > 0.4) {
        patternLabel = "doubtful";
        patternColor = C.r;
      } else if (confPct > 0.6) {
        patternLabel = "confirmed";
        patternColor = C.g;
      } else {
        patternLabel = "mixed";
        patternColor = C.y;
      }
      parts.push(`${C.g}${ac.confirmed}\u2713${R}${C.y}${ac.uncertain}?${R}${C.r}${ac.doubtful}\u2717${R} ${patternColor}(${patternLabel})${R}`);
    }

    // Anti-sycophancy pushback score
    const pb = q.pushback;
    const pbCount = (pb.reframed ? 1 : 0) + (pb.blindSpotsFound ? 1 : 0) + (pb.planChanged ? 1 : 0);
    if (pbCount > 0 || q.currentStage === "refine") {
      const pbColor = pbCount >= 2 ? C.g : pbCount === 1 ? C.y : C.r;
      parts.push(`${C.d}Pushback${R} ${pbColor}${pbCount}/3${R}`);
    }

    // Risks found
    if (q.risks.critical > 0 || q.risks.unspoken > 0) {
      const rParts = [];
      if (q.risks.critical > 0) rParts.push(`${C.r}${q.risks.critical} critical${R}`);
      if (q.risks.unspoken > 0) rParts.push(`${C.y}${q.risks.unspoken} unspoken${R}`);
      parts.push(rParts.join(" "));
    }

    if (parts.length > 0) {
      out.push(parts.join(` ${C.d}\u2502${R} `));
    }
  }

  process.stdout.write(out.join("\n"));
}

main();
