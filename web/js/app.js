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

      // Load saved scope preferences
      const savedWinnersScope = localStorage.getItem("winnersScope") || "20";
      const savedLosersScope = localStorage.getItem("losersScope") || "20";
      const savedTimeScope = localStorage.getItem("timeScope") || "1";

      // Set dropdown values from saved preferences
      document.getElementById("winners-scope").value = savedWinnersScope;
      document.getElementById("losers-scope").value = savedLosersScope;
      document.getElementById("time-scope").value = savedTimeScope;
      document.getElementById("time-scope-losers").value = savedTimeScope;

      // Render initial state with saved scopes
      this.renderStats(
        parseInt(savedWinnersScope),
        parseInt(savedLosersScope),
        parseInt(savedTimeScope)
      );
      this.renderInitialLeaderboard();
      this.setupScopeFilters();
      this.setupExpandToggle();

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

    // Filter out empty snapshots (extraction script now crops to 500)
    this.data.snapshots = this.data.snapshots.filter(
      (snapshot) => snapshot.players.length > 0
    );

    if (this.data.snapshots.length === 0) {
      throw new Error("No valid snapshots after filtering");
    }

    console.log(`Loaded ${this.data.snapshots.length} snapshots`);
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

    // Set up filter change callback to re-render winners/losers
    Leaderboard.onFilterChange = () => {
      const winnersScope = parseInt(
        document.getElementById("winners-scope").value
      );
      const losersScope = parseInt(
        document.getElementById("losers-scope").value
      );
      const timeScope = parseInt(document.getElementById("time-scope").value);
      this.renderStats(winnersScope, losersScope, timeScope);
    };

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
  renderStats(winnersScope = 500, losersScope = 500, timeDays = 0) {
    // Check if we should filter to pros only
    const prosOnly = Leaderboard.teamsOnly;

    let winners = Stats.getWinners(
      this.playerHistory,
      prosOnly ? 50 : 5, // Fetch more if filtering
      winnersScope,
      timeDays,
      this.data.snapshots
    );
    let losers = Stats.getLosers(
      this.playerHistory,
      prosOnly ? 50 : 5, // Fetch more if filtering
      losersScope,
      timeDays,
      this.data.snapshots
    );

    // Filter to pros only if enabled
    if (prosOnly) {
      winners = winners
        .filter((p) => p.team_tag && p.team_tag.trim() !== "")
        .slice(0, 5);
      losers = losers
        .filter((p) => p.team_tag && p.team_tag.trim() !== "")
        .slice(0, 5);
    }

    // Render winners
    const winnersList = document.getElementById("winners-list");
    winnersList.innerHTML = winners
      .map(
        (w, i) => `
      <li data-player-id="${this.escapeAttr(w.id)}">
        <span>
          <span class="player-rank-num">${i + 1}.</span>
          ${
            w.team_tag
              ? `<span class="player-team">${this.escapeHtml(
                  w.team_tag
                )}.</span>`
              : ""
          }<span class="player-name">${this.escapeHtml(w.name)}</span>
          ${
            w.country
              ? `<img class="player-flag" src="${Stats.getFlagUrl(
                  w.country
                )}" alt="${
                  w.country
                }" title="${w.country.toUpperCase()}" onerror="this.style.display='none'">`
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
        PlayerModal.show(li.dataset.playerId);
      });
    });

    // Render losers
    const losersList = document.getElementById("losers-list");
    losersList.innerHTML = losers
      .map(
        (l, i) => `
      <li data-player-id="${this.escapeAttr(l.id)}">
        <span>
          <span class="player-rank-num">${i + 1}.</span>
          ${
            l.team_tag
              ? `<span class="player-team">${this.escapeHtml(
                  l.team_tag
                )}.</span>`
              : ""
          }<span class="player-name">${this.escapeHtml(l.name)}</span>
          ${
            l.country
              ? `<img class="player-flag" src="${Stats.getFlagUrl(
                  l.country
                )}" alt="${
                  l.country
                }" title="${l.country.toUpperCase()}" onerror="this.style.display='none'">`
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
        PlayerModal.show(li.dataset.playerId);
      });
    });
  },

  /**
   * Setup scope filter dropdowns
   */
  setupScopeFilters() {
    const winnersSelect = document.getElementById("winners-scope");
    const losersSelect = document.getElementById("losers-scope");
    const timeSelect = document.getElementById("time-scope");
    const timeSelectLosers = document.getElementById("time-scope-losers");

    const getScopes = () => ({
      winners: parseInt(winnersSelect.value),
      losers: parseInt(losersSelect.value),
      time: parseInt(timeSelect.value),
    });

    winnersSelect.addEventListener("change", () => {
      losersSelect.value = winnersSelect.value; // Sync losers dropdown
      const scopes = getScopes();
      localStorage.setItem("winnersScope", winnersSelect.value);
      localStorage.setItem("losersScope", winnersSelect.value);
      this.renderStats(scopes.winners, scopes.losers, scopes.time);
    });

    losersSelect.addEventListener("change", () => {
      winnersSelect.value = losersSelect.value; // Sync winners dropdown
      const scopes = getScopes();
      localStorage.setItem("winnersScope", losersSelect.value);
      localStorage.setItem("losersScope", losersSelect.value);
      this.renderStats(scopes.winners, scopes.losers, scopes.time);
    });

    timeSelect.addEventListener("change", () => {
      timeSelectLosers.value = timeSelect.value; // Sync losers dropdown
      const scopes = getScopes();
      localStorage.setItem("timeScope", timeSelect.value);
      this.renderStats(scopes.winners, scopes.losers, scopes.time);
    });

    timeSelectLosers.addEventListener("change", () => {
      timeSelect.value = timeSelectLosers.value; // Sync winners dropdown
      const scopes = getScopes();
      localStorage.setItem("timeScope", timeSelectLosers.value);
      this.renderStats(scopes.winners, scopes.losers, scopes.time);
    });
  },

  /**
   * Setup expand/compact toggle for leaderboard
   */
  setupExpandToggle() {
    const toggle = document.getElementById("expand-toggle");
    const app = document.querySelector(".app");

    // Always start in expanded mode (showing header and stats)
    toggle.addEventListener("click", () => {
      const isNowCompact = app.classList.toggle("compact");
      toggle.textContent = isNowCompact ? "↙" : "↗";
      toggle.title = isNowCompact
        ? "Show header and stats"
        : "Toggle compact mode";
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
