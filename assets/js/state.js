// State global aplikasi
export const state = {
  user: null,
  rerender: () => {},
  urls: [],
  period: null,
};

export const can = (...roles) => roles.includes(state.user?.role);

export function trackUrl(u) {
  state.urls.push(u);
  return u;
}
export function releaseUrls() {
  state.urls.forEach((u) => URL.revokeObjectURL(u));
  state.urls = [];
}
