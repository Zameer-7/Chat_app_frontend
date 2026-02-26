"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Settings, LogOut, Plus, Search, UserCheck, Clock, AtSign, Menu, X, Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const [rooms, setRooms] = useState<any[]>([]);
    const [dmConversations, setDmConversations] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [friendRequests, setFriendRequests] = useState<any[]>([]);

    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendUsername, setFriendUsername] = useState("");
    const [friendSuggestions, setFriendSuggestions] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
        if (!loading && !user) router.replace("/login");
    }, [loading, user, router]);

    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth < 980;
            setIsMobile(mobile);
            setSidebarOpen(!mobile);
        };
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

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
        }, 220);
        return () => clearTimeout(t);
    }, [friendUsername, showAddFriend, user?.username]);

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post("/rooms", { name: roomName });
            setRooms((prev) => [...prev, res.data]);
            setShowCreateRoom(false);
            setRoomName("");
            router.push(roomPath(res.data));
            if (isMobile) setSidebarOpen(false);
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

    const friendMap = useMemo(() => new Map(friends.map((f) => [f.id, f])), [friends]);

    if (loading || !user) return <div style={styles.bootScreen}>Loading...</div>;

    return (
        <div style={styles.appWrap}>
            {isMobile && sidebarOpen && <div style={styles.backdrop} onClick={() => setSidebarOpen(false)} />}

            <aside style={{ ...styles.sidebar, ...(sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed), ...(isMobile ? styles.sidebarMobile : {}) }} className="glass">
                <div style={styles.sidebarHeader}>
                    <div style={styles.userBadge}>
                        <div style={styles.avatar}>{user.nickname[0].toUpperCase()}</div>
                        <div style={styles.userInfo}>
                            <p style={styles.nickname}>{user.nickname}</p>
                            <p style={styles.username}>@{user.username}</p>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isMobile && (
                            <button style={styles.settingsBtn} onClick={() => setSidebarOpen(false)}><X size={18} /></button>
                        )}
                        <Link href="/chat/profile" style={styles.settingsBtn}><Settings size={18} /></Link>
                    </div>
                </div>

                <div style={styles.sections}>
                    <div style={styles.sectionLabel}>Friends</div>
                    <div style={styles.actionsRow}>
                        <button onClick={() => setShowAddFriend(true)} style={styles.secondaryBtn}><Search size={14} /> Add Friend</button>
                    </div>

                    {friendRequests.length > 0 && (
                        <div style={styles.requests}>
                            <p style={styles.smallTitle}><Clock size={10} /> Pending ({friendRequests.length})</p>
                            {friendRequests.map((req) => (
                                <div key={req.id} style={styles.reqItem}>
                                    <span>{req.sender.nickname}</span>
                                    <button onClick={() => handleAcceptFriend(req.id)} style={styles.checkBtn}><UserCheck size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={styles.listWrap}>
                        {friends.map((f) => {
                            const conv = dmConversations.find((c) => c.user?.id === f.id);
                            const active = pathname.includes(`/dms/${f.id}`);
                            return (
                                <Link key={f.id} href={`/chat/dms/${f.id}`} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }} onClick={() => isMobile && setSidebarOpen(false)}>
                                    <div style={styles.dmAvatar}>{f.nickname?.[0] || "?"}</div>
                                    <div style={styles.dmInfo}>
                                        <p style={styles.dmName}>{f.nickname}</p>
                                        <p style={styles.dmLast}>{conv?.last_message || "Start chatting"}</p>
                                    </div>
                                    <span style={styles.onlineDot} />
                                </Link>
                            );
                        })}
                        {dmConversations.map((conv) =>
                            friendMap.has(conv.user.id) ? null : (
                                <Link key={conv.user.id} href={`/chat/dms/${conv.user.id}`} style={{ ...styles.navItem, ...(pathname.includes(`/dms/${conv.user.id}`) ? styles.navItemActive : {}) }} onClick={() => isMobile && setSidebarOpen(false)}>
                                    <div style={styles.dmAvatar}>{conv.user.nickname[0]}</div>
                                    <div style={styles.dmInfo}>
                                        <p style={styles.dmName}>{conv.user.nickname}</p>
                                        <p style={styles.dmLast}>{conv.last_message}</p>
                                    </div>
                                </Link>
                            )
                        )}
                    </div>

                    <div style={{ ...styles.sectionLabel, marginTop: "1.2rem" }}>Rooms</div>
                    <button onClick={() => setShowCreateRoom(true)} className="btn-primary" style={styles.primaryCta}><Plus size={14} /> Create Room</button>
                    <div style={styles.listWrap}>
                        {rooms.map((room) => {
                            const active = pathname.includes(`/rooms/${room.room_id || room.id}`);
                            return (
                                <Link key={room.id} href={roomPath(room)} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }} onClick={() => isMobile && setSidebarOpen(false)}>
                                    <div style={styles.roomHash}>#</div>
                                    <span>{room.name}</span>
                                    {room.created_by === user.id && <Crown size={12} color="#f7ce46" />}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <button onClick={logout} style={styles.logoutBtn}><LogOut size={16} /> Log Out</button>
            </aside>

            <main style={styles.main}>
                {isMobile && (
                    <button style={styles.mobileToggle} onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
                )}
                <div style={styles.mainInner}>{children}</div>
            </main>

            {showCreateRoom && (
                <div style={styles.overlay}>
                    <div style={styles.modal} className="glass">
                        <h3 style={styles.modalTitle}>Create Room</h3>
                        <p style={styles.modalSubtitle}>Create a private space and share the secure room link.</p>
                        <form onSubmit={handleCreateRoom}>
                            <div style={styles.modalInputWrap}>
                                <input autoFocus placeholder="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={styles.modalInput} />
                            </div>
                            <div style={styles.modalActions}>
                                <button type="button" onClick={() => setShowCreateRoom(false)} style={styles.cancelBtn}>Cancel</button>
                                <button type="submit" className="btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddFriend && (
                <div style={styles.overlay}>
                    <div style={styles.modal} className="glass">
                        <h3 style={styles.modalTitle}>Add Friend</h3>
                        <p style={styles.modalSubtitle}>Search by username and send request instantly.</p>
                        <form onSubmit={handleSendFriendRequest}>
                            <div style={styles.modalInputWrap}>
                                <AtSign size={18} style={styles.modalIcon} />
                                <input autoFocus placeholder="username" value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} style={styles.modalInput} />
                            </div>
                            {friendUsername.trim() && (
                                <div style={styles.suggestBox}>
                                    {isSearchingUsers && <p style={styles.suggestHint}>Searching...</p>}
                                    {!isSearchingUsers && friendSuggestions.length === 0 && <p style={styles.suggestHint}>No users found</p>}
                                    {!isSearchingUsers && friendSuggestions.map((u) => (
                                        <button key={u.id} type="button" onClick={() => setFriendUsername(u.username)} style={styles.suggestItem}>
                                            <span style={styles.suggestNick}>{u.nickname}</span>
                                            <span style={styles.suggestUser}>@{u.username}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div style={styles.modalActions}>
                                <button type="button" onClick={() => setShowAddFriend(false)} style={styles.cancelBtn}>Cancel</button>
                                <button type="submit" className="btn-primary">Send Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    bootScreen: { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" },
    appWrap: { display: "flex", minHeight: "100vh", position: "relative" },
    backdrop: { position: "fixed", inset: 0, background: "rgba(7,10,20,0.6)", zIndex: 40, animation: "fadeInFast 0.2s ease" },
    sidebar: { width: 300, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(143,150,210,0.18)", transition: "transform 0.25s ease, opacity 0.25s ease", zIndex: 50 },
    sidebarMobile: { position: "fixed", left: 0, top: 0, bottom: 0 },
    sidebarOpen: { transform: "translateX(0)", opacity: 1 },
    sidebarClosed: { transform: "translateX(-100%)", opacity: 0 },
    sidebarHeader: { padding: "1rem 1.1rem", borderBottom: "1px solid rgba(143,150,210,0.14)", display: "flex", alignItems: "center", justifyContent: "space-between" },
    userBadge: { display: "flex", alignItems: "center", gap: 10 },
    avatar: { width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.92rem", boxShadow: "0 8px 18px rgba(93,76,231,0.35)" },
    userInfo: { display: "flex", flexDirection: "column" },
    nickname: { fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" },
    username: { fontSize: "0.76rem", color: "var(--text-muted)" },
    settingsBtn: { color: "var(--text-muted)", border: "1px solid rgba(143,150,210,0.2)", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" },
    sections: { flex: 1, overflowY: "auto", padding: "0.9rem" },
    sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700, marginBottom: 8, padding: "0 0.4rem" },
    actionsRow: { display: "flex", gap: 8, marginBottom: 10 },
    secondaryBtn: { width: "100%", display: "flex", gap: 6, alignItems: "center", justifyContent: "center", background: "rgba(119,101,255,0.12)", color: "#ccd0ff", border: "1px solid rgba(119,101,255,0.35)", borderRadius: 10, padding: "0.56rem 0.7rem", fontWeight: 600, cursor: "pointer", transition: "all 0.25s ease" },
    primaryCta: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
    listWrap: { display: "flex", flexDirection: "column", gap: 6 },
    navItem: { position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0.62rem 0.75rem", borderRadius: 12, textDecoration: "none", color: "var(--text-muted)", fontSize: "0.9rem", transition: "all 0.25s ease", border: "1px solid transparent" },
    navItemActive: { color: "#fff", background: "rgba(119,101,255,0.17)", borderColor: "rgba(119,101,255,0.42)", boxShadow: "inset 3px 0 0 0 var(--accent)" },
    roomHash: { width: 20, height: 20, borderRadius: 7, background: "rgba(119,101,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 },
    dmAvatar: { width: 24, height: 24, borderRadius: 8, background: "rgba(119,101,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 },
    dmInfo: { overflow: "hidden", flex: 1 },
    dmName: { fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    dmLast: { fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    onlineDot: { width: 8, height: 8, borderRadius: 99, background: "var(--success)", boxShadow: "0 0 0 4px rgba(37,213,106,0.15)" },
    requests: { background: "rgba(119,101,255,0.08)", borderRadius: 12, padding: 9, marginBottom: 10, border: "1px dashed rgba(119,101,255,0.42)" },
    smallTitle: { fontSize: "0.66rem", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4, color: "#bfc4ff" },
    reqItem: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem", padding: "4px 0" },
    checkBtn: { background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)", color: "#fff", border: "none", borderRadius: 8, padding: "4px 6px", cursor: "pointer" },
    logoutBtn: { margin: 10, padding: "0.75rem 0.9rem", borderTop: "1px solid rgba(143,150,210,0.14)", border: "1px solid rgba(143,150,210,0.24)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)", background: "rgba(20,26,47,0.45)", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600 },
    main: { flex: 1, minWidth: 0, position: "relative", padding: "1rem" },
    mainInner: { height: "calc(100vh - 2rem)", maxWidth: 1200, margin: "0 auto", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(143,150,210,0.2)", boxShadow: "0 20px 50px rgba(4,8,20,0.45)", background: "rgba(13,18,34,0.8)", backdropFilter: "blur(10px)" },
    mobileToggle: { position: "absolute", top: 16, left: 16, zIndex: 30, width: 36, height: 36, border: "1px solid rgba(143,150,210,0.25)", borderRadius: 10, background: "rgba(17,22,41,0.86)", color: "#d2d5ff", display: "flex", alignItems: "center", justifyContent: "center" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, animation: "fadeInFast 0.2s ease" },
    modal: { padding: "2rem", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 32px 64px rgba(0,0,0,0.4)" },
    modalTitle: { fontSize: "1.35rem", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" },
    modalSubtitle: { fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.1rem" },
    modalInputWrap: { position: "relative", display: "flex", alignItems: "center", marginBottom: "1rem" },
    modalIcon: { position: "absolute", left: 14, color: "#8990c5" },
    modalInput: { width: "100%", background: "#10162a", border: "1px solid #2c3764", padding: "0.85rem 1rem 0.85rem 3rem", borderRadius: 12, color: "#fff", outline: "none", fontSize: "1rem" },
    suggestBox: { background: "#0f1529", border: "1px solid #2d3763", borderRadius: 12, marginBottom: "1rem", overflow: "hidden" },
    suggestHint: { fontSize: "0.8rem", color: "#9ca3af", padding: "0.75rem 0.9rem" },
    suggestItem: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", color: "#fff", textAlign: "left", padding: "0.75rem 0.9rem", cursor: "pointer" },
    suggestNick: { fontSize: "0.9rem", fontWeight: 600 },
    suggestUser: { fontSize: "0.8rem", color: "#9ca3af" },
    modalActions: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: "1.2rem" },
    cancelBtn: { background: "none", border: "none", color: "#b0b6de", cursor: "pointer", fontSize: "0.92rem", fontWeight: 600 },
};
