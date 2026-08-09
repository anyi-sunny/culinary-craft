import { createContext, useContext } from "react";

// Separate module so the provider file exports only a component
// (keeps React Fast Refresh happy, mirrors authModalContext).
export const ProfileContext = createContext({
    profile: null,
    profileLoading: false,
    saveProfile: async () => {},
    refreshProfile: async () => {},
});

export function useProfile() {
    return useContext(ProfileContext);
}
