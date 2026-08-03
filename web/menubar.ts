/**
 * File / Insert menus for the composer (mirrors the JAR MainWindow menubar at
 * a web-appropriate scope: save/open source text, export score, insert common
 * CMNT directives and gamaka marks at the textarea cursor).
 */

export type MenuAction = {
  label: string;
  /** Keyboard shortcut hint shown in the menu (handler is wired separately). */
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
};

export type MenuItem = MenuAction | { separator: true } | { label: string; submenu: MenuItem[] };

export function buildMenubar(
  root: HTMLElement,
  menus: { label: string; items: MenuItem[] }[],
): void {
  root.innerHTML = "";
  root.classList.add("menubar");

  for (const menu of menus) {
    const wrap = document.createElement("div");
    wrap.className = "menu-root";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu-button";
    btn.textContent = menu.label;
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "menu-panel";
    panel.hidden = true;
    populatePanel(panel, menu.items, () => closeAll(root));

    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const open = !panel.hidden;
      closeAll(root);
      if (!open) {
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        wrap.classList.add("open");
      }
    });

    wrap.append(btn, panel);
    root.appendChild(wrap);
  }

  document.addEventListener("click", () => closeAll(root));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeAll(root);
  });
}

function closeAll(root: HTMLElement): void {
  for (const panel of root.querySelectorAll<HTMLElement>(".menu-panel")) {
    panel.hidden = true;
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>(".menu-button")) {
    btn.setAttribute("aria-expanded", "false");
  }
  for (const wrap of root.querySelectorAll(".menu-root")) {
    wrap.classList.remove("open");
  }
}

function populatePanel(panel: HTMLElement, items: MenuItem[], onPick: () => void): void {
  for (const item of items) {
    if ("separator" in item) {
      const hr = document.createElement("div");
      hr.className = "menu-separator";
      panel.appendChild(hr);
      continue;
    }
    if ("submenu" in item) {
      const row = document.createElement("div");
      row.className = "menu-submenu";
      const label = document.createElement("button");
      label.type = "button";
      label.className = "menu-item menu-item-parent";
      label.innerHTML = `<span>${escapeHtml(item.label)}</span><span class="menu-caret">▸</span>`;
      const sub = document.createElement("div");
      sub.className = "menu-panel menu-panel-sub";
      populatePanel(sub, item.submenu, onPick);
      row.append(label, sub);
      panel.appendChild(row);
      continue;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu-item";
    if (item.disabled) btn.disabled = true;
    btn.innerHTML = `<span>${escapeHtml(item.label)}</span>${
      item.shortcut ? `<span class="menu-shortcut">${escapeHtml(item.shortcut)}</span>` : ""
    }`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onPick();
      item.action?.();
    });
    panel.appendChild(btn);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
