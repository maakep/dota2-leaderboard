/**
 * Player detail modal with rank history chart
 */

const PlayerModal = {
  modal: null,
  chart: null,
  playerHistory: null,

  /**
   * Initialize the modal
   */
  init(playerHistory) {
    this.playerHistory = playerHistory;
    this.modal = document.getElementById("player-modal");

    // Close button
    document
      .getElementById("modal-close")
      .addEventListener("click", () => this.hide());

    // Click outside to close
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // ESC key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.modal.classList.contains("hidden")) {
        this.hide();
      }
    });
  },

  /**
   * Show modal for a specific player
   */
  show(playerName) {
    const stats = Stats.getPlayerStats(this.playerHistory, playerName);
    if (!stats) {
      console.error("Player not found:", playerName);
      return;
    }

    // Update modal content
    document.getElementById("modal-player-name").textContent = stats.name;
    document.getElementById("modal-player-team").textContent = stats.team_tag
      ? `[${stats.team_tag}]`
      : "";
    document.getElementById(
      "modal-current-rank"
    ).textContent = `#${stats.currentRank}`;
    document.getElementById(
      "modal-best-rank"
    ).textContent = `#${stats.bestRank}`;
    document.getElementById(
      "modal-worst-rank"
    ).textContent = `#${stats.worstRank}`;

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

    // Show modal
    this.modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  /**
   * Hide the modal
   */
  hide() {
    this.modal.classList.add("hidden");
    document.body.style.overflow = "";

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
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
