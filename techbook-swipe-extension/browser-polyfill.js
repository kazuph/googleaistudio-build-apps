// Browser API compatibility layer
if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  window.browser = chrome;
}