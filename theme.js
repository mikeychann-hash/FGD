/**
 * Theme Switcher Module
 * Handles dark/light theme toggle with smooth transitions
 */
(function() {
  'use strict';

  const THEME_KEY = 'aicraft-theme';
  const THEMES = {
    DARK: 'dark',
    LIGHT: 'light'
  };

  /**
   * Gets current theme from localStorage or system preference
   * @returns {string} Current theme
   */
  function getCurrentTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return THEMES.LIGHT;
    }

    return THEMES.DARK;
  }

  /**
   * Applies theme to document
   * @param {string} theme - Theme to apply
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    // Update toggle button icon if it exists
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = theme === THEMES.DARK
        ? '<span aria-hidden="true">☀️</span> Light Mode'
        : '<span aria-hidden="true">🌙</span> Dark Mode';
    }
  }

  /**
   * Toggles between dark and light theme
   */
  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next);
  }

  /**
   * Initializes theme system
   */
  function initialize() {
    // Apply saved theme immediately to prevent flash
    applyTheme(getCurrentTheme());

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_KEY)) {
          applyTheme(e.matches ? THEMES.LIGHT : THEMES.DARK);
        }
      });
    }

    // Set up toggle button if it exists
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // Initialize immediately (before DOMContentLoaded to prevent flash)
  initialize();

  // Expose toggle function globally
  window.toggleTheme = toggleTheme;

})();
