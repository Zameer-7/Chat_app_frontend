"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, AtSign, Save, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
    const { user, updateProfile } = useAuth();
    const [nickname, setNickname] = useState(user?.nickname || "");
    const [username, setUsername] = useState(user?.username || "");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    const handleSave = async () => {
        setSaving(true);
        setMessage({ text: "", type: "" });
        try {
            await updateProfile({ nickname, username });
            setMessage({ text: "Profile updated successfully!", type: "success" });
        } catch (err: any) {
            setMessage({ text: err.response?.data?.detail || "Update failed", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div style={s.page}>
            <div style={s.container}>
                <div style={s.header}>
                    <Link href="/chat" style={s.backBtn}>
                        <ArrowLeft size={18} />
                        <span>Back to Chat</span>
                    </Link>
                    <h1 style={s.title}>User Settings</h1>
                </div>

                <div style={s.content}>
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <h2 style={s.cardTitle}>My Account</h2>
                            <p style={s.cardSubtitle}>Manage your identity across the platform</p>
                        </div>

                        <div style={s.form}>
                            <div style={s.field}>
                                <label style={s.label}>Nickname</label>
                                <div style={s.inputWrap}>
                                    <User size={18} style={s.icon} />
                                    <input
                                        style={s.input}
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="Display Name"
                                    />
                                </div>
                                <p style={s.help}>Your friendly name everyone will see.</p>
                            </div>

                            <div style={s.field}>
                                <label style={s.label}>Username</label>
                                <div style={s.inputWrap}>
                                    <AtSign size={18} style={s.icon} />
                                    <input
                                        style={s.input}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="unique_id"
                                    />
                                </div>
                                <div style={s.freqBox}>
                                    <Clock size={14} />
                                    <span>Usernames can only be changed once every 15 days.</span>
                                </div>
                                {user.last_username_change && (
                                    <p style={s.lastChange}>Last changed: {new Date(user.last_username_change).toLocaleDateString()}</p>
                                )}
                            </div>

                            {message.text && (
                                <div style={{
                                    ...s.status,
                                    background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: message.type === 'success' ? '#4ade80' : '#f87171',
                                    border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                }}>
                                    {message.text}
                                </div>
                            )}

                            <div style={s.actions}>
                                <button
                                    style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    <Save size={18} />
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { height: "100%", overflowY: "auto", background: "#0f1117" },
    container: { maxWidth: 800, margin: "0 auto", padding: "3rem 2rem" },
    header: { display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" },
    backBtn: { display: "flex", alignItems: "center", gap: 8, color: "#6366f1", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600, width: "fit-content" },
    title: { fontSize: "2rem", fontWeight: 800, color: "#fff" },
    content: { display: "flex", flexDirection: "column", gap: "2rem" },
    card: { background: "#161922", border: "1px solid #2d313e", borderRadius: 16, padding: "2.5rem", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" },
    cardHeader: { marginBottom: "2rem", borderBottom: "1px solid #2d313e", paddingBottom: "1.5rem" },
    cardTitle: { fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem" },
    cardSubtitle: { fontSize: "0.9rem", color: "#9ca3af" },
    form: { display: "flex", flexDirection: "column", gap: "2rem" },
    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" },
    help: { fontSize: "0.8rem", color: "#6b7280" },
    inputWrap: { display: "flex", alignItems: "center", position: "relative" },
    icon: { position: "absolute", left: 14, color: "#6b7280" },
    input: {
        width: "100%",
        background: "#0f1117",
        border: "1px solid #2d313e",
        padding: "0.875rem 1rem 0.875rem 3rem",
        borderRadius: 10,
        color: "#fff",
        fontSize: "1rem",
        outline: "none",
        transition: "border-color 0.2s"
    },
    freqBox: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#fbbf24", background: "rgba(251, 191, 36, 0.1)", padding: "0.75rem", borderRadius: 8, border: "1px solid rgba(251, 191, 36, 0.2)" },
    lastChange: { fontSize: "0.75rem", color: "#6b7280", marginTop: 4 },
    status: { padding: "1rem", borderRadius: 8, fontSize: "0.9rem", fontWeight: 600, textAlign: "center" },
    actions: { display: "flex", justifyContent: "flex-end", marginTop: "1rem" },
    saveBtn: {
        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        border: "none",
        color: "#fff",
        padding: "0.875rem 2rem",
        borderRadius: 10,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        boxShadow: "0 10px 15px -3px rgba(99, 102, 241, 0.3)"
    }
};
