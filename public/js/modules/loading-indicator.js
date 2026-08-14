export function showLoading(region, message, { spinnerClass = "" } = {}) {
  region.replaceChildren();

  const spinner = region.ownerDocument.createElement("span");
  spinner.className = ["spinner-border", "loading-spinner", spinnerClass].filter(Boolean).join(" ");
  spinner.setAttribute("aria-hidden", "true");

  const text = region.ownerDocument.createElement("span");
  text.textContent = message;
  region.append(spinner, text);
}
