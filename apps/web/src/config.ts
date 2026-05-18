/// <reference types="vite/client" />

const config = {
  wsUrl: import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3000`,
  apiUrl: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`,
};

export default config;
