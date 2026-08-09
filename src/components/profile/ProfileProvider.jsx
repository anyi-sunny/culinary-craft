import React, { useState, useEffect, useCallback } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { updateUserAttributes } from "aws-amplify/auth";
import { getProfile, upsertProfile } from "../../lib/profileApiClient";
import { ProfileContext } from "./profileContext";
import CompleteProfileModal from "./CompleteProfileModal";
import WelcomeBackModal from "./WelcomeBackModal";

const welcomedKey = (userId) => `cc_welcomed_${userId}`;

/**
 * Loads the signed-in user's profile and drives the two login moments:
 *  - no profile yet -> "complete your profile" modal (username + real name)
 *  - returning user -> once-per-session personalized welcome-back modal
 */
export function ProfileProvider({ children }) {
    const { authStatus, user } = useAuthenticator((ctx) => [
        ctx.authStatus,
        ctx.user,
    ]);
    const userId = user?.userId;
    const email = user?.signInDetails?.loginId || "";

    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [welcomeOpen, setWelcomeOpen] = useState(false);

    useEffect(() => {
        if (authStatus !== "authenticated" || !userId) {
            setProfile(null);
            setSetupOpen(false);
            setWelcomeOpen(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setProfileLoading(true);
            try {
                const p = await getProfile();
                if (cancelled) return;
                setProfile(p);
                if (!sessionStorage.getItem(welcomedKey(userId))) {
                    sessionStorage.setItem(welcomedKey(userId), "1");
                    setWelcomeOpen(true);
                }
            } catch (err) {
                if (cancelled) return;
                if (err.status === 404) {
                    // First login on this account: ask for username + name.
                    setSetupOpen(true);
                } else {
                    console.error("Error loading profile:", err);
                }
            } finally {
                if (!cancelled) setProfileLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [authStatus, userId]);

    const saveProfile = useCallback(async (updates) => {
        const saved = await upsertProfile(updates);
        setProfile(saved);
        // Mirror the real name into Cognito so other surfaces can use it.
        if (updates.name) {
            try {
                await updateUserAttributes({
                    userAttributes: { name: updates.name },
                });
            } catch (err) {
                console.debug("Could not sync name to Cognito:", err);
            }
        }
        return saved;
    }, []);

    const refreshProfile = useCallback(async () => {
        try {
            const p = await getProfile();
            setProfile(p);
            return p;
        } catch {
            return null;
        }
    }, []);

    const handleSetupComplete = () => {
        setSetupOpen(false);
        // Fresh sign-up: they're already being greeted, skip the welcome-back.
        if (userId) sessionStorage.setItem(welcomedKey(userId), "1");
    };

    return (
        <ProfileContext.Provider
            value={{ profile, profileLoading, saveProfile, refreshProfile }}
        >
            {children}
            <CompleteProfileModal
                open={setupOpen}
                email={email}
                saveProfile={saveProfile}
                onDone={handleSetupComplete}
                onDismiss={() => setSetupOpen(false)}
            />
            <WelcomeBackModal
                open={welcomeOpen && !!profile}
                profile={profile}
                onClose={() => setWelcomeOpen(false)}
            />
        </ProfileContext.Provider>
    );
}
