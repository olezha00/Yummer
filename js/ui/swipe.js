/* ---------- Swipe left on a diary row to reveal its Delete button ----------
   Markup: <div class="swipe"><button class="swipe-del">…</button><button class="item">…</button></div>
   The row (.item) slides left over the Delete button. Vertical scrolling is left to the browser
   (touch-action: pan-y), so only clearly horizontal drags are handled here. */
export const DEL_WIDTH = 88;      // px, width of the Delete button
const SLOP = 8;                   // px a finger may move before we decide between scroll and swipe

/** Where the row ends up: pure, so it is unit-tested. start is 0 (closed) or -DEL_WIDTH (open). */
export function swipeTarget(start, dx) {
  const x = Math.max(-DEL_WIDTH * 1.5, Math.min(0, start + dx));
  return { x, open: x < -DEL_WIDTH / 2 };
}

let openRow = null;               // the .swipe element that is currently open
let drag = null;                  // { row, item, x0, y0, start, horizontal }
let swallowClick = false;         // a drag or a "close" tap must not also open the entry

function place(row, x, animate) {
  const item = row.querySelector(".item");
  item.style.transition = animate ? "" : "none";
  item.style.transform = x ? `translateX(${x}px)` : "";
  row.classList.toggle("open", x < 0);
}
export function closeOpenRow() { if (openRow) { place(openRow, 0, true); openRow = null; } }

export function bindSwipe(root = document) {
  root.addEventListener("pointerdown", ev => {
    swallowClick = false;   // a gesture that produced no click must not swallow the next real tap
    if (openRow && !openRow.isConnected) openRow = null;                // the diary was re-rendered
    const row = ev.target.closest(".swipe");
    if (openRow && openRow !== row) { closeOpenRow(); swallowClick = true; return; }   // tap elsewhere closes
    if (!row || ev.target.closest(".swipe-del") || ev.pointerType === "mouse" && ev.button !== 0) return;
    drag = { row, x0: ev.clientX, y0: ev.clientY, start: row === openRow ? -DEL_WIDTH : 0, horizontal: null };
  });
  root.addEventListener("pointermove", ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if (drag.horizontal === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      drag.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!drag.horizontal) { drag = null; return; }                    // a scroll: let the page handle it
      try { drag.row.setPointerCapture(ev.pointerId); } catch {}
    }
    place(drag.row, swipeTarget(drag.start, dx).x, false);
  });
  root.addEventListener("pointerup", ev => {
    if (!drag) return;
    const { row, start, horizontal, x0 } = drag; drag = null;
    if (!horizontal) {
      if (row === openRow) { closeOpenRow(); swallowClick = true; }
      return;
    }
    swallowClick = true;
    const { open } = swipeTarget(start, ev.clientX - x0);
    if (open) { if (openRow && openRow !== row) closeOpenRow(); place(row, -DEL_WIDTH, true); openRow = row; }
    else { place(row, 0, true); if (openRow === row) openRow = null; }
  });
  root.addEventListener("pointercancel", () => { if (drag) { place(drag.row, drag.start, true); drag = null; } });
  // Runs before the app's click handler (capture phase) so a swipe never also opens the entry.
  root.addEventListener("click", ev => { if (swallowClick) { swallowClick = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
  // Keyboard users: focusing the hidden Delete button reveals it.
  root.addEventListener("focusin", ev => {
    const del = ev.target.closest?.(".swipe-del"); if (!del) return;
    const row = del.closest(".swipe"); if (openRow !== row) { closeOpenRow(); place(row, -DEL_WIDTH, true); openRow = row; }
  });
}
