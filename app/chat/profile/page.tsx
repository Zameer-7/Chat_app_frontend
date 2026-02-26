"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, AtSign, Save, ArrowLeft, Clock, Moon, Sun } from "lucide-react";
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
        const loadBlocked = () => {
            api.get("/users/blocked").then((res) => setBlocked(Array.isArray(res.data) ? res.data : [])).catch(() => setBlocked([]));
        };
        loadBlocked();
        window.addEventListener("focus", loadBlocked);
        return () => window.removeEventListener("focus", loadBlocked);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage({ text: "", type: "" });
        try {
            await updateProfile({ nickname, username, show_last_seen: showLastSeen, show_online_status: showOnline, theme_mode: themeMode, theme_accent: themeAccent });
            setMessage({ text: "Settings updated", type: "success" });
        } catch (err: any) {
            setMessage({ text: err.response?.data?.detail || "Update failed", type: "error" });
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
            <div style={s.container}>
                <div style={s.header}><Link href="/chat" style={s.backBtn}><ArrowLeft size={18} /><span>Back to Chat</span></Link><h1 style={s.title}>User Settings</h1></div>
                <div style={s.card}>
                    <div style={s.field}><label style={s.label}>Nickname</label><div style={s.inputWrap}><User size={18} style={s.icon} /><input style={s.input} value={nickname} onChange={(e) => setNickname(e.target.value)} /></div></div>
                    <div style={s.field}><label style={s.label}>Username</label><div style={s.inputWrap}><AtSign size={18} style={s.icon} /><input style={s.input} value={username} onChange={(e) => setUsername(e.target.value)} /></div><div style={s.freqBox}><Clock size={14} /><span>Usernames can be changed every 15 days.</span></div></div>

                    <div style={s.field}><label style={s.label}>Privacy</label><div style={s.toggleRow}><button style={{ ...s.toggle, ...(showLastSeen ? s.toggleOn : {}) }} onClick={() => setShowLastSeen((v) => !v)}>Last Seen: {showLastSeen ? "Visible" : "Hidden"}</button><button style={{ ...s.toggle, ...(showOnline ? s.toggleOn : {}) }} onClick={() => setShowOnline((v) => !v)}>Online: {showOnline ? "Visible" : "Hidden"}</button></div></div>

                    <div style={s.field}><label style={s.label}>Theme</label><div style={s.toggleRow}><button style={{ ...s.toggle, ...(themeMode === "dark" ? s.toggleOn : {}) }} onClick={() => setThemeMode("dark")}><Moon size={14} /> Dark</button><button style={{ ...s.toggle, ...(themeMode === "light" ? s.toggleOn : {}) }} onClick={() => setThemeMode("light")}><Sun size={14} /> Light</button></div><div style={s.toggleRow}>{(["purple", "blue", "green", "rose"] as const).map((accent) => <button key={accent} style={{ ...s.toggle, ...(themeAccent === accent ? s.toggleOn : {}) }} onClick={() => setThemeAccent(accent)}>{accent}</button>)}</div></div>

                    <div style={s.field}><label style={s.label}>Blocked Users</label><div style={s.blockList}>{blocked.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No blocked users</p>}{blocked.map((b) => <div key={b.id} style={s.blockItem}><span>@{b.blocked_user?.username || b.blocked_id}</span><button style={s.unblockBtn} onClick={() => unblock(b.blocked_id)}>Unblock</button></div>)}</div></div>

                    {message.text && <div style={{ ...s.status, color: message.type === "success" ? "#4ade80" : "#f87171" }}>{message.text}</div>}
                    <div style={s.actions}><button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}><Save size={18} />{saving ? "Saving..." : "Save Changes"}</button></div>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { height: "100%", overflowY: "auto" },
    container: { maxWidth: 860, margin: "0 auto", padding: "2rem" },
    header: { display: "flex", flexDirection: "column", gap: 12, marginBottom: "1.6rem" },
    backBtn: { display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600, width: "fit-content" },
    title: { fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" },
    card: { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" },
    inputWrap: { display: "flex", alignItems: "center", position: "relative" },
    icon: { position: "absolute", left: 14, color: "var(--text-muted)" },
    input: { width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "0.875rem 1rem 0.875rem 3rem", borderRadius: 10, color: "var(--text-primary)", fontSize: "1rem", outline: "none" },
    freqBox: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#fbbf24" },
    toggleRow: { display: "flex", gap: 8, flexWrap: "wrap" },
    toggle: { border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)", borderRadius: 10, padding: "0.45rem 0.7rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    toggleOn: { color: "#fff", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", borderColor: "transparent" },
    blockList: { border: "1px solid var(--border)", borderRadius: 10, padding: "0.6rem", display: "flex", flexDirection: "column", gap: 6 },
    blockItem: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    unblockBtn: { background: "rgba(239,79,111,0.14)", color: "#ff9fb2", border: "1px solid rgba(239,79,111,0.45)", borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer" },
    status: { fontWeight: 600, fontSize: "0.88rem" },
    actions: { display: "flex", justifyContent: "flex-end", marginTop: 8 },
    saveBtn: { background: "linear-gradient(135deg,var(--accent),var(--accent-2))", border: "none", color: "#fff", padding: "0.75rem 1.2rem", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
};
