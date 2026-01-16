/**
 * Leaderboard display and animation module
 */

const Leaderboard = {
  container: null,
  currentPlayers: [],
  previousSnapshot: null,

  /**
   * Initialize the leaderboard
   */
  init() {
    this.container = document.getElementById("leaderboard");
  },

  /**
   * Render the leaderboard for a given snapshot
   * @param {Object} snapshot - The snapshot to render
   * @param {Object} previousSnapshot - The previous snapshot for comparison
   * @param {boolean} animate - Whether to animate changes
   */
  render(snapshot, previousSnapshot = null, animate = true) {
    const players = snapshot.players;

    // Build a map of previous ranks for comparison
    const prevRanks = {};
    if (previousSnapshot) {
      for (const player of previousSnapshot.players) {
        prevRanks[player.name] = player.rank;
      }
    }

    // If we have existing rows and should animate, do a smooth transition
    if (animate && this.currentPlayers.length > 0 && previousSnapshot) {
      this.animateTransition(players, prevRanks);
    } else {
      this.renderFull(players, prevRanks);
    }

    this.currentPlayers = players;
    this.previousSnapshot = snapshot;
  },

  /**
   * Full render (no animation)
   */
  renderFull(players, prevRanks) {
    this.container.innerHTML = "";

    for (const player of players) {
      const row = this.createRow(player, prevRanks[player.name]);
      this.container.appendChild(row);
    }
  },

  /**
   * Animate transition between snapshots
   */
  animateTransition(newPlayers, prevRanks) {
    // Create a map of new positions
    const newPositions = {};
    for (let i = 0; i < newPlayers.length; i++) {
      newPositions[newPlayers[i].name] = i;
    }

    // Create a map of old positions
    const oldPositions = {};
    for (let i = 0; i < this.currentPlayers.length; i++) {
      oldPositions[this.currentPlayers[i].name] = i;
    }

    // Update existing rows and add new ones
    const existingRows = {};
    for (const row of this.container.children) {
      const name = row.dataset.playerName;
      existingRows[name] = row;
    }

    // First pass: update positions and content of existing rows
    for (const player of newPlayers) {
      const existingRow = existingRows[player.name];
      const newPosition = newPositions[player.name];
      const oldPosition = oldPositions[player.name];

      if (existingRow) {
        // Update content
        this.updateRowContent(existingRow, player, prevRanks[player.name]);

        // Animate position change
        if (oldPosition !== undefined && oldPosition !== newPosition) {
          const rowHeight = 40; // var(--row-height)
          const deltaY = (oldPosition - newPosition) * rowHeight;

          // Start from old position
          existingRow.style.transform = `translateY(${deltaY}px)`;
          existingRow.style.transition = "none";

          // Force reflow
          existingRow.offsetHeight;

          // Animate to new position
          existingRow.style.transition = "transform 0.3s ease-out";
          existingRow.style.transform = "translateY(0)";

          // Add flash animation
          if (newPosition < oldPosition) {
            existingRow.classList.add("animate-up");
          } else {
            existingRow.classList.add("animate-down");
          }

          // Remove animation class after it completes
          setTimeout(() => {
            existingRow.classList.remove("animate-up", "animate-down");
          }, 500);
        }
      }
    }

    // Rebuild the DOM in the correct order
    const fragment = document.createDocumentFragment();

    for (const player of newPlayers) {
      let row = existingRows[player.name];

      if (!row) {
        // Create new row for new players
        row = this.createRow(player, prevRanks[player.name]);
        row.classList.add("animate-up");
        setTimeout(() => row.classList.remove("animate-up"), 500);
      }

      fragment.appendChild(row);
    }

    this.container.innerHTML = "";
    this.container.appendChild(fragment);
  },

  /**
   * Create a leaderboard row element
   */
  createRow(player, prevRank) {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    const playerId = Stats.getPlayerId(player);
    row.dataset.playerId = playerId;

    // Rank styling
    let rankClass = "";
    if (player.rank === 1) rankClass = "top-1";
    else if (player.rank <= 3) rankClass = "top-3";
    else if (player.rank <= 10) rankClass = "top-10";

    // Change indicator
    const change = this.getChangeDisplay(player.rank, prevRank);

    // Flag image
    const flagUrl = Stats.getFlagUrl(player.country);
    const flagHtml = flagUrl
      ? `<img class="player-flag" src="${flagUrl}" alt="${
          player.country
        }" title="${
          player.country?.toUpperCase() || ""
        }" onerror="this.style.display='none'">`
      : "";

    row.innerHTML = `
      <span class="rank ${rankClass}">${player.rank}</span>
      <span class="change ${change.class}">${change.text}</span>
      <span class="team">${player.team_tag || ""}</span>
      <span class="name">${this.escapeHtml(player.name)}</span>
      <span class="flag">${flagHtml}</span>
      <span class="chevron">›</span>
    `;

    // Click handler
    row.addEventListener("click", () => {
      if (window.PlayerModal) {
        window.PlayerModal.show(playerId);
      }
    });

    return row;
  },

  /**
   * Update an existing row's content
   */
  updateRowContent(row, player, prevRank) {
    const rankEl = row.querySelector(".rank");
    const changeEl = row.querySelector(".change");
    const nameEl = row.querySelector(".name");
    const teamEl = row.querySelector(".team");

    // Update rank
    rankEl.textContent = player.rank;
    rankEl.className = "rank";
    if (player.rank === 1) rankEl.classList.add("top-1");
    else if (player.rank <= 3) rankEl.classList.add("top-3");
    else if (player.rank <= 10) rankEl.classList.add("top-10");

    // Update change
    const change = this.getChangeDisplay(player.rank, prevRank);
    changeEl.textContent = change.text;
    changeEl.className = `change ${change.class}`;

    // Update name and team
    const flagUrl = Stats.getFlagUrl(player.country);
    const flagHtml = flagUrl
      ? `<img class="player-flag" src="${flagUrl}" alt="${
          player.country
        }" title="${
          player.country?.toUpperCase() || ""
        }" onerror="this.style.display='none'">`
      : "";
    nameEl.textContent = player.name;
    teamEl.textContent = player.team_tag || "";

    // Update flag
    const flagEl = row.querySelector(".flag");
    if (flagEl) flagEl.innerHTML = flagHtml;
  },

  /**
   * Get change display text and class
   */
  getChangeDisplay(currentRank, prevRank) {
    if (prevRank === undefined || prevRank === null) {
      return { text: "NEW", class: "up" };
    }

    const diff = prevRank - currentRank;

    if (diff > 0) {
      return { text: `↑${diff}`, class: "up" };
    } else if (diff < 0) {
      return { text: `↓${Math.abs(diff)}`, class: "down" };
    } else {
      return { text: "-", class: "same" };
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};

// Export for use in other modules
window.Leaderboard = Leaderboard;
