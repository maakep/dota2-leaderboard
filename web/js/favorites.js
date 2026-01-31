/**
 * Favorites management module
 * Handles storing and retrieving favorite players from localStorage
 */

const Favorites = {
  STORAGE_KEY: "dota-leaderboard-favorites",
  favorites: new Set(),
  onChangeCallbacks: [],

  /**
   * Initialize favorites from localStorage
   */
  init() {
    this.loadFromStorage();
  },

  /**
   * Load favorites from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.favorites = new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error("Failed to load favorites from localStorage:", e);
      this.favorites = new Set();
    }
  },

  /**
   * Save favorites to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify([...this.favorites]),
      );
    } catch (e) {
      console.error("Failed to save favorites to localStorage:", e);
    }
  },

  /**
   * Check if a player is a favorite
   * @param {string} playerId - The player ID
   * @returns {boolean}
   */
  isFavorite(playerId) {
    return this.favorites.has(playerId);
  },

  /**
   * Toggle favorite status for a player
   * @param {string} playerId - The player ID
   * @returns {boolean} - New favorite status
   */
  toggle(playerId) {
    const wasFavorite = this.favorites.has(playerId);
    if (wasFavorite) {
      this.favorites.delete(playerId);
    } else {
      this.favorites.add(playerId);
    }
    this.saveToStorage();
    this.notifyChange();

    // Track favorite toggle in GA
    if (typeof gtag === "function") {
      gtag("event", wasFavorite ? "player_unfavorite" : "player_favorite", {
        event_category: "engagement",
        event_label: playerId,
      });
    }

    return this.favorites.has(playerId);
  },

  /**
   * Add a player to favorites
   * @param {string} playerId - The player ID
   */
  add(playerId) {
    if (!this.favorites.has(playerId)) {
      this.favorites.add(playerId);
      this.saveToStorage();
      this.notifyChange();
    }
  },

  /**
   * Remove a player from favorites
   * @param {string} playerId - The player ID
   */
  remove(playerId) {
    if (this.favorites.has(playerId)) {
      this.favorites.delete(playerId);
      this.saveToStorage();
      this.notifyChange();
    }
  },

  /**
   * Get all favorite player IDs
   * @returns {string[]}
   */
  getAll() {
    return [...this.favorites];
  },

  /**
   * Get count of favorites
   * @returns {number}
   */
  count() {
    return this.favorites.size;
  },

  /**
   * Register a callback for when favorites change
   * @param {Function} callback
   */
  onChange(callback) {
    this.onChangeCallbacks.push(callback);
  },

  /**
   * Notify all callbacks that favorites changed
   */
  notifyChange() {
    this.onChangeCallbacks.forEach((cb) => cb());
  },

  /**
   * Create a star element for favorite toggling
   * @param {string} playerId - The player ID
   * @param {string} size - Size class ('small' or 'large')
   * @returns {HTMLElement}
   */
  createStarElement(playerId, size = "small") {
    const star = document.createElement("span");
    star.className = `favorite-star ${size} ${this.isFavorite(playerId) ? "active" : ""}`;
    star.innerHTML = "★";
    star.title = this.isFavorite(playerId)
      ? "Remove from favorites"
      : "Add to favorites";

    star.addEventListener("click", (e) => {
      e.stopPropagation();
      const isNowFavorite = this.toggle(playerId);
      star.classList.toggle("active", isNowFavorite);
      star.title = isNowFavorite ? "Remove from favorites" : "Add to favorites";
    });

    return star;
  },

  /**
   * Get HTML string for a favorite star (non-interactive, for display only)
   * @param {string} playerId - The player ID
   * @returns {string}
   */
  getStarHtml(playerId) {
    if (!this.isFavorite(playerId)) return "";
    return '<span class="favorite-star small active display-only">★</span>';
  },
};

// Export for use in other modules
window.Favorites = Favorites;
