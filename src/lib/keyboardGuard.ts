/**
 * CSS selector matched against `event.target.closest(...)` to suppress
 * global editor keyboard shortcuts while the user is interacting with
 * a form control, menu, dialog, or other focused UI element.
 */
export const INTERACTIVE_GUARD_SELECTOR = [
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable]",
  "[contenteditable='true']",
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="spinbutton"]',
  '[role="slider"]',
  "[data-radix-popper-content-wrapper]",
].join(", ");
