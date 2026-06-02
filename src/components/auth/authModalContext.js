import { createContext, useContext } from "react";

// Context + hook live in their own module so the provider file can export only
// a component (keeps React Fast Refresh happy).
export const AuthModalContext = createContext({ requireLogin: () => {} });

export function useAuthModal() {
    return useContext(AuthModalContext);
}
