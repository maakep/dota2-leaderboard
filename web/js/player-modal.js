/**
 * Player detail modal with rank history chart
 */

const PlayerModal = {
  modal: null,
  chart: null,
  playerHistory: null,
  snapshots: null,
  currentPlayerId: null,

  /**
   * Initialize the modal
   */
  init(playerHistory, snapshots) {
    this.playerHistory = playerHistory;
    this.snapshots = snapshots;
    this.modal = document.getElementById("player-modal");

    // Close button
    document
      .getElementById("modal-close")
      .addEventListener("click", () => this.hide(true));

    // Favorite button
    const favoriteBtn = document.getElementById("modal-favorite-btn");
    if (favoriteBtn) {
      favoriteBtn.addEventListener("click", () => this.toggleFavorite());
    }

    // Click outside to close
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.hide(true);
      }
    });

    // ESC key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.modal.classList.contains("hidden")) {
        this.hide(true);
      }
    });

    // Handle browser back button
    window.addEventListener("popstate", (e) => {
      if (
        !this.modal.classList.contains("hidden") &&
        (!e.state || !e.state.playerModal)
      ) {
        this.hide(false);
      }
    });
  },

  /**
   * Toggle favorite status for current player
   */
  toggleFavorite() {
    if (!this.currentPlayerId) return;

    const isNowFavorite = Favorites.toggle(this.currentPlayerId);
    this.updateFavoriteButton(isNowFavorite);
  },

  /**
   * Update the favorite button state
   */
  updateFavoriteButton(isFavorite) {
    const btn = document.getElementById("modal-favorite-btn");
    if (btn) {
      btn.classList.toggle("active", isFavorite);
      btn.title = isFavorite ? "Remove from favorites" : "Add to favorites";
    }
  },

  /**
   * Show modal for a specific player
   */
  show(playerId) {
    const stats = Stats.getPlayerStats(this.playerHistory, playerId);
    if (!stats) {
      console.error("Player not found:", playerId);
      return;
    }

    // Store current player ID for favorite toggle
    this.currentPlayerId = playerId;

    // Update favorite button state
    this.updateFavoriteButton(Favorites.isFavorite(playerId));

    // Push history state so back button closes modal
    history.pushState({ playerModal: true, playerId }, "");

    // Update modal content with team prefix and flag
    const nameEl = document.getElementById("modal-player-name");
    const teamEl = document.getElementById("modal-player-team");
    const flagUrl = Stats.getFlagUrl(stats.country);

    // Build name with team prefix (Team.Name format)
    const teamPrefix = stats.team_tag
      ? `<span class="modal-team-prefix">${this.escapeHtml(
          stats.team_tag,
        )}.</span>`
      : "";
    const flagHtml = flagUrl
      ? `<img class="player-flag modal-flag" src="${flagUrl}" alt="${
          stats.country
        }" title="${
          stats.country?.toUpperCase() || ""
        }" onerror="this.style.display='none'">`
      : "";

    nameEl.innerHTML = `${teamPrefix}${this.escapeHtml(
      stats.name,
    )} ${flagHtml}`;
    teamEl.textContent = ""; // Clear the old team display

    document.getElementById("modal-current-rank").textContent =
      `#${stats.currentRank}`;
    document.getElementById("modal-best-rank").textContent =
      `#${stats.bestRank}`;
    document.getElementById("modal-worst-rank").textContent =
      `#${stats.worstRank}`;

    // Total change with color
    const totalChangeEl = document.getElementById("modal-total-change");
    if (stats.totalChange > 0) {
      totalChangeEl.textContent = `+${stats.totalChange}`;
      totalChangeEl.className = "stat-value positive";
    } else if (stats.totalChange < 0) {
      totalChangeEl.textContent = `${stats.totalChange}`;
      totalChangeEl.className = "stat-value negative";
    } else {
      totalChangeEl.textContent = "0";
      totalChangeEl.className = "stat-value";
    }

    // Render chart
    this.renderChart(stats);

    // Render team history
    this.renderTeamHistory(playerId);

    // Show modal
    this.modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  /**
   * Render team history section
   */
  renderTeamHistory(playerId) {
    const container = document.getElementById("modal-team-history");
    const list = document.getElementById("modal-team-history-list");

    if (!this.snapshots) {
      container.classList.add("hidden");
      return;
    }

    const teamHistory = Stats.getPlayerTeamHistory(this.snapshots, playerId);

    // Only show if there's been at least one team change (more than 1 entry)
    if (teamHistory.length <= 1) {
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");

    // Render list in reverse chronological order (most recent first)
    list.innerHTML = teamHistory
      .slice()
      .reverse()
      .map((entry, index, arr) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const teamName = entry.team
          ? `<span class="team-name">${this.escapeHtml(entry.team)}</span>`
          : `<span class="no-team">No Team</span>`;

        // Show arrow for changes (not for the most recent/first entry)
        const isFirst = index === 0;
        const prevEntry = arr[index - 1];

        if (isFirst) {
          return `<li class="team-history-item current">
            <span class="team-date">${dateStr}</span>
            ${teamName}
            <span class="current-label">(current)</span>
          </li>`;
        }

        return `<li class="team-history-item">
          <span class="team-date">${dateStr}</span>
          ${teamName}
        </li>`;
      })
      .join("");
  },

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Hide the modal
   * @param {boolean} updateHistory - Whether to go back in history
   */
  hide(updateHistory = false) {
    if (this.modal.classList.contains("hidden")) return;

    this.modal.classList.add("hidden");
    document.body.style.overflow = "";

    // Go back in history if closed by user action (not by popstate)
    if (updateHistory && history.state && history.state.playerModal) {
      history.back();
    }

    // Destroy chart to free memory
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  },

  /**
   * Render the rank history chart
   */
  renderChart(stats) {
    const ctx = document.getElementById("player-chart").getContext("2d");

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Format timestamps for labels
    const labels = stats.timestamps.map((ts) => {
      const date = new Date(ts);
      return date.toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    });

    this.chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Rank",
            data: stats.ranks,
            borderColor: "#e94560",
            backgroundColor: "rgba(233, 69, 96, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: stats.ranks.length > 50 ? 0 : 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "#16213e",
            titleColor: "#eaeaea",
            bodyColor: "#eaeaea",
            borderColor: "#2a2a4a",
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: function (context) {
                return context[0].label;
              },
              label: function (context) {
                return `Rank: #${context.raw}`;
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#a0a0a0",
              maxTicksLimit: 6,
              maxRotation: 0,
            },
          },
          y: {
            display: true,
            reverse: true, // Lower rank (1) at top
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#a0a0a0",
              callback: function (value) {
                return "#" + value;
              },
            },
            title: {
              display: true,
              text: "Rank",
              color: "#a0a0a0",
            },
          },
        },
      },
    });
  },
};

// Export for use in other modules
window.PlayerModal = PlayerModal;
