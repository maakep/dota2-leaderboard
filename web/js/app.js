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
      this.setupScopeFilters();

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

    // Filter out old snapshots that have more than 500 players (old format)
    this.data.snapshots = this.data.snapshots.filter(
      (snapshot) => snapshot.players.length <= 500
    );

    if (this.data.snapshots.length === 0) {
      throw new Error("No valid snapshots after filtering");
    }

    console.log(
      `Loaded ${this.data.snapshots.length} snapshots (filtered to 500-player format)`
    );
    console.log(
      `Date range: ${this.data.snapshots[0].timestamp} to ${
        this.data.snapshots[this.data.snapshots.length - 1].timestamp
      }`
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
  renderStats(winnersScope = 500, losersScope = 500) {
    const winners = Stats.getWinners(this.playerHistory, 5, winnersScope);
    const losers = Stats.getLosers(this.playerHistory, 5, losersScope);

    // Render winners
    const winnersList = document.getElementById("winners-list");
    winnersList.innerHTML = winners
      .map(
        (w, i) => `
      <li data-player="${this.escapeAttr(w.name)}">
        <span>
          <span class="player-rank-num">${i + 1}.</span>
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
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        PlayerModal.show(li.dataset.player);
      });
    });

    // Render losers
    const losersList = document.getElementById("losers-list");
    losersList.innerHTML = losers
      .map(
        (l, i) => `
      <li data-player="${this.escapeAttr(l.name)}">
        <span>
          <span class="player-rank-num">${i + 1}.</span>
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
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        PlayerModal.show(li.dataset.player);
      });
    });
  },

  /**
   * Setup scope filter dropdowns
   */
  setupScopeFilters() {
    const winnersSelect = document.getElementById("winners-scope");
    const losersSelect = document.getElementById("losers-scope");

    winnersSelect.addEventListener("change", () => {
      const scope = parseInt(winnersSelect.value);
      const losersScope = parseInt(losersSelect.value);
      this.renderStats(scope, losersScope);
    });

    losersSelect.addEventListener("change", () => {
      const winnersScope = parseInt(winnersSelect.value);
      const scope = parseInt(losersSelect.value);
      this.renderStats(winnersScope, scope);
    });
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
