"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, AtSign, Save, ArrowLeft, Clock, Moon, Sun, Check } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

export default function ProfilePage() {
    const { user, updateProfile } = useAuth();
    const [nickname, setNickname] = useState(user?.nickname || "");
    const [username, setUsername] = useState(user?.username || "");
    const [showLastSeen, setShowLastSeen] = useState(user?.show_last_seen ?? true);
    const [showOnline, setShowOnline] = useState(user?.show_online_status ?? true);
    const [themeMode, setThemeMode] = useState<"dark" | "light">(user?.theme_mode || "dark");
    const [themeAccent, setThemeAccent] = useState<"purple" | "blue" | "green" | "rose">(user?.theme_accent || "purple");
    const [blocked, setBlocked] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        setNickname(user?.nickname || "");
        setUsername(user?.username || "");
        setShowLastSeen(user?.show_last_seen ?? true);
        setShowOnline(user?.show_online_status ?? true);
        setThemeMode(user?.theme_mode || "dark");
        setThemeAccent(user?.theme_accent || "purple");
    }, [user]);

    useEffect(() => {
        const loadBlocked = () => {
            api.get("/users/blocked").then((res) => setBlocked(Array.isArray(res.data) ? res.data : [])).catch(() => setBlocked([]));
        };
        loadBlocked();
        window.addEventListener("focus", loadBlocked);
        return () => window.removeEventListener("focus", loadBlocked);
    }, []);

    useEffect(() => {
        if (message.type !== "success") return;
        const t = setTimeout(() => setMessage({ text: "", type: "" }), 2200);
        return () => clearTimeout(t);
    }, [message]);

    const hasChanges = useMemo(() => {
        if (!user) return false;
        return (
            nickname !== (user.nickname || "") ||
            username !== (user.username || "") ||
            showLastSeen !== (user.show_last_seen ?? true) ||
            showOnline !== (user.show_online_status ?? true) ||
            themeMode !== (user.theme_mode || "dark") ||
            themeAccent !== (user.theme_accent || "purple")
        );
    }, [nickname, username, showLastSeen, showOnline, themeMode, themeAccent, user]);

    const handleSave = async () => {
        if (!hasChanges) return;
        setSaving(true);
        setMessage({ text: "", type: "" });
        try {
            await updateProfile({ nickname, username, show_last_seen: showLastSeen, show_online_status: showOnline, theme_mode: themeMode, theme_accent: themeAccent });
            setMessage({ text: "Settings updated", type: "success" });
        } catch (err: any) {
            setMessage({ text: err.response?.data?.detail || err?.message || "Update failed", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const unblock = async (id: number) => {
        await api.delete(`/users/block/${id}`);
        setBlocked((prev) => prev.filter((b) => b.blocked_id !== id));
    };

    if (!user) return null;

    return (
        <div style={s.page}>
            <header style={s.stickyHeader} className="glass">
                <div style={s.stickyInner}>
                    <Link href="/chat" style={s.backBtn}><ArrowLeft size={18} /><span>Back to Chat</span></Link>
                    <h1 style={s.title}>Settings</h1>
                </div>
            </header>

            <div style={s.scrollArea}>
                <div style={s.container}>
                    <div style={s.card}>
                        <section style={s.section}>
                            <p style={s.sectionTitle}>Account</p>
                            <div style={s.field}><label style={s.label}>Nickname</label><div style={s.inputWrap}><User size={18} style={s.icon} /><input style={s.input} value={nickname} onChange={(e) => setNickname(e.target.value)} /></div></div>
                            <div style={s.field}><label style={s.label}>Username</label><div style={s.inputWrap}><AtSign size={18} style={s.icon} /><input style={s.input} value={username} onChange={(e) => setUsername(e.target.value)} /></div><div style={s.freqBox}><Clock size={14} /><span>Usernames can be changed every 15 days.</span></div></div>
                        </section>

                        <section style={s.section}>
                            <p style={s.sectionTitle}>Privacy</p>
                            <div style={s.toggleRow}>
                                <button style={{ ...s.toggle, ...(showLastSeen ? s.toggleOn : {}) }} onClick={() => setShowLastSeen((v) => !v)}>Last Seen: {showLastSeen ? "Visible" : "Hidden"}</button>
                                <button style={{ ...s.toggle, ...(showOnline ? s.toggleOn : {}) }} onClick={() => setShowOnline((v) => !v)}>Online: {showOnline ? "Visible" : "Hidden"}</button>
                            </div>
                        </section>

                        <section style={s.section}>
                            <p style={s.sectionTitle}>Theme</p>
                            <div style={s.toggleRow}>
                                <button style={{ ...s.toggle, ...(themeMode === "dark" ? s.toggleOn : {}) }} onClick={() => setThemeMode("dark")}><Moon size={14} /> Dark</button>
                                <button style={{ ...s.toggle, ...(themeMode === "light" ? s.toggleOn : {}) }} onClick={() => setThemeMode("light")}><Sun size={14} /> Light</button>
                            </div>
                            <div style={s.swatchRow}>
                                {(["purple", "blue", "green", "rose"] as const).map((accent) => (
                                    <button key={accent} style={s.swatchBtn} onClick={() => setThemeAccent(accent)} title={accent}>
                                        <span style={{ ...s.swatch, ...swatchColor[accent] }}>
                                            {themeAccent === accent && <Check size={12} color="#fff" />}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section style={s.section}>
                            <p style={s.sectionTitle}>Blocked Users</p>
                            <div style={s.blockList}>
                                {blocked.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No blocked users</p>}
                                {blocked.map((b) => <div key={b.id} style={s.blockItem}><span>@{b.blocked_user?.username || b.blocked_id}</span><button style={s.unblockBtn} onClick={() => unblock(b.blocked_id)}>Unblock</button></div>)}
                            </div>
                        </section>

                        <footer style={s.cardFooter}>
                            <span style={{ ...s.status, color: message.type === "success" ? "#4ade80" : "#f87171" }}>{message.type === "error" ? message.text : ""}</span>
                            <button style={{ ...s.saveBtn, opacity: saving || !hasChanges ? 0.6 : 1 }} onClick={handleSave} disabled={saving || !hasChanges}><Save size={18} />{saving ? "Saving..." : "Save Changes"}</button>
                        </footer>
                    </div>
                </div>
            </div>

            {message.type === "success" && <div style={s.toast}>Settings updated</div>}
        </div>
    );
}

const swatchColor: Record<"purple" | "blue" | "green" | "rose", React.CSSProperties> = {
    purple: { background: "linear-gradient(135deg,#7765ff,#5d4ce7)" },
    blue: { background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
    green: { background: "linear-gradient(135deg,#16a34a,#15803d)" },
    rose: { background: "linear-gradient(135deg,#e11d48,#be123c)" },
};

const s: Record<string, React.CSSProperties> = {
    page: { height: "100%", display: "flex", flexDirection: "column" },
    stickyHeader: { position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid rgba(143,150,210,0.18)" },
    stickyInner: { maxWidth: 980, margin: "0 auto", padding: "0.9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" },
    backBtn: { display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 },
    title: { fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" },
    scrollArea: { flex: 1, overflowY: "auto" },
    container: { maxWidth: 980, margin: "0 auto", padding: "1.4rem 1rem 2rem" },
    card: { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.4rem", display: "flex", flexDirection: "column", gap: "1.5rem" },
    section: { display: "flex", flexDirection: "column", gap: 8 },
    sectionTitle: { fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)", opacity: 0.8, marginBottom: 4 },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" },
    inputWrap: { display: "flex", alignItems: "center", position: "relative" },
    icon: { position: "absolute", left: 14, color: "var(--text-muted)" },
    input: { width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "0.875rem 1rem 0.875rem 3rem", borderRadius: 10, color: "var(--text-primary)", fontSize: "1rem", outline: "none" },
    freqBox: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#fbbf24" },
    toggleRow: { display: "flex", gap: 8, flexWrap: "wrap" },
    toggle: { border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)", borderRadius: 10, padding: "0.45rem 0.7rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    toggleOn: { color: "#fff", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", borderColor: "transparent" },
    swatchRow: { display: "flex", gap: 10, alignItems: "center", marginTop: 6 },
    swatchBtn: { border: "none", background: "transparent", padding: 0, cursor: "pointer" },
    swatch: { width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.38)", display: "flex", alignItems: "center", justifyContent: "center" },
    blockList: { border: "1px solid var(--border)", borderRadius: 10, padding: "0.6rem", display: "flex", flexDirection: "column", gap: 6 },
    blockItem: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    unblockBtn: { background: "rgba(239,79,111,0.14)", color: "#ff9fb2", border: "1px solid rgba(239,79,111,0.45)", borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer" },
    cardFooter: { borderTop: "1px solid rgba(143,150,210,0.2)", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
    status: { fontWeight: 600, fontSize: "0.88rem", minHeight: 16 },
    saveBtn: { background: "linear-gradient(135deg,var(--accent),var(--accent-2))", border: "none", color: "#fff", padding: "0.75rem 1.2rem", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
    toast: { position: "fixed", right: 18, bottom: 18, zIndex: 30, padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid rgba(74,222,128,0.35)", background: "rgba(13,24,16,0.95)", color: "#8cf0ad", fontSize: "0.84rem", fontWeight: 700, animation: "fadeInFast 0.2s ease" },
};

