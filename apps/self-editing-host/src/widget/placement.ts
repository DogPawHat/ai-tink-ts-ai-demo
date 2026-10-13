export type Mode = "floating" | "inline";

const SLOT = "[data-aitink-slot]";
let mode: Mode = "floating";
const listeners = new Set<() => void>();

export const subscribeMode = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getMode = () => mode;

/**
 * Puts the widget's host element in the page's chat slot when there is one, and
 * in the page body when there is not. Moving the element keeps the widget's state.
 */
export function placeWidget(element: HTMLElement): void {
  const slot = document.querySelector(SLOT);
  if (slot) {
    if (element.parentElement !== slot) slot.append(element);
  } else if (element.parentElement !== document.body) {
    // Also covers a slot that React removed, which leaves the element in a detached tree.
    document.body.append(element);
  }
  const next: Mode = slot ? "inline" : "floating";
  element.dataset.mode = next;
  if (next !== mode) {
    mode = next;
    listeners.forEach((listener) => listener());
  }
}

/** Places the widget now and again whenever the site adds, removes, or marks a slot. */
export function keepPlaced(element: HTMLElement): void {
  let queued = false;
  const run = () => {
    queued = false;
    placeWidget(element);
  };
  new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-aitink-slot"],
  });
  placeWidget(element);
}
