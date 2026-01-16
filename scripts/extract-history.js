#!/usr/bin/env node

/**
 * Extract leaderboard history from git commits
 * Outputs a consolidated history.json file for the web app
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  MAX_DAYS: 140, // How many days of history to include
  MAX_SNAPSHOTS: 3360, // Maximum snapshots (140 days * 24 hours)
  LEADERBOARD_FILE: "leaderboard/europe.json",
  OUTPUT_PATH: "web/data/history.json",
};

/**
 * Execute a git command and return the output
 */
function git(command) {
  try {
    return execSync(`git ${command}`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    console.error(`Git command failed: git ${command}`);
    console.error(error.message);
    return null;
  }
}

/**
 * Get all commits that modified the leaderboard file
 */
function getLeaderboardCommits() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.MAX_DAYS);
  const since = cutoffDate.toISOString().split("T")[0];

  // Get commits with hash, date, and message
  const log = git(
    `log --since="${since}" --format="%H|%aI|%s" -- "${CONFIG.LEADERBOARD_FILE}"`
  );

  if (!log) return [];

  const commits = log
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...messageParts] = line.split("|");
      const message = messageParts.join("|");

      // Try to parse timestamp from commit message (format: "update Europe leaderboard data - 2026-01-16 11:31 UTC")
      let timestamp = date;
      const match = message.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*UTC/);
      if (match) {
        timestamp = new Date(match[1] + " UTC").toISOString();
      }

      return {
        hash,
        timestamp,
        message,
      };
    });

  return commits;
}

/**
 * Get the leaderboard content at a specific commit
 */
function getLeaderboardAtCommit(commitHash) {
  const content = git(`show ${commitHash}:"${CONFIG.LEADERBOARD_FILE}"`);
  if (!content) return null;

  try {
    let players = JSON.parse(content);

    // Skip empty snapshots
    if (!players || players.length === 0) {
      console.log(`  Skipping empty snapshot at ${commitHash}`);
      return null;
    }

    // Crop to top 500 players (old format had 5000+)
    if (players.length > 500) {
      players = players.slice(0, 500);
    }

    // Only keep necessary fields to reduce file size
    // ID uses name|country only (not team) so team changes don't split history
    return players.map((p) => ({
      id: `${p.name}|${p.country || ""}`,
      rank: p.rank,
      name: p.name,
      team_tag: p.team_tag || null,
      team_id: p.team_id || null,
      country: p.country || null,
    }));
  } catch (error) {
    console.error(`Failed to parse JSON at commit ${commitHash}`);
    return null;
  }
}

/**
 * Sample commits if there are too many
 */
function sampleCommits(commits) {
  if (commits.length <= CONFIG.MAX_SNAPSHOTS) {
    return commits;
  }

  console.log(
    `Sampling ${CONFIG.MAX_SNAPSHOTS} commits from ${commits.length} total`
  );

  const sampled = [];
  const step = commits.length / CONFIG.MAX_SNAPSHOTS;

  for (let i = 0; i < CONFIG.MAX_SNAPSHOTS; i++) {
    const index = Math.floor(i * step);
    sampled.push(commits[index]);
  }

  // Always include the most recent commit
  if (sampled[sampled.length - 1] !== commits[0]) {
    sampled[sampled.length - 1] = commits[0];
  }

  return sampled;
}

/**
 * Main extraction function
 */
async function extractHistory() {
  console.log("🔍 Finding leaderboard commits...");

  let commits = getLeaderboardCommits();
  console.log(
    `Found ${commits.length} commits in the last ${CONFIG.MAX_DAYS} days`
  );

  if (commits.length === 0) {
    console.error("No commits found!");
    process.exit(1);
  }

  // Sample if too many commits
  commits = sampleCommits(commits);

  console.log("📦 Extracting snapshots...");

  const snapshots = [];
  let processed = 0;

  // Process commits from oldest to newest
  for (const commit of commits.reverse()) {
    const players = getLeaderboardAtCommit(commit.hash);

    if (players) {
      snapshots.push({
        timestamp: commit.timestamp,
        commitHash: commit.hash.substring(0, 7),
        players,
      });
    }

    processed++;
    if (processed % 10 === 0) {
      console.log(`  Processed ${processed}/${commits.length} commits`);
    }
  }

  console.log(`✅ Extracted ${snapshots.length} valid snapshots`);

  // Build output
  const output = {
    snapshots,
    meta: {
      generatedAt: new Date().toISOString(),
      totalSnapshots: snapshots.length,
      dateRange: {
        from: snapshots[0]?.timestamp,
        to: snapshots[snapshots.length - 1]?.timestamp,
      },
    },
  };

  // Ensure output directory exists
  const outputDir = path.dirname(CONFIG.OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(CONFIG.OUTPUT_PATH, JSON.stringify(output));

  const fileSizeKB = (fs.statSync(CONFIG.OUTPUT_PATH).size / 1024).toFixed(1);
  console.log(`💾 Written to ${CONFIG.OUTPUT_PATH} (${fileSizeKB} KB)`);
}

// Run
extractHistory().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
