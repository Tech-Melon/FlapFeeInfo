const DEFAULT_API_BASE = "https://flap-fee-info.tech-melon.workers.dev";

const input = document.getElementById("apiBase");
const button = document.getElementById("save");

chrome.storage.sync.get({ flapFeeApiBase: DEFAULT_API_BASE }, (items) => {
  input.value = items.flapFeeApiBase || DEFAULT_API_BASE;
});

button.addEventListener("click", () => {
  chrome.storage.sync.set({ flapFeeApiBase: input.value.trim() || DEFAULT_API_BASE }, () => {
    button.textContent = "已保存";
    setTimeout(() => (button.textContent = "保存"), 1200);
  });
});
