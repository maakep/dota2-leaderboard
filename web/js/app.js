/**
 * Main application entry point
 * Coordinates all modules and handles data loading
 */

const App = {
  data: null,
  playerHistory: null,

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Load data
      await this.loadData();

      // Initialize modules
      this.initModules();

      // Render initial state
      this.renderStats();
      this.renderInitialLeaderboard();

      // Hide loading, show content
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("main-content").classList.remove("hidden");
    } catch (error) {
      console.error("Failed to initialize app:", error);
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("error").classList.remove("hidden");
    }
  },

  /**
   * Load history data from JSON file
   */
  async loadData() {
    const response = await fetch("data/history.json");
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }

    this.data = await response.json();

    if (!this.data.snapshots || this.data.snapshots.length === 0) {
      throw new Error("No snapshots in data");
    }

    console.log(`Loaded ${this.data.snapshots.length} snapshots`);
    console.log(
      `Date range: ${this.data.meta.dateRange.from} to ${this.data.meta.dateRange.to}`
    );

    // Build player history for stats
    this.playerHistory = Stats.buildPlayerHistory(this.data.snapshots);
  },

  /**
   * Initialize all modules
   */
  initModules() {
    // Initialize leaderboard
    Leaderboard.init();

    // Initialize timeline with callback
    Timeline.init(this.data.snapshots, (snapshot, previousSnapshot) => {
      Leaderboard.render(snapshot, previousSnapshot, true);
    });

    // Initialize player modal
    PlayerModal.init(this.playerHistory);
  },

  /**
   * Render statistics cards
   */
  renderStats() {
    const winners = Stats.getWinners(this.playerHistory);
    const losers = Stats.getLosers(this.playerHistory);
    const generalStats = Stats.getGeneralStats(
      this.data.snapshots,
      this.playerHistory
    );

    // Render winners
    const winnersList = document.getElementById("winners-list");
    winnersList.innerHTML = winners
      .map(
        (w) => `
      <li data-player="${this.escapeAttr(w.name)}">
        <span>
          <span class="player-name">${this.escapeHtml(w.name)}</span>
          ${
            w.team_tag
              ? `<span class="player-team">[${this.escapeHtml(
                  w.team_tag
                )}]</span>`
              : ""
          }
        </span>
        <span class="rank-change positive">+${w.change} (${w.firstRank}→${
          w.lastRank
        })</span>
      </li>
    `
      )
      .join("");

    // Add click handlers for winners
    winnersList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", () => {
        PlayerModal.show(li.dataset.player);
      });
    });

    // Render losers
    const losersList = document.getElementById("losers-list");
    losersList.innerHTML = losers
      .map(
        (l) => `
      <li data-player="${this.escapeAttr(l.name)}">
        <span>
          <span class="player-name">${this.escapeHtml(l.name)}</span>
          ${
            l.team_tag
              ? `<span class="player-team">[${this.escapeHtml(
                  l.team_tag
                )}]</span>`
              : ""
          }
        </span>
        <span class="rank-change negative">-${l.change} (${l.firstRank}→${
          l.lastRank
        })</span>
      </li>
    `
      )
      .join("");

    // Add click handlers for losers
    losersList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", () => {
        PlayerModal.show(li.dataset.player);
      });
    });

    // Render general stats
    const generalStatsEl = document.getElementById("general-stats");
    generalStatsEl.innerHTML = `
      <div class="stat-row">
        <span class="stat-label">Snapshots</span>
        <span class="stat-value">${generalStats.totalSnapshots}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">New to Top 500</span>
        <span class="stat-value">${generalStats.newEntries}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Dropped Out</span>
        <span class="stat-value">${generalStats.droppedOut}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Most Volatile</span>
        <span class="stat-value">${
          generalStats.mostVolatile[0]?.name || "-"
        }</span>
      </div>
    `;
  },

  /**
   * Render initial leaderboard (most recent snapshot)
   */
  renderInitialLeaderboard() {
    const currentSnapshot = Timeline.getCurrentSnapshot();
    const previousSnapshot = Timeline.getPreviousSnapshot();

    Leaderboard.render(currentSnapshot, previousSnapshot, false);
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Escape attribute value
   */
  escapeAttr(text) {
    return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
};

// Start the app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
