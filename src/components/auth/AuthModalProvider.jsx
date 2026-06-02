import React, { useState, useCallback } from "react";
import LoginModal from "./LoginModal";
import { AuthModalContext } from "./authModalContext";

// Lets any component prompt the user to log in via a single shared modal,
// instead of each page wiring up its own <Authenticator> instance.
export function AuthModalProvider({ children }) {
    const [open, setOpen] = useState(false);

    const requireLogin = useCallback(() => setOpen(true), []);
    const close = useCallback(() => setOpen(false), []);

    return (
        <AuthModalContext.Provider value={{ requireLogin }}>
            {children}
            <LoginModal open={open} onClose={close} />
        </AuthModalContext.Provider>
    );
}
