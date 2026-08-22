import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChefHat } from "lucide-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import PublicProfileView from "./PublicProfileView";
import { getPublicProfile } from "../../lib/profileApiClient";
import { usePageMeta } from "../../lib/usePageMeta";
import "../explore/Explore.css"; // .gate
import "./profile.css";

/**
 * /chef/:username — a chef's public profile, open to everyone (guests
 * included). All privacy filtering happens server-side: the endpoint only
 * ever returns username, avatar and join date.
 */
export default function PublicProfile() {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);
    const [status, setStatus] = useState("loading"); // loading | ready | missing
    usePageMeta(
        status === "ready"
            ? {
                  title: `${profile.username}'s Kitchen`,
                  description: `Recipes created and shared by ${profile.username} on Culinary Craft.`,
                  path: `/chef/${profile.username}`,
              }
            : { title: status === "missing" ? "Chef Not Found" : null }
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setStatus("loading");
            setProfile(null);
            try {
                const p = await getPublicProfile(username);
                if (cancelled) return;
                setProfile(p);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                if (err.status !== 404) console.error("Error loading profile:", err);
                setStatus("missing");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [username]);

    return (
        <SplashTransition>
            <div className="page">
                <TopNav />
                {status === "ready" && (
                    <div className="fade-in">
                        <div className="page-head">
                            <h1>{profile.username}'s Kitchen</h1>
                        </div>
                        <PublicProfileView profile={profile} />
                    </div>
                )}
                {status === "missing" && (
                    <div className="gate fade-in">
                        <div className="gate-icon">
                            <ChefHat size={36} strokeWidth={1.6} />
                        </div>
                        <h2>Chef not found</h2>
                        <p>
                            No one goes by @{username} here — they may have changed
                            their username.
                        </p>
                    </div>
                )}
            </div>
        </SplashTransition>
    );
}
