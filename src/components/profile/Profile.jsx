import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { updatePassword, deleteUser } from "aws-amplify/auth";
import { Lock, Check } from "lucide-react";

import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import PublicProfileView from "./PublicProfileView";
import { useProfile } from "./profileContext";
import { useAuthModal } from "../auth/authModalContext";
import { useRecipes } from "../../lib/useRecipes";
import { isOwner, isHearted, heartedByList } from "../../lib/recipeUtils";
import { deleteProfile } from "../../lib/profileApiClient";
import { PROFILE_ICONS, ICON_BG_COLORS, iconUrl } from "../../lib/profileIcons";

import "../explore/Explore.css"; // .page shell + .gate
import "./profile.css";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

const memberSince = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

export default function Profile() {
    const navigate = useNavigate();
    const { authStatus, user } = useAuthenticator((ctx) => [
        ctx.authStatus,
        ctx.user,
    ]);
    const { requireLogin } = useAuthModal();
    const { profile, saveProfile } = useProfile();
    const { recipes } = useRecipes();
    const userId = user?.userId;

    // Identity edits
    const [editUsername, setEditUsername] = useState(null); // null = untouched
    const [editName, setEditName] = useState(null);
    const [identityMsg, setIdentityMsg] = useState(null); // {ok, text}
    const [savingIdentity, setSavingIdentity] = useState(false);

    // Avatar edits
    const [savingAvatar, setSavingAvatar] = useState(false);

    // Password change
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordMsg, setPasswordMsg] = useState(null);
    const [savingPassword, setSavingPassword] = useState(false);

    // Account deletion
    const [deleting, setDeleting] = useState(false);

    // Which face of the profile is showing: the settings panels, or a
    // preview of exactly what other users see on /chef/:username.
    const [view, setView] = useState("edit");

    const stats = useMemo(() => {
        if (!userId) return null;
        const mine = recipes.filter((r) => isOwner(r, userId));
        const saved = recipes.filter((r) => isHearted(r, userId)).length;
        const savedByOthers = mine.reduce(
            (sum, r) =>
                sum + heartedByList(r).filter((id) => id !== userId).length,
            0
        );
        return { created: mine.length, saved, savedByOthers };
    }, [recipes, userId]);

    if (authStatus !== "authenticated") {
        return (
            <SplashTransition>
                <div className="page">
                    <TopNav />
                    {authStatus === "unauthenticated" && (
                        <div className="gate">
                            <div className="gate-icon">
                                <Lock size={30} strokeWidth={1.8} />
                            </div>
                            <h2>Log in to view your profile</h2>
                            <p>Your profile, stats and settings live behind an account.</p>
                            <button className="btn btn-primary" onClick={requireLogin}>
                                Log in or sign up
                            </button>
                        </div>
                    )}
                </div>
            </SplashTransition>
        );
    }

    const username = editUsername ?? profile?.username ?? "";
    const name = editName ?? profile?.name ?? "";
    const identityDirty =
        username !== (profile?.username ?? "") || name !== (profile?.name ?? "");

    const saveIdentity = async () => {
        if (!USERNAME_RE.test(username.trim())) {
            setIdentityMsg({
                ok: false,
                text: "Usernames are 3-20 characters: letters, numbers, dots, dashes or underscores.",
            });
            return;
        }
        setSavingIdentity(true);
        setIdentityMsg(null);
        try {
            await saveProfile({ username: username.trim(), name: name.trim() });
            setEditUsername(null);
            setEditName(null);
            setIdentityMsg({ ok: true, text: "Profile updated." });
        } catch (err) {
            setIdentityMsg({
                ok: false,
                text:
                    err.status === 409
                        ? "That username is already taken — try another."
                        : "Could not save changes. Please try again.",
            });
        } finally {
            setSavingIdentity(false);
        }
    };

    const pickAvatar = async (updates) => {
        setSavingAvatar(true);
        try {
            await saveProfile(updates);
        } catch (err) {
            console.error("Error saving avatar:", err);
        } finally {
            setSavingAvatar(false);
        }
    };

    const changePassword = async () => {
        if (newPassword.length < 8) {
            setPasswordMsg({ ok: false, text: "New password must be at least 8 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ ok: false, text: "New passwords do not match." });
            return;
        }
        setSavingPassword(true);
        setPasswordMsg(null);
        try {
            await updatePassword({ oldPassword, newPassword });
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordMsg({ ok: true, text: "Password changed." });
        } catch (err) {
            setPasswordMsg({
                ok: false,
                text: err?.message || "Could not change password.",
            });
        } finally {
            setSavingPassword(false);
        }
    };

    const removeAccount = async () => {
        const sure = window.confirm(
            "Delete your account? This removes your profile and sign-in permanently. Your published recipes remain on the site."
        );
        if (!sure) return;
        setDeleting(true);
        try {
            await deleteProfile().catch(() => {});
            await deleteUser();
            navigate("/");
        } catch (err) {
            console.error("Error deleting account:", err);
            alert("Could not delete your account. Please try again.");
            setDeleting(false);
        }
    };

    const bg = profile?.iconBg || ICON_BG_COLORS[0];
    const monogram = (profile?.name || profile?.username || "C")
        .trim()
        .charAt(0)
        .toUpperCase();

    return (
        <SplashTransition>
            <div className="page">
                <TopNav />
                <div className="page-head">
                    <h1>Your Profile</h1>
                </div>

                {/* Edit / preview toggle, styled like the recipe
                    feedback-questions tabs */}
                <div className="profile-tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={view === "edit"}
                        className={`profile-tab${view === "edit" ? " active" : ""}`}
                        onClick={() => setView("edit")}
                    >
                        Edit Profile
                    </button>
                    <button
                        role="tab"
                        aria-selected={view === "preview"}
                        className={`profile-tab${view === "preview" ? " active" : ""}`}
                        onClick={() => setView("preview")}
                    >
                        Public Preview
                    </button>
                </div>

                {view === "preview" ? (
                    <PublicProfileView profile={{ ...profile, userId }} />
                ) : (
                <div className="profile-layout">
                    {/* Profile card */}
                    <section className="profile-card">
                        <div className="profile-avatar" style={{ background: bg }}>
                            {profile?.icon ? (
                                <img src={iconUrl(profile.icon)} alt="" />
                            ) : (
                                <span className="profile-avatar-monogram">{monogram}</span>
                            )}
                        </div>
                        <h2 className="profile-card-name">{profile?.name || "—"}</h2>
                        <p className="profile-card-username">
                            @{profile?.username || "username"}
                        </p>
                        <p className="profile-card-email">{profile?.email || user?.signInDetails?.loginId}</p>

                        <div className="profile-stats">
                            <div className="profile-stat">
                                <span className="profile-stat-value">{stats?.created ?? "—"}</span>
                                <span className="profile-stat-label">Recipes created</span>
                            </div>
                            <div className="profile-stat">
                                <span className="profile-stat-value">{stats?.saved ?? "—"}</span>
                                <span className="profile-stat-label">Saved recipes</span>
                            </div>
                            <div className="profile-stat">
                                <span className="profile-stat-value">
                                    {stats?.savedByOthers ?? "—"}
                                </span>
                                <span className="profile-stat-label">Saved by others</span>
                            </div>
                            <div className="profile-stat">
                                <span className="profile-stat-value profile-stat-value--date">
                                    {memberSince(profile?.createdAt)}
                                </span>
                                <span className="profile-stat-label">Member since</span>
                            </div>
                        </div>
                    </section>

                    <div className="profile-settings">
                        {/* Avatar picker */}
                        <section className="profile-panel">
                            <h3>Avatar</h3>
                            <p className="profile-panel-sub">
                                Pick an icon and a background color. This replaces the default
                                account icon in the navigation bar.
                            </p>
                            {PROFILE_ICONS.length > 0 ? (
                                <div className="icon-grid">
                                    {PROFILE_ICONS.map((icon) => (
                                        <button
                                            key={icon}
                                            className={`icon-choice${profile?.icon === icon ? " selected" : ""}`}
                                            style={{ background: bg }}
                                            onClick={() => pickAvatar({ icon })}
                                            disabled={savingAvatar}
                                            aria-label={`Choose icon ${icon}`}
                                        >
                                            <img src={iconUrl(icon)} alt="" />
                                            {profile?.icon === icon && (
                                                <span className="icon-choice-check">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="profile-hint">
                                    Custom icons are coming soon — for now your avatar shows your
                                    monogram on the color you choose below.
                                </p>
                            )}
                            <div className="color-row">
                                {ICON_BG_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        className={`color-choice${bg === color ? " selected" : ""}`}
                                        style={{ background: color }}
                                        onClick={() => pickAvatar({ iconBg: color })}
                                        disabled={savingAvatar}
                                        aria-label={`Choose background ${color}`}
                                    >
                                        {bg === color && <Check size={13} strokeWidth={3} />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Identity */}
                        <section className="profile-panel">
                            <h3>Account details</h3>
                            <label className="profile-field-label" htmlFor="profile-username">
                                Username
                            </label>
                            <input
                                id="profile-username"
                                className="profile-input"
                                value={username}
                                maxLength={20}
                                onChange={(e) => setEditUsername(e.target.value)}
                            />
                            <label className="profile-field-label" htmlFor="profile-name">
                                Name
                            </label>
                            <input
                                id="profile-name"
                                className="profile-input"
                                value={name}
                                maxLength={60}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                            {identityMsg && (
                                <p className={identityMsg.ok ? "profile-success" : "profile-error"}>
                                    {identityMsg.text}
                                </p>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={saveIdentity}
                                disabled={!identityDirty || savingIdentity}
                            >
                                {savingIdentity ? "Saving..." : "Save changes"}
                            </button>
                        </section>

                        {/* Password */}
                        <section className="profile-panel">
                            <h3>Change password</h3>
                            <label className="profile-field-label" htmlFor="pw-old">
                                Current password
                            </label>
                            <input
                                id="pw-old"
                                type="password"
                                className="profile-input"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <label className="profile-field-label" htmlFor="pw-new">
                                New password
                            </label>
                            <input
                                id="pw-new"
                                type="password"
                                className="profile-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            <label className="profile-field-label" htmlFor="pw-confirm">
                                Confirm new password
                            </label>
                            <input
                                id="pw-confirm"
                                type="password"
                                className="profile-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            {passwordMsg && (
                                <p className={passwordMsg.ok ? "profile-success" : "profile-error"}>
                                    {passwordMsg.text}
                                </p>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={changePassword}
                                disabled={!oldPassword || !newPassword || savingPassword}
                            >
                                {savingPassword ? "Updating..." : "Update password"}
                            </button>
                        </section>

                        {/* Danger zone */}
                        <section className="profile-panel profile-panel--danger">
                            <h3>Delete account</h3>
                            <p className="profile-panel-sub">
                                Permanently removes your sign-in and profile. Recipes you have
                                published stay on Culinary Craft.
                            </p>
                            <button
                                className="btn-danger-outline"
                                onClick={removeAccount}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting..." : "Delete my account"}
                            </button>
                        </section>
                    </div>
                </div>
                )}
            </div>
        </SplashTransition>
    );
}
