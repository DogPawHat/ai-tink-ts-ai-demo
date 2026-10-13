import { createRoot } from "react-dom/client";
import { Widget } from "./Widget";
import css from "./style.css?inline";

// A proxy on the Sprite adds this script's tag, with the host, the Sprite name and
// the Sprite's token as data attributes.
const script = document.currentScript as HTMLScriptElement | null;
const { host, sprite, token } = script?.dataset ?? {};

if (host && sprite && token && !document.getElementById("aitink-widget")) {
  const element = document.createElement("div");
  element.id = "aitink-widget";
  // A shadow root keeps the site's CSS out of the widget, and the widget's out of the site.
  const shadow = element.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  document.body.append(element);
  createRoot(mount).render(<Widget host={host} sprite={sprite} token={token} />);
}
