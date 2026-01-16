/**
 * Stats calculation module
 * Calculates winners, losers, and other interesting statistics
 */

const Stats = {
  /**
   * Build a map of player history across all snapshots
   * Returns: { playerName: [{ timestamp, rank }, ...] }
   */
  buildPlayerHistory(snapshots) {
    const history = {};

    for (const snapshot of snapshots) {
      for (const player of snapshot.players) {
        if (!history[player.name]) {
          history[player.name] = {
            name: player.name,
            team_tag: player.team_tag,
            team_id: player.team_id,
            country: player.country,
            ranks: [],
          };
        }

        history[player.name].ranks.push({
          timestamp: snapshot.timestamp,
          rank: player.rank,
        });

        // Update team info to latest
        if (player.team_tag) {
          history[player.name].team_tag = player.team_tag;
        }
      }
    }

    return history;
  },

  /**
   * Calculate biggest winners (rank improvements)
   * @param {Object} playerHistory - Player history data
   * @param {number} count - Number of results to return
   * @param {number} scope - Only include players whose current rank is within this scope
   */
  getWinners(playerHistory, count = 5, scope = 500) {
    const changes = [];

    for (const [name, data] of Object.entries(playerHistory)) {
      if (data.ranks.length < 2) continue;

      const firstRank = data.ranks[0].rank;
      const lastRank = data.ranks[data.ranks.length - 1].rank;

      // Filter by scope - only include players currently in the scope
      if (lastRank > scope) continue;

      const change = firstRank - lastRank; // Positive = improved (lower rank is better)

      if (change > 0) {
        changes.push({
          name,
          team_tag: data.team_tag,
          firstRank,
          lastRank,
          change,
        });
      }
    }

    return changes.sort((a, b) => b.change - a.change).slice(0, count);
  },

  /**
   * Calculate biggest losers (rank drops)
   * @param {Object} playerHistory - Player history data
   * @param {number} count - Number of results to return
   * @param {number} scope - Only include players whose current rank is within this scope
   */
  getLosers(playerHistory, count = 5, scope = 500) {
    const changes = [];

    for (const [name, data] of Object.entries(playerHistory)) {
      if (data.ranks.length < 2) continue;

      const firstRank = data.ranks[0].rank;
      const lastRank = data.ranks[data.ranks.length - 1].rank;

      // Filter by scope - only include players currently in the scope
      if (lastRank > scope) continue;

      const change = lastRank - firstRank; // Positive = dropped (higher rank is worse)

      if (change > 0) {
        changes.push({
          name,
          team_tag: data.team_tag,
          firstRank,
          lastRank,
          change,
        });
      }
    }

    return changes.sort((a, b) => b.change - a.change).slice(0, count);
  },

  /**
   * Get general statistics
   */
  getGeneralStats(snapshots, playerHistory) {
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];

    const firstPlayers = new Set(firstSnapshot.players.map((p) => p.name));
    const lastPlayers = new Set(lastSnapshot.players.map((p) => p.name));

    // New entries (in last but not in first)
    const newEntries = [...lastPlayers].filter((p) => !firstPlayers.has(p));

    // Dropped out (in first but not in last)
    const droppedOut = [...firstPlayers].filter((p) => !lastPlayers.has(p));

    // Most volatile (biggest total movement)
    const volatility = [];
    for (const [name, data] of Object.entries(playerHistory)) {
      if (data.ranks.length < 2) continue;

      let totalMovement = 0;
      for (let i = 1; i < data.ranks.length; i++) {
        totalMovement += Math.abs(data.ranks[i].rank - data.ranks[i - 1].rank);
      }

      volatility.push({ name, totalMovement, team_tag: data.team_tag });
    }

    const mostVolatile = volatility
      .sort((a, b) => b.totalMovement - a.totalMovement)
      .slice(0, 3);

    return {
      totalSnapshots: snapshots.length,
      newEntries: newEntries.length,
      droppedOut: droppedOut.length,
      mostVolatile,
      dateRange: {
        from: firstSnapshot.timestamp,
        to: lastSnapshot.timestamp,
      },
    };
  },

  /**
   * Get detailed stats for a specific player
   */
  getPlayerStats(playerHistory, playerName) {
    const data = playerHistory[playerName];
    if (!data || data.ranks.length === 0) return null;

    const ranks = data.ranks.map((r) => r.rank);
    const timestamps = data.ranks.map((r) => r.timestamp);

    const currentRank = ranks[ranks.length - 1];
    const bestRank = Math.min(...ranks);
    const worstRank = Math.max(...ranks);
    const avgRank = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length);

    const firstRank = ranks[0];
    const totalChange = firstRank - currentRank; // Positive = improved

    // Find biggest single jump
    let biggestJump = { change: 0, from: 0, to: 0 };
    for (let i = 1; i < ranks.length; i++) {
      const change = Math.abs(ranks[i] - ranks[i - 1]);
      if (change > Math.abs(biggestJump.change)) {
        biggestJump = {
          change: ranks[i - 1] - ranks[i],
          from: ranks[i - 1],
          to: ranks[i],
        };
      }
    }

    return {
      name: playerName,
      team_tag: data.team_tag,
      country: data.country,
      currentRank,
      bestRank,
      worstRank,
      avgRank,
      totalChange,
      biggestJump,
      ranks,
      timestamps,
    };
  },
};

// Export for use in other modules
window.Stats = Stats;
