"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, Users, Hash, Settings, LogOut, Plus, Search, UserCheck, Clock, AtSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [rooms, setRooms] = useState<any[]>([]);
    const [dmConversations, setDmConversations] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [friendRequests, setFriendRequests] = useState<any[]>([]);
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendUsername, setFriendUsername] = useState("");
    const [friendSuggestions, setFriendSuggestions] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const roomPath = (room: any) => `/chat/rooms/${room.room_id || room.id}`;

    const loadSidebarData = async () => {
        try {
            const [r, d, f, fa] = await Promise.all([
                api.get("/rooms"),
                api.get("/dms"),
                api.get("/friends/requests"),
                api.get("/friends/all"),
            ]);
            setRooms(r.data);
            setDmConversations(d.data);
            setFriendRequests(f.data);
            setFriends(fa.data);
        } catch (err) {
            console.error("Sidebar data load failed", err);
        }
    };

    useEffect(() => {
        if (user) loadSidebarData();
    }, [user, pathname]);

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [loading, user, router]);

    useEffect(() => {
        if (!showAddFriend) {
            setFriendSuggestions([]);
            setIsSearchingUsers(false);
            return;
        }

        const q = friendUsername.trim();
        if (!q) {
            setFriendSuggestions([]);
            setIsSearchingUsers(false);
            return;
        }

        const t = setTimeout(async () => {
            try {
                setIsSearchingUsers(true);
                const res = await api.get("/users/search", { params: { q } });
                const rows = Array.isArray(res.data) ? res.data : [];
                setFriendSuggestions(rows.filter((u: any) => u.username !== user?.username).slice(0, 8));
            } catch {
                setFriendSuggestions([]);
            } finally {
                setIsSearchingUsers(false);
            }
        }, 250);

        return () => clearTimeout(t);
    }, [friendUsername, showAddFriend, user?.username]);

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post("/rooms", { name: roomName });
            setRooms([...rooms, res.data]);
            setShowCreateRoom(false);
            setRoomName("");
            router.push(roomPath(res.data));
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to create room");
        }
    };

    const handleSendFriendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/friends/requests", { username: friendUsername.trim().toLowerCase() });
            alert("Request sent!");
            setFriendUsername("");
            setFriendSuggestions([]);
            setShowAddFriend(false);
            loadSidebarData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to send request");
        }
    };

    const handleAcceptFriend = async (requestId: number) => {
        try {
            await api.post(`/friends/requests/${requestId}/accept`);
            loadSidebarData();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading || !user) {
        return <div style={styles.bootScreen}>Loading...</div>;
    }

    return (
        <div style={styles.appWrap}>
            {/* Sidebar */}
            <aside style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <div style={styles.userBadge}>
                        <div style={styles.avatar}>
                            {user.nickname[0].toUpperCase()}
                        </div>
                        <div style={styles.userInfo}>
                            <p style={styles.nickname}>{user.nickname}</p>
                            <p style={styles.username}>@{user.username}</p>
                        </div>
                    </div>
                    <Link href="/chat/profile" style={styles.settingsBtn}>
                        <Settings size={20} />
                    </Link>
                </div>

                <div style={styles.sections}>
                    {/* Friends Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <span>FRIENDS</span>
                            <button onClick={() => setShowAddFriend(true)} style={styles.addBtn}><Search size={14} /></button>
                        </div>
                        {friendRequests.length > 0 && (
                            <div style={styles.requests}>
                                <p style={styles.smallTitle}><Clock size={10} /> Pending ({friendRequests.length})</p>
                                {friendRequests.map(req => (
                                    <div key={req.id} style={styles.reqItem}>
                                        <span>{req.sender.nickname}</span>
                                        <button onClick={() => handleAcceptFriend(req.id)} style={styles.checkBtn}><UserCheck size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={styles.dmList}>
                            {friends.map((f) => {
                                const conv = dmConversations.find((c) => c.user?.id === f.id);
                                return (
                                    <Link
                                        key={f.id}
                                        href={`/chat/dms/${f.id}`}
                                        style={{ ...styles.navItem, background: pathname.includes(`/dms/${f.id}`) ? "var(--bg-elevated)" : "transparent" }}
                                    >
                                        <div style={styles.dmAvatar}>{f.nickname?.[0] || "?"}</div>
                                        <div style={styles.dmInfo}>
                                            <p style={styles.dmName}>{f.nickname}</p>
                                            <p style={styles.dmLast}>{conv?.last_message || "Start chatting"}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                            {dmConversations.map(conv => (
                                friends.some((f) => f.id === conv.user.id) ? null : (
                                <Link
                                    key={conv.user.id}
                                    href={`/chat/dms/${conv.user.id}`}
                                    style={{ ...styles.navItem, background: pathname.includes(`/dms/${conv.user.id}`) ? "var(--bg-elevated)" : "transparent" }}
                                >
                                    <div style={styles.dmAvatar}>{conv.user.nickname[0]}</div>
                                    <div style={styles.dmInfo}>
                                        <p style={styles.dmName}>{conv.user.nickname}</p>
                                        <p style={styles.dmLast}>{conv.last_message}</p>
                                    </div>
                                </Link>
                                )
                            ))}
                        </div>
                    </div>

                    {/* Rooms Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <span>CHANNELS</span>
                            <button onClick={() => setShowCreateRoom(true)} style={styles.addBtn}><Plus size={16} /></button>
                        </div>
                        <div style={styles.roomList}>
                            {rooms.map(room => (
                                <Link
                                    key={room.id}
                                    href={roomPath(room)}
                                    style={{ ...styles.navItem, background: pathname.includes(`/rooms/${room.room_id || room.id}`) ? "var(--bg-elevated)" : "transparent" }}
                                >
                                    <Hash size={18} color="var(--text-muted)" />
                                    <span>{room.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <button onClick={logout} style={styles.logoutBtn}>
                    <LogOut size={18} />
                    <span>Log Out</span>
                </button>
            </aside>

            {/* Main Area */}
            <main style={styles.main}>
                {children}
            </main>

            {/* Modals */}
            {showCreateRoom && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <h3 style={styles.modalTitle}>Create Channel</h3>
                        <p style={styles.modalSubtitle}>Channels are where your team communicates.</p>
                        <form onSubmit={handleCreateRoom}>
                            <div style={styles.modalInputWrap}>
                                <Hash size={18} style={styles.modalIcon} />
                                <input autoFocus placeholder="channel-name" value={roomName} onChange={e => setRoomName(e.target.value)} style={styles.modalInput} />
                            </div>
                            <div style={styles.modalActions}>
                                <button type="button" onClick={() => setShowCreateRoom(false)} style={styles.cancelBtn}>Cancel</button>
                                <button type="submit" style={styles.submitBtn}>Create Channel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddFriend && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <h3 style={styles.modalTitle}>Add Friend</h3>
                        <p style={styles.modalSubtitle}>Enter their unique @username to connect.</p>
                        <form onSubmit={handleSendFriendRequest}>
                            <div style={styles.modalInputWrap}>
                                <AtSign size={18} style={styles.modalIcon} />
                                <input autoFocus placeholder="username" value={friendUsername} onChange={e => setFriendUsername(e.target.value)} style={styles.modalInput} />
                            </div>
                            {friendUsername.trim() && (
                                <div style={styles.suggestBox}>
                                    {isSearchingUsers && <p style={styles.suggestHint}>Searching...</p>}
                                    {!isSearchingUsers && friendSuggestions.length === 0 && (
                                        <p style={styles.suggestHint}>No users found</p>
                                    )}
                                    {!isSearchingUsers && friendSuggestions.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => setFriendUsername(u.username)}
                                            style={styles.suggestItem}
                                        >
                                            <span style={styles.suggestNick}>{u.nickname}</span>
                                            <span style={styles.suggestUser}>@{u.username}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div style={styles.modalActions}>
                                <button type="button" onClick={() => setShowAddFriend(false)} style={styles.cancelBtn}>Cancel</button>
                                <button type="submit" style={styles.submitBtn}>Send Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    bootScreen: {
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        background: "var(--bg-base)",
    },
    appWrap: { display: "flex", height: "100vh", overflow: "hidden" },
    sidebar: { width: 280, flexShrink: 0, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" },
    sidebarHeader: { padding: "1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" },
    userBadge: { display: "flex", alignItems: "center", gap: 12 },
    avatar: { width: 36, height: 36, borderRadius: "30%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem" },
    userInfo: { display: "flex", flexDirection: "column" },
    nickname: { fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" },
    username: { fontSize: "0.75rem", color: "var(--text-muted)" },
    settingsBtn: { color: "var(--text-muted)", cursor: "pointer" },
    sections: { flex: 1, overflowY: "auto", padding: "1rem" },
    section: { marginBottom: "2rem" },
    sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: "0.75rem", padding: "0 0.5rem" },
    addBtn: { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" },
    navItem: { display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 0.75rem", borderRadius: 6, textDecoration: "none", color: "var(--text-muted)", fontSize: "0.9rem", transition: "all 0.2s" },
    dmAvatar: { width: 24, height: 24, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 },
    dmInfo: { overflow: "hidden" },
    dmName: { fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    dmLast: { fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    roomList: { display: "flex", flexDirection: "column", gap: 2 },
    requests: { background: "rgba(99, 102, 241, 0.05)", borderRadius: 8, padding: 8, marginBottom: 12, border: "1px dashed var(--accent)" },
    smallTitle: { fontSize: "0.65rem", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4, color: "var(--accent)" },
    reqItem: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem", padding: "4px 0" },
    checkBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, padding: "2px 4px", cursor: "pointer" },
    logoutBtn: { padding: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 },
    main: { flex: 1, position: "relative" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
    modal: { background: "#161922", padding: "2.5rem", borderRadius: 20, width: "100%", maxWidth: 400, border: "1px solid #2d313e", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" },
    modalTitle: { fontSize: "1.5rem", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" },
    modalSubtitle: { fontSize: "0.9rem", color: "#9ca3af", marginBottom: "1.5rem" },
    modalInputWrap: { position: "relative", display: "flex", alignItems: "center", marginBottom: "1.5rem" },
    modalIcon: { position: "absolute", left: 14, color: "#6b7280" },
    modalInput: { width: "100%", background: "#0f1117", border: "1px solid #2d313e", padding: "0.875rem 1rem 0.875rem 3rem", borderRadius: 12, color: "#fff", outline: "none", fontSize: "1rem" },
    suggestBox: { background: "#0f1117", border: "1px solid #2d313e", borderRadius: 12, marginTop: "-1rem", marginBottom: "1rem", overflow: "hidden" },
    suggestHint: { fontSize: "0.8rem", color: "#9ca3af", padding: "0.75rem 0.9rem" },
    suggestItem: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", color: "#fff", textAlign: "left", padding: "0.75rem 0.9rem", cursor: "pointer" },
    suggestNick: { fontSize: "0.9rem", fontWeight: 600 },
    suggestUser: { fontSize: "0.8rem", color: "#9ca3af" },
    modalActions: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: "2rem" },
    cancelBtn: { background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.95rem", fontWeight: 600 },
    submitBtn: { background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", border: "none", color: "#fff", padding: "0.75rem 1.5rem", borderRadius: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 16px rgba(99, 102, 241, 0.2)" },
};
