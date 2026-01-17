#!/usr/bin/env node

/**
 * Extract leaderboard history from git commits
 *
 * Outputs a history JSON file for each region to web/data/:
 *   - history-americas.json
 *   - history-europe.json
 *   - history-sea.json
 *   - history-china.json
 *
 * These files are loaded by the web app based on the selected region.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  MAX_DAYS: 140, // How many days of history to include
  MAX_SNAPSHOTS: 3360, // Maximum snapshots (140 days * 24 hours)
  REGIONS: [
    { id: "europe", file: "leaderboard/europe.json" },
    { id: "americas", file: "leaderboard/americas.json" },
    { id: "sea", file: "leaderboard/sea.json" },
    { id: "china", file: "leaderboard/china.json" },
  ],
  OUTPUT_DIR: "web/data",
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
 * Get all commits that modified a leaderboard file
 */
function getLeaderboardCommits(leaderboardFile) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.MAX_DAYS);
  const since = cutoffDate.toISOString().split("T")[0];

  // Get commits with hash, date, and message
  const log = git(
    `log --since="${since}" --format="%H|%aI|%s" -- "${leaderboardFile}"`
  );

  if (!log) return [];

  const commits = log
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...messageParts] = line.split("|");
      const message = messageParts.join("|");

      // Try to parse timestamp from commit message (format: "update leaderboard data - 2026-01-16 11:31 UTC")
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
function getLeaderboardAtCommit(commitHash, leaderboardFile) {
  const content = git(`show ${commitHash}:"${leaderboardFile}"`);
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
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // Process each region
  for (const region of CONFIG.REGIONS) {
    console.log(`\n🌍 Processing ${region.id.toUpperCase()} region...`);
    await extractRegionHistory(region);
  }

  console.log("\n✅ All regions processed!");
}

/**
 * Extract history for a single region
 */
async function extractRegionHistory(region) {
  console.log(`🔍 Finding ${region.id} leaderboard commits...`);

  let commits = getLeaderboardCommits(region.file);
  console.log(
    `Found ${commits.length} commits in the last ${CONFIG.MAX_DAYS} days`
  );

  if (commits.length === 0) {
    console.warn(`⚠️ No commits found for ${region.id}, skipping...`);
    return;
  }

  // Sample if too many commits
  commits = sampleCommits(commits);

  console.log("📦 Extracting snapshots...");

  const snapshots = [];
  let processed = 0;

  // Process commits from oldest to newest
  for (const commit of commits.reverse()) {
    const players = getLeaderboardAtCommit(commit.hash, region.file);

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

  console.log(
    `✅ Extracted ${snapshots.length} valid snapshots for ${region.id}`
  );

  if (snapshots.length === 0) {
    console.warn(`⚠️ No valid snapshots for ${region.id}, skipping...`);
    return;
  }

  // Build output
  const output = {
    region: region.id,
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

  // Write output
  const outputPath = path.join(CONFIG.OUTPUT_DIR, `history-${region.id}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output));

  const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`💾 Written to ${outputPath} (${fileSizeKB} KB)`);
}

// Run
extractHistory().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
