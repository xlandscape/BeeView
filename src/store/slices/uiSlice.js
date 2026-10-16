import { createSlice, createSelector } from '@reduxjs/toolkit';

/**
 * Layout state of the map-first UI: the translucent top bar and the three docked
 * drawers (layers left, histograms right, charts bottom) that render above the map.
 * Persisted in localStorage under STORAGE_KEY; bump the key when defaults change.
 */
export const STORAGE_KEY = 'beeview.ui.v1';

export const DRAWER_LIMITS = {
  left: { min: 180, max: 520, default: 260 },
  right: { min: 280, max: 760, default: 380 },
  bottom: { min: 180, max: 900, default: 340 },
};

export const COLLAPSED_BOTTOM = 32; // header strip with tabs + day slider stays visible
export const SIM_PANEL_WIDTH = 360;
export const DEFAULT_HEADER_HEIGHT = 52;

export const CHART_TABS = ['nectar-pollen', 'bee-population', 'exposure', 'compare'];

const defaultState = () => ({
  header: { open: true, height: DEFAULT_HEADER_HEIGHT },
  drawers: {
    left: { open: true, size: DRAWER_LIMITS.left.default },
    right: { open: true, size: DRAWER_LIMITS.right.default },
    bottom: { open: true, size: DRAWER_LIMITS.bottom.default },
  },
  chartTab: 'nectar-pollen',
});

const viewportMax = (side) => {
  if (typeof window === 'undefined') return DRAWER_LIMITS[side].max;
  const cap = side === 'bottom' ? window.innerHeight * 0.75 : window.innerWidth * (side === 'right' ? 0.6 : 0.5);
  return Math.min(DRAWER_LIMITS[side].max, Math.floor(cap));
};

export const clampSize = (side, size) => {
  const n = Number(size);
  if (!Number.isFinite(n)) return DRAWER_LIMITS[side].default;
  return Math.max(DRAWER_LIMITS[side].min, Math.min(viewportMax(side), Math.round(n)));
};

/** Defaults merged with whatever is stored; invalid or unknown values are ignored. */
export function loadUiState() {
  const state = defaultState();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return state;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      if (saved.header && typeof saved.header.open === 'boolean') state.header.open = saved.header.open;
      Object.keys(state.drawers).forEach((side) => {
        const d = saved.drawers && saved.drawers[side];
        if (!d) return;
        if (typeof d.open === 'boolean') state.drawers[side].open = d.open;
        if (d.size !== undefined) state.drawers[side].size = clampSize(side, d.size);
      });
      if (CHART_TABS.includes(saved.chartTab)) state.chartTab = saved.chartTab;
    }
  } catch {
    // corrupt JSON or no storage: defaults
  }
  return state;
}

/** Only the user-controlled parts are stored; the measured header height is not. */
export function saveUiState(ui) {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      header: { open: ui.header.open },
      drawers: Object.fromEntries(
        Object.entries(ui.drawers).map(([side, d]) => [side, { open: d.open, size: d.size }])
      ),
      chartTab: ui.chartTab,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // storage full or blocked: ignore
  }
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: loadUiState(),
  reducers: {
    toggleDrawer(state, action) {
      const d = state.drawers[action.payload];
      if (d) d.open = !d.open;
    },
    setDrawerOpen(state, action) {
      const { side, open } = action.payload;
      if (state.drawers[side]) state.drawers[side].open = Boolean(open);
    },
    setDrawerSize(state, action) {
      const { side, size } = action.payload;
      if (state.drawers[side]) state.drawers[side].size = clampSize(side, size);
    },
    toggleHeader(state) {
      state.header.open = !state.header.open;
    },
    setHeaderHeight(state, action) {
      const h = Math.round(Number(action.payload));
      if (Number.isFinite(h) && h > 0 && h !== state.header.height) state.header.height = h;
    },
    setChartTab(state, action) {
      if (CHART_TABS.includes(action.payload)) {
        state.chartTab = action.payload;
        state.drawers.bottom.open = true;
      }
    },
    resetLayout() {
      return defaultState();
    },
  },
});

export const {
  toggleDrawer,
  setDrawerOpen,
  setDrawerSize,
  toggleHeader,
  setHeaderHeight,
  setChartTab,
  resetLayout,
} = uiSlice.actions;

/** Space taken by the overlays on each edge, used to offset map widgets and the bottom drawer. */
export const selectInsets = createSelector(
  [(state) => state.ui, (state) => state.simulation.panelOpen],
  (ui, simPanelOpen) => ({
    top: ui.header.open ? ui.header.height : 0,
    left: ui.drawers.left.open ? ui.drawers.left.size : 0,
    right: simPanelOpen ? SIM_PANEL_WIDTH : (ui.drawers.right.open ? ui.drawers.right.size : 0),
    bottom: ui.drawers.bottom.open ? ui.drawers.bottom.size : COLLAPSED_BOTTOM,
  })
);

export default uiSlice.reducer;
