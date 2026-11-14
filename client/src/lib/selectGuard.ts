/**
 * Stops dropdowns (MUI Select) from picking an option by themselves.
 *
 * MUI Select also selects on "press, drag, release": hold the mouse on the box, move onto the
 * list, let go. With a slightly slow click, the list opens under the pointer (common near the
 * bottom of the screen or in dialogs) and the release picks whatever option is there.
 * Here an option is chosen only when the mouse was also pressed on that list.
 */
let pressedInList = false;

function inOption(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[role="listbox"] [role="option"]');
}

export function installSelectGuard() {
  document.addEventListener(
    'mousedown',
    (e) => {
      pressedInList = e.target instanceof Element && !!e.target.closest('[role="listbox"]');
    },
    true,
  );
  document.addEventListener(
    'mouseup',
    (e) => {
      if (inOption(e.target) && !pressedInList) e.stopPropagation(); // release from the box: ignore
    },
    true,
  );
}
