class AppState {
  constructor() {}

  setState(payload) {
    Object.entries(payload).forEach(([key, value]) => {
      this[key] = value;
    });
  }
}

const appState = new AppState();

module.exports = appState;
