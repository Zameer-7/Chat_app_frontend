"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Settings, LogOut, Plus, Search, UserCheck, Clock, AtSign, Menu, X, Crown, CheckSquare, Trash2, Users, MessageCircle } from "lucide-react";
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
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedDmIds, setSelectedDmIds] = useState<number[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
    const [lastDmAt, setLastDmAt] = useState<Record<number, string>>({});
    const [toasts, setToasts] = useState<Array<{ id: string; userId?: number; route?: string; title: string; body: string }>>([]);
    const [activeSidebarTab, setActiveSidebarTab] = useState<"friends" | "chats">("friends");

    const roomPath = (room: any) => `/chat/rooms/${room.room_id || room.id}`;
    const activeDmId = pathname.startsWith("/chat/dms/") ? Number(pathname.split("/").pop()) : null;

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
            const unreadFromApi: Record<number, number> = {};
            (d.data || []).forEach((conv: any) => {
                if (conv?.user?.id) unreadFromApi[conv.user.id] = Number(conv.unread_count || 0);
            });
            setUnreadCounts((prev) => ({ ...unreadFromApi, ...prev }));
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
        if (!activeDmId) return;
        setUnreadCounts((prev) => ({ ...prev, [activeDmId]: 0 }));
    }, [activeDmId]);

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
        if (typeof window === "undefined") return;
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const lastRef: { current: Record<number, string> } = { current: { ...lastDmAt } };
        const interval = setInterval(async () => {
            try {
                const res = await api.get("/dms");
                const conversations = Array.isArray(res.data) ? res.data : [];
                setDmConversations(conversations);
                setUnreadCounts((prev) => {
                    const next = { ...prev };
                    const nextLast = { ...lastRef.current };
                    for (const conv of conversations) {
                        const uid = conv?.user?.id;
                        if (!uid || !conv?.last_at) continue;
                        const last = String(conv.last_at);
                        if (!nextLast[uid]) {
                            nextLast[uid] = last;
                            continue;
                        }
                        if (nextLast[uid] !== last && activeDmId !== uid) {
                            next[uid] = Math.min((next[uid] || 0) + 1, 999);
                            const toastId = `${uid}-${Date.now()}`;
                            setToasts((t) => [...t, { id: toastId, userId: uid, route: `/chat/dms/${uid}`, title: conv.user.nickname, body: conv.last_message || "New message" }]);
                            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 4200);
                            if (typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
                                try {
                                    new Notification(conv.user.nickname, { body: conv.last_message || "New message" });
                                } catch {}
                            }
                        }
                        nextLast[uid] = last;
                    }
                    lastRef.current = nextLast;
                    setLastDmAt(nextLast);
                    return next;
                });
            } catch {}
        }, 7000);
        return () => clearInterval(interval);
    }, [user, activeDmId]);

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
            const roomCode = res.data?.room_id || res.data?.id;
            if (roomCode) {
                const toastId = `room-${Date.now()}`;
                setToasts((t) => [
                    ...t,
                    {
                        id: toastId,
                        route: roomPath(res.data),
                        title: "Room created",
                        body: `Code: ${roomCode}`,
                    },
                ]);
                setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 4200);
            }
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
    const chatIds = useMemo(() => new Set(dmConversations.map((c) => c.user?.id)), [dmConversations]);

    const toggleSelectDm = (id: number) => {
        setSelectedDmIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const bulkDeleteChats = async () => {
        if (selectedDmIds.length === 0) return;
        if (!confirm(`Delete ${selectedDmIds.length} selected chat(s)?`)) return;
        try {
            await api.post("/dms/conversations/bulk-delete", selectedDmIds);
            if (activeDmId && selectedDmIds.includes(activeDmId)) {
                router.push("/chat");
            }
            setSelectionMode(false);
            setSelectedDmIds([]);
            loadSidebarData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete selected chats");
        }
    };

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
                    <div style={styles.tabRow}>
                        <button style={{ ...styles.tabBtn, ...(activeSidebarTab === "friends" ? styles.tabBtnActive : {}) }} onClick={() => setActiveSidebarTab("friends")}><Users size={13} /> Friends</button>
                        <button style={{ ...styles.tabBtn, ...(activeSidebarTab === "chats" ? styles.tabBtnActive : {}) }} onClick={() => setActiveSidebarTab("chats")}><MessageCircle size={13} /> Chats</button>
                    </div>
                    <div style={styles.actionsRow}>
                        <button onClick={() => setShowAddFriend(true)} style={styles.secondaryBtn}><Search size={14} /> Add Friend</button>
                        {activeSidebarTab === "chats" && <button onClick={() => { setSelectionMode((v) => !v); setSelectedDmIds([]); }} style={styles.secondaryBtn}><CheckSquare size={14} /> Select</button>}
                    </div>
                    {activeSidebarTab === "chats" && selectionMode && (
                        <div style={styles.selectionBar}>
                            <span style={styles.selectionText}>{selectedDmIds.length} selected</span>
                            <button onClick={bulkDeleteChats} style={styles.dangerBtn}><Trash2 size={14} /> Delete</button>
                            <button onClick={() => { setSelectionMode(false); setSelectedDmIds([]); }} style={styles.secondaryBtn}>Cancel</button>
                        </div>
                    )}

                    {activeSidebarTab === "friends" && friendRequests.length > 0 && (
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

                    {activeSidebarTab === "friends" && (
                        <div style={styles.listWrap}>
                            {friends.filter((f) => chatIds.has(f.id)).map((f) => {
                                const active = pathname.includes(`/dms/${f.id}`);
                                const hasUnread = !!unreadCounts[f.id];
                                return (
                                    <Link
                                        key={f.id}
                                        href={`/chat/dms/${f.id}`}
                                        style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
                                        onClick={(e) => {
                                            if (selectionMode) {
                                                e.preventDefault();
                                                toggleSelectDm(f.id);
                                                return;
                                            }
                                            if (isMobile) setSidebarOpen(false);
                                        }}
                                    >
                                        <div style={styles.dmAvatar}>{f.nickname?.[0] || "?"}</div>
                                        <div style={styles.dmInfo}>
                                            <p style={{ ...styles.dmName, fontWeight: hasUnread ? 800 : 600 }}>{f.nickname}</p>
                                            <p style={styles.dmLast}>@{f.username}</p>
                                        </div>
                                        {!!unreadCounts[f.id] && <span style={styles.unreadBadge}>{unreadCounts[f.id] > 99 ? "99+" : unreadCounts[f.id]}</span>}
                                        <span style={{ ...styles.onlineDot, background: active ? "var(--success)" : "#8b93be", boxShadow: "none" }} />
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {activeSidebarTab === "chats" && (
                        <div style={styles.listWrap}>
                            {dmConversations.map((conv) => (
                                <Link
                                    key={conv.user.id}
                                    href={`/chat/dms/${conv.user.id}`}
                                    style={{ ...styles.navItem, ...(pathname.includes(`/dms/${conv.user.id}`) ? styles.navItemActive : {}) }}
                                    onClick={(e) => {
                                        if (selectionMode) {
                                            e.preventDefault();
                                            toggleSelectDm(conv.user.id);
                                            return;
                                        }
                                        if (isMobile) setSidebarOpen(false);
                                    }}
                                >
                                    {selectionMode && (
                                        <input
                                            type="checkbox"
                                            checked={selectedDmIds.includes(conv.user.id)}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleSelectDm(conv.user.id);
                                            }}
                                            readOnly
                                            style={styles.selectBox}
                                        />
                                    )}
                                    <div style={styles.dmAvatar}>{conv.user.nickname[0]}</div>
                                    <div style={styles.dmInfo}>
                                        <p style={{ ...styles.dmName, fontWeight: unreadCounts[conv.user.id] ? 800 : 600 }}>{conv.user.nickname}</p>
                                        <p style={styles.dmLast}>{conv.is_archived ? "[Archived] " : ""}{conv.last_message || "Start chatting"}</p>
                                    </div>
                                    {!!unreadCounts[conv.user.id] && <span style={styles.unreadBadge}>{unreadCounts[conv.user.id] > 99 ? "99+" : unreadCounts[conv.user.id]}</span>}
                                    {!friendMap.has(conv.user.id) && <span style={styles.chatTag}>Chat</span>}
                                </Link>
                            ))}
                        </div>
                    )}

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
            <div style={styles.toastWrap}>
                {toasts.map((t) => (
                    <button key={t.id} style={styles.toast} onClick={() => t.route && router.push(t.route)}>
                        <p style={styles.toastTitle}>{t.title}</p>
                        <p style={styles.toastBody}>{t.body}</p>
                    </button>
                ))}
            </div>
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
    tabRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 },
    tabBtn: { border: "1px solid rgba(119,101,255,0.28)", background: "rgba(119,101,255,0.08)", color: "#cdd2ff", borderRadius: 10, padding: "0.5rem 0.6rem", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" },
    tabBtnActive: { background: "linear-gradient(135deg, rgba(119,101,255,0.42), rgba(93,76,231,0.32))", color: "#fff", borderColor: "rgba(166,154,255,0.42)" },
    actionsRow: { display: "flex", gap: 8, marginBottom: 10 },
    secondaryBtn: { width: "100%", display: "flex", gap: 6, alignItems: "center", justifyContent: "center", background: "rgba(119,101,255,0.12)", color: "#ccd0ff", border: "1px solid rgba(119,101,255,0.35)", borderRadius: 10, padding: "0.56rem 0.7rem", fontWeight: 600, cursor: "pointer", transition: "all 0.25s ease" },
    selectionBar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
    selectionText: { fontSize: "0.78rem", color: "var(--text-muted)", minWidth: 70 },
    dangerBtn: { display: "flex", gap: 6, alignItems: "center", justifyContent: "center", background: "rgba(239,79,111,0.14)", color: "#ff9fb2", border: "1px solid rgba(239,79,111,0.45)", borderRadius: 10, padding: "0.56rem 0.7rem", fontWeight: 600, cursor: "pointer" },
    primaryCta: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
    listWrap: { display: "flex", flexDirection: "column", gap: 6 },
    navItem: { position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0.62rem 0.75rem", borderRadius: 12, textDecoration: "none", color: "var(--text-muted)", fontSize: "0.9rem", transition: "all 0.25s ease", border: "1px solid transparent" },
    navItemActive: { color: "#fff", background: "rgba(119,101,255,0.17)", borderColor: "rgba(119,101,255,0.42)", boxShadow: "inset 3px 0 0 0 var(--accent)" },
    roomHash: { width: 20, height: 20, borderRadius: 7, background: "rgba(119,101,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 },
    dmAvatar: { width: 24, height: 24, borderRadius: 8, background: "rgba(119,101,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 },
    selectBox: { width: 14, height: 14 },
    dmInfo: { overflow: "hidden", flex: 1 },
    dmName: { fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    dmLast: { fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    onlineDot: { width: 8, height: 8, borderRadius: 99, background: "var(--success)", boxShadow: "0 0 0 4px rgba(37,213,106,0.15)" },
    chatTag: { fontSize: 10, color: "#bfc4ff", border: "1px solid rgba(143,150,210,0.35)", borderRadius: 999, padding: "0.12rem 0.36rem" },
    unreadBadge: { minWidth: 18, height: 18, borderRadius: 99, padding: "0 5px", background: "#ef4f6f", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" },
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
    toastWrap: { position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 200 },
    toast: { minWidth: 240, maxWidth: 320, borderRadius: 12, border: "1px solid rgba(140,148,204,0.3)", background: "rgba(17,24,45,0.95)", color: "#fff", padding: "0.65rem 0.75rem", textAlign: "left", cursor: "pointer", animation: "fadeInFast 0.2s ease" },
    toastTitle: { fontSize: "0.84rem", fontWeight: 700, marginBottom: 2 },
    toastBody: { fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
};
