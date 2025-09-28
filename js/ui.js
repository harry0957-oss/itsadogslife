let hideTimeout = null;

export function createUI({ prompt, messagePanel, loadError, musicToggle }) {
  const messageTitle = messagePanel.querySelector("h2");
  const messageBody = messagePanel.querySelector("p");

  function showPrompt(text) {
    prompt.textContent = text;
    prompt.classList.add("visible");
  }

  function hidePrompt() {
    prompt.classList.remove("visible");
    prompt.textContent = "";
  }

  function showMessage({ title, description }, duration = 5000) {
    messageTitle.textContent = title;
    messageBody.textContent = description;
    messagePanel.classList.add("visible");
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => hideMessage(), duration);
  }

  function hideMessage() {
    messagePanel.classList.remove("visible");
    messageTitle.textContent = "";
    messageBody.textContent = "";
    clearTimeout(hideTimeout);
  }

  function showLoadError(message) {
    loadError.textContent = message;
    loadError.classList.add("visible");
  }

  function clearLoadError() {
    loadError.textContent = "";
    loadError.classList.remove("visible");
  }

  function setMusicLabel(isMuted) {
    musicToggle.textContent = isMuted ? "Unmute Music" : "Mute Music";
  }

  function onMusicToggle(callback) {
    musicToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      callback();
    });
  }

  return {
    showPrompt,
    hidePrompt,
    showMessage,
    hideMessage,
    showLoadError,
    clearLoadError,
    setMusicLabel,
    onMusicToggle
  };
}
