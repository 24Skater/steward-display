import { createContext, useContext } from "react";

/**
 * True while rendering the Display View (the TV). Widgets use it to hide editor-only setup
 * hints: an unconfigured widget renders nothing on screen rather than "Set a city".
 */
export const DisplayModeContext = createContext(false);

export function useIsDisplay(): boolean {
  return useContext(DisplayModeContext);
}
