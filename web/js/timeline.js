/**
 * Timeline component for navigating through snapshots
 */

const Timeline = {
  slider: null,
  playBtn: null,
  startLabel: null,
  endLabel: null,
  currentTimeDisplay: null,

  snapshots: [],
  currentIndex: 0,
  isPlaying: false,
  playInterval: null,
  speed: 2, // snapshots per second

  onSnapshotChange: null, // Callback when snapshot changes

  keydownHandler: null, // Store reference to remove listener on re-init
  initialized: false,

  /**
   * Initialize the timeline
   */
  init(snapshots, onSnapshotChange) {
    // Stop any existing playback
    if (this.isPlaying) {
      this.stopPlay();
    }

    this.snapshots = snapshots;
    this.onSnapshotChange = onSnapshotChange;
    this.currentIndex = snapshots.length - 1; // Start at most recent

    // Get DOM elements
    this.slider = document.getElementById("timeline-slider");
    this.playBtn = document.getElementById("play-btn");
    this.startLabel = document.getElementById("timeline-start");
    this.endLabel = document.getElementById("timeline-end");
    this.currentTimeDisplay = document.getElementById("current-time");

    // Configure slider
    this.slider.min = 0;
    this.slider.max = snapshots.length - 1;
    this.slider.value = this.currentIndex;

    // Set labels
    this.startLabel.textContent = this.formatDate(snapshots[0].timestamp);
    this.endLabel.textContent = this.formatDate(
      snapshots[snapshots.length - 1].timestamp,
    );

    // Only add event listeners once
    if (!this.initialized) {
      // Event listeners
      this.slider.addEventListener("input", () => this.onSliderChange());
      this.playBtn.addEventListener("click", () => this.togglePlay());

      // Speed buttons
      document.querySelectorAll(".speed-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".speed-btn")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.speed = parseInt(btn.dataset.speed);

          // Update leaderboard animation speed
          if (window.Leaderboard) {
            Leaderboard.setAnimationSpeed(this.speed);
          }

          // Restart interval if playing
          if (this.isPlaying) {
            this.stopPlay();
            this.startPlay();
          }
        });
      });

      // Keyboard navigation (use arrow function to preserve 'this' binding)
      this.keydownHandler = (e) => this.handleKeydown(e);
      document.addEventListener("keydown", this.keydownHandler);

      this.initialized = true;
    }

    // Initial render
    this.updateTimeDisplay();
  },

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    // Ignore if user is typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.goToPrevious();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.goToNext();
    } else if (e.key === " ") {
      e.preventDefault();
      this.togglePlay();
    }
  },

  /**
   * Go to previous snapshot
   */
  goToPrevious() {
    if (this.currentIndex > 0) {
      this.goToIndex(this.currentIndex - 1);
    }
  },

  /**
   * Go to next snapshot
   */
  goToNext() {
    if (this.currentIndex < this.snapshots.length - 1) {
      this.goToIndex(this.currentIndex + 1);
    }
  },

  /**
   * Handle slider change
   */
  onSliderChange() {
    const newIndex = parseInt(this.slider.value);
    if (newIndex !== this.currentIndex) {
      const previousIndex = this.currentIndex;
      this.currentIndex = newIndex;
      this.updateTimeDisplay();

      if (this.onSnapshotChange) {
        const previousSnapshot =
          previousIndex >= 0 ? this.snapshots[previousIndex] : null;
        this.onSnapshotChange(
          this.snapshots[this.currentIndex],
          previousSnapshot,
        );
      }
    }
  },

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  },

  /**
   * Start auto-play
   */
  startPlay() {
    this.isPlaying = true;
    this.playBtn.textContent = "⏸";
    this.playBtn.classList.add("playing");

    // Scroll leaderboard into view if not sufficiently visible
    // Account for fixed timeline (~100px) plus some buffer
    const leaderboard = document.getElementById("leaderboard-list");
    if (leaderboard) {
      const rect = leaderboard.getBoundingClientRect();
      const buffer = 250; // Pixels of leaderboard that should be visible
      const timelineHeight = 100; // Approximate height of fixed timeline
      const visibleHeight = window.innerHeight - timelineHeight;
      const isVisible =
        rect.top < visibleHeight - buffer && rect.bottom > buffer;
      if (!isVisible) {
        // Scroll with offset to keep header visible
        const headerOffset = 80;
        const elementPosition =
          leaderboard.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementPosition - headerOffset,
          behavior: "smooth",
        });
      }
    }

    const intervalMs = 1000 / this.speed;

    // If at the end, start from beginning
    if (this.currentIndex >= this.snapshots.length - 1) {
      this.currentIndex = 0;
      this.slider.value = 0;
      this.updateTimeDisplay();
      if (this.onSnapshotChange) {
        // Pass null as previous - all players are "new" at the start
        this.onSnapshotChange(this.snapshots[0], null);
      }
      // Delay the interval start to let the initial render complete
      setTimeout(() => {
        if (this.isPlaying) {
          this.startInterval(intervalMs);
        }
      }, intervalMs);
    } else {
      this.startInterval(intervalMs);
    }
  },

  /**
   * Start the playback interval
   */
  startInterval(intervalMs) {
    this.playInterval = setInterval(() => {
      if (this.currentIndex < this.snapshots.length - 1) {
        const previousIndex = this.currentIndex;
        this.currentIndex++;
        this.slider.value = this.currentIndex;
        this.updateTimeDisplay();

        if (this.onSnapshotChange) {
          this.onSnapshotChange(
            this.snapshots[this.currentIndex],
            this.snapshots[previousIndex],
          );
        }
      } else {
        // Reached the end
        this.stopPlay();
      }
    }, intervalMs);
  },

  /**
   * Stop auto-play
   */
  stopPlay() {
    this.isPlaying = false;
    this.playBtn.textContent = "▶";
    this.playBtn.classList.remove("playing");

    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  },

  /**
   * Update the time display
   */
  updateTimeDisplay() {
    const snapshot = this.snapshots[this.currentIndex];
    if (snapshot) {
      this.currentTimeDisplay.textContent = this.formatDateTime(
        snapshot.timestamp,
      );
    }
  },

  /**
   * Format date for labels (short format)
   */
  formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  },

  /**
   * Format date and time for display
   */
  formatDateTime(isoString) {
    const date = new Date(isoString);
    const month = date.toLocaleDateString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    const day = date.getUTCDate();
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    return `${month} ${day} - ${hours}:${minutes} UTC`;
  },

  /**
   * Get current snapshot
   */
  getCurrentSnapshot() {
    return this.snapshots[this.currentIndex];
  },

  /**
   * Get previous snapshot (for comparison)
   */
  getPreviousSnapshot() {
    if (this.currentIndex > 0) {
      return this.snapshots[this.currentIndex - 1];
    }
    return null;
  },

  /**
   * Jump to a specific snapshot index
   */
  goToIndex(index) {
    if (index >= 0 && index < this.snapshots.length) {
      const previousIndex = this.currentIndex;
      this.currentIndex = index;
      this.slider.value = index;
      this.updateTimeDisplay();

      if (this.onSnapshotChange) {
        const previousSnapshot =
          previousIndex >= 0 ? this.snapshots[previousIndex] : null;
        this.onSnapshotChange(this.snapshots[index], previousSnapshot);
      }
    }
  },

  /**
   * Go to the most recent snapshot
   */
  goToLatest() {
    this.goToIndex(this.snapshots.length - 1);
  },
};

// Export for use in other modules
window.Timeline = Timeline;
