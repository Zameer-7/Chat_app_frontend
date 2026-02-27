"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, Hash, Users, Edit2, Trash2, Check, X, Share2, Reply, SmilePlus, MoreHorizontal, Crown, UserX, DoorOpen, Flag, ArrowLeft, UserPlus, Search, Copy, Pin, Forward } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/lib/useWebSocket";
import api from "@/lib/api";

const REPLY_PREFIX = /^\[\[reply:(.+?)\]\]\n?/;
const REACTION_EMOJIS = ["\u2764\uFE0F", "\u{1F602}", "\u{1F44D}", "\u{1F525}"];
type ReplyMeta = { id: number; username: string; nickname: string; content: string };

function getWsBase() {
    const raw = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "https://chat-app-backend-kmr3.onrender.com";
    if (raw.startsWith("wss://") || raw.startsWith("ws://")) return raw;
    if (raw.startsWith("https://")) return raw.replace("https://", "wss://");
    if (raw.startsWith("http://")) return raw.replace("http://", "ws://");
    return "wss://chat-app-backend-kmr3.onrender.com";
}

function safeReactions(value: unknown): Record<string, number[]> {
    if (!value) return {};
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "object" && parsed ? parsed as Record<string, number[]> : {};
        } catch {
            return {};
        }
    }
    if (typeof value === "object") return value as Record<string, number[]>;
    return {};
}

function parseMessageContent(raw: string) {
    const match = raw.match(REPLY_PREFIX);
    if (!match) return { body: raw, reply: null as ReplyMeta | null, prefix: "" };
    try {
        const prefix = match[0];
        const reply = JSON.parse(decodeURIComponent(match[1])) as ReplyMeta;
        return { body: raw.slice(prefix.length), reply, prefix };
    } catch {
        return { body: raw, reply: null as ReplyMeta | null, prefix: "" };
    }
}

function buildMessageContent(body: string, reply: ReplyMeta | null) {
    if (!reply) return body;
    return `[[reply:${encodeURIComponent(JSON.stringify(reply))}]]\n${body}`;
}

export default function RoomChatPage() {
    const { roomId } = useParams();
    const router = useRouter();
    const { user, token } = useAuth();
    const [room, setRoom] = useState<any>(null);
    const [input, setInput] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<ReplyMeta | null>(null);
    const [showMembers, setShowMembers] = useState(false);
    const [showRoomMenu, setShowRoomMenu] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isTypingRemote, setIsTypingRemote] = useState(false);
    const [onlineIds, setOnlineIds] = useState<number[]>([]);
    const [addUsername, setAddUsername] = useState("");
    const [search, setSearch] = useState("");
    const [forwardToRoom, setForwardToRoom] = useState("");
    const [loadError, setLoadError] = useState("");
    const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
    const [openMessageMenuId, setOpenMessageMenuId] = useState<number | null>(null);
    const touchStartRef = useRef<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const wsBase = getWsBase();
    const wsUrl = token ? `${wsBase}/ws/rooms/${roomId}?token=${token}` : null;
    const { messages, send, sendJson, setMessages, connected } = useWebSocket(wsUrl);
    const isHost = room?.created_by === user?.id;

    const loadRoomData = async () => {
        try {
            const [msgRes, roomRes, onlineRes] = await Promise.allSettled([
                api.get(`/rooms/${roomId}/messages`),
                api.get(`/rooms/${roomId}`),
                api.get(`/rooms/${roomId}/online`),
            ]);
            if (msgRes.status !== "fulfilled" || roomRes.status !== "fulfilled") {
                throw new Error("Failed to load room history");
            }
            const rows = Array.isArray(msgRes.value.data) ? msgRes.value.data : [];
            setMessages(
                rows.map((m: any) => ({
                    type: m?.type || "message",
                    ...m,
                    user_nickname: m?.user?.nickname || m?.user_nickname || m?.user_name || "Unknown",
                    user_username: m?.user?.username || m?.user_username || "unknown",
                }))
            );
            setRoom(roomRes.value.data);
            if (onlineRes.status === "fulfilled") {
                setOnlineIds(onlineRes.value.data?.online_user_ids || []);
            } else {
                setOnlineIds([]);
            }
            setLoadError("");
        } catch (err: any) {
            setLoadError(err?.response?.data?.detail || "Failed to load room");
        }
    };

    useEffect(() => {
        api.post(`/rooms/${roomId}/join`).catch(() => {}).finally(() => { loadRoomData(); });
    }, [roomId, setMessages]);

    useEffect(() => {
        if (!messages.length) return;
        const latest = messages[messages.length - 1] as any;
        if (latest?.type === "presence" && Array.isArray(latest.online_user_ids)) setOnlineIds(latest.online_user_ids);
        if (latest?.type === "typing" && latest.sender_id !== user?.id) setIsTypingRemote(Boolean(latest.is_typing));
    }, [messages, user?.id]);

    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/chat"); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        send(buildMessageContent(input.trim(), replyingTo));
        setInput("");
        setReplyingTo(null);
        sendJson({ type: "typing", is_typing: false });
    };

    const handleDelete = async (msgId: number) => {
        await api.delete(`/rooms/messages/${msgId}`);
        setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, content: "This message was deleted", is_deleted: true } : m)));
    };

    const startEdit = (msg: any) => { setEditingId(msg.id); setEditValue(parseMessageContent(String(msg.content || "")).body); };
    const handleEditSave = async (msgId: number) => {
        const current = (messages as any[]).find((m) => m.id === msgId);
        const parsed = parseMessageContent(String(current?.content || ""));
        const res = await api.patch(`/rooms/messages/${msgId}`, { content: `${parsed.prefix}${editValue.trim()}` });
        setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, ...res.data, type: "message" } : m)));
        setEditingId(null);
        setEditValue("");
    };
    const react = async (id: number, emoji: string) => {
        const res = await api.patch(`/rooms/messages/${id}/react`, { emoji });
        setMessages((prev) => (prev as any[]).map((m) => (m.id === id ? { ...m, ...res.data, type: "message" } : m)));
    };
    const pin = async (id: number) => {
        const res = await api.patch(`/rooms/messages/${id}/pin`);
        setMessages((prev) => (prev as any[]).map((m) => (m.id === id ? { ...m, ...res.data, type: "message" } : m)));
    };
    const forward = async (id: number) => {
        await api.post(`/rooms/messages/${id}/forward`, { to_room_id: forwardToRoom || roomId });
        setForwardToRoom("");
    };
    const copyMessage = async (m: any) => navigator.clipboard.writeText(parseMessageContent(String(m.content || "")).body);

    const handleRemoveUser = async (memberUserId: number) => { await api.delete(`/rooms/${roomId}/members/${memberUserId}`); await loadRoomData(); };
    const handleAddMember = async () => { if (!addUsername.trim()) return; await api.post(`/rooms/${roomId}/members/by-username/${addUsername.trim().toLowerCase()}`); setAddUsername(""); await loadRoomData(); };
    const handleEndSession = async () => { await api.post(`/rooms/${roomId}/end`); router.push("/chat"); };
    const handleDeleteRoom = async () => { await api.delete(`/rooms/${roomId}`); router.push("/chat"); };
    const handleLeave = async () => { await api.delete(`/rooms/${roomId}/leave`); router.push("/chat"); };

    if (!room) return <div style={s.center}>{loadError || "Loading room..."}</div>;

    const shareCopy = async () => {
        const link = `${window.location.origin}/chat/rooms/${room.room_id || room.id}`;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (messages as any[]).filter((m) => m.type === "message" || m.type === "system").filter((m) => !q || String(m.content || "").toLowerCase().includes(q));
    }, [messages, search]);

    return (
        <div style={s.container} onTouchStart={(e) => { touchStartRef.current = e.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(e) => {
            if (touchStartRef.current == null) return;
            if ((e.changedTouches[0]?.clientX ?? 0) - touchStartRef.current > 80) router.push("/chat");
            touchStartRef.current = null;
        }}>
            <header style={s.header} className="glass">
                <div style={s.headerLeft}>
                    <button style={s.iconBtn} onClick={() => router.push("/chat")}><ArrowLeft size={16} /></button>
                    <div style={s.roomBadge}><Hash size={16} /></div>
                    <div><h2 style={s.roomName}>{room.name}</h2><p style={s.roomSub}>Room ID: {room.room_id || room.id}</p></div>
                    <div style={{ ...s.connection, color: connected ? "var(--success)" : "var(--danger)" }}><span className="pulse-dot" style={{ ...s.dot, background: connected ? "var(--success)" : "var(--danger)" }} />{connected ? "Online" : "Offline"}</div>
                </div>
                <div style={s.headerActions}>
                    <button style={s.iconBtn} onClick={shareCopy}>{copied ? <Check size={16} /> : <Share2 size={16} />}</button>
                    <button style={s.iconBtn} onClick={() => setShowMembers((v) => !v)}><Users size={16} /></button>
                    <span style={s.memberCount}>{onlineIds.length}/{room.members?.length || 0}</span>
                    <div style={{ position: "relative" }}>
                        <button style={s.iconBtn} onClick={() => setShowRoomMenu((v) => !v)}><MoreHorizontal size={16} /></button>
                        {showRoomMenu && <div style={s.dropdown} className="glass"><button style={s.dropdownItem} onClick={handleLeave}><DoorOpen size={14} /> Leave Room</button>{isHost && <button style={s.dropdownItem} onClick={handleEndSession}><Flag size={14} /> End Session</button>}{isHost && <button style={{ ...s.dropdownItem, color: "#ff8b9f" }} onClick={handleDeleteRoom}><Trash2 size={14} /> Delete Room</button>}</div>}
                    </div>
                </div>
            </header>

            <div style={s.searchBar}><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inside room" style={s.searchInput} /></div>

            <div style={s.bodyWrap}>
                <div style={s.messageArea} ref={scrollRef}>
                    <div style={s.historyWall}>
                        {filtered.map((m: any, i) => {
                            const isMe = m.user_id === user?.id;
                            if (m.type === "system") return <div key={i} style={s.systemMsg}>{m.content}</div>;
                            const parsed = parseMessageContent(String(m.content || ""));
                            const reactions = safeReactions(m.reactions);
                            return (
                                <div key={`${m.id}-${i}`} style={{ ...s.msgRow, flexDirection: isMe ? "row-reverse" : "row" }}>
                                    <div style={{ ...s.avatar, background: isMe ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "#242d52" }}>{String(m.user_nickname || "?")[0].toUpperCase()}</div>
                                    <div style={{ ...s.msgCol, alignItems: isMe ? "flex-end" : "flex-start" }}>
                                        <div style={s.msgMeta}>
                                            {!isMe && <span style={s.msgUser}>{m.user_nickname}</span>}
                                            <span style={s.msgTime}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                            {!!m.updated_at && !m.is_deleted && <span style={s.editedTag}>edited</span>}
                                        </div>
                                        {editingId === m.id ? (
                                            <div style={s.editWrap}><input style={s.editInput} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus /><div style={s.editActions}><button onClick={() => handleEditSave(m.id)} style={s.actionBtn}><Check size={14} /></button><button onClick={() => setEditingId(null)} style={s.actionBtn}><X size={14} /></button></div></div>
                                        ) : (
                                            <div style={s.messageWrap} onMouseEnter={() => setHoveredMessageId(m.id)} onMouseLeave={() => setHoveredMessageId((curr) => (curr === m.id ? null : curr))}>
                                                <div style={{ ...s.bubble, ...(isMe ? s.myBubble : s.otherBubble), opacity: m.is_deleted ? 0.6 : 1, fontStyle: m.is_deleted ? "italic" : "normal" }}>
                                                    {parsed.reply && <div style={s.replyPreview}><p style={s.replyAuthor}>Reply to @{parsed.reply.username || parsed.reply.nickname}</p><p style={s.replyText}>{parsed.reply.content}</p></div>}
                                                    {parsed.body}
                                                </div>
                                                {(hoveredMessageId === m.id || openMessageMenuId === m.id) && !m.is_deleted && (
                                                    <div style={s.reactionRow}>
                                                        {REACTION_EMOJIS.slice(0, 3).map((emoji) => <button key={emoji} style={s.reactionBtn} onClick={() => react(m.id, emoji)}>{emoji}</button>)}
                                                        <div style={{ position: "relative" }}>
                                                            <button style={s.reactionGhost} onClick={() => setOpenMessageMenuId((curr) => curr === m.id ? null : m.id)}><MoreHorizontal size={12} /></button>
                                                            {openMessageMenuId === m.id && (
                                                                <div style={s.msgMenu}>
                                                                    <button style={s.menuItem} onClick={() => { setReplyingTo({ id: m.id, username: m.user_username || "", nickname: m.user_nickname || "User", content: parsed.body.slice(0, 120) }); setOpenMessageMenuId(null); }}><Reply size={12} /> Reply</button>
                                                                    <button style={s.menuItem} onClick={() => { copyMessage(m); setOpenMessageMenuId(null); }}><Copy size={12} /> Copy</button>
                                                                    <button style={s.menuItem} onClick={() => { pin(m.id); setOpenMessageMenuId(null); }}><Pin size={12} /> Pin</button>
                                                                    <button style={s.menuItem} onClick={() => { forward(m.id); setOpenMessageMenuId(null); }}><Forward size={12} /> Forward</button>
                                                                    {isMe && <button style={s.menuItem} onClick={() => { startEdit(m); setOpenMessageMenuId(null); }}><Edit2 size={12} /> Edit</button>}
                                                                    {isMe && <button style={{ ...s.menuItem, color: "#ff9fb2" }} onClick={() => { handleDelete(m.id); setOpenMessageMenuId(null); }}><Trash2 size={12} /> Delete</button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {Object.entries(reactions).map(([emoji, users]) => {
                                                            const count = Array.isArray(users) ? users.length : 0;
                                                            if (count <= 0) return null;
                                                            return <span key={`count-${emoji}`} style={s.reactionCount}>{emoji} {count}</span>;
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {showMembers && (
                    <aside style={s.membersPanel} className="glass">
                        <h3 style={s.membersTitle}>Members</h3>
                        <div style={s.memberAdd}><input style={s.memberInput} placeholder="username" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} /><button style={s.kickBtn} onClick={handleAddMember}><UserPlus size={12} /></button></div>
                        <div style={s.membersList}>
                            {(room.members || []).map((m: any) => {
                                const isOnline = onlineIds.includes(m.id);
                                return (
                                    <div key={m.id} style={s.memberRow}>
                                        <div style={s.memberInfo}>
                                            <div style={s.memberAvatar}>{m.nickname?.[0] || "?"}</div>
                                            <div><p style={s.memberName}>{m.nickname} {m.role === "host" && <Crown size={12} color="#f7ce46" />}</p><p style={s.memberUser}>@{m.username}</p></div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 99, background: isOnline ? "var(--success)" : "var(--danger)" }} />
                                            {isHost && m.id !== user?.id && <button style={s.kickBtn} onClick={() => handleRemoveUser(m.id)}><UserX size={12} /></button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>
                )}
            </div>

            <form onSubmit={handleSend} style={s.inputArea} className="glass">
                {replyingTo && <div style={s.replyComposer}><div><p style={s.replyComposerTitle}>Replying to @{replyingTo.username || replyingTo.nickname}</p><p style={s.replyComposerText}>{replyingTo.content}</p></div><button type="button" style={s.actionBtn} onClick={() => setReplyingTo(null)}><X size={14} /></button></div>}
                {isTypingRemote && <p style={s.typing}>Someone is typing...</p>}
                <div style={s.inputRow}>
                    <button type="button" style={s.toolBtn} onClick={() => setShowEmoji((v) => !v)}><SmilePlus size={16} /></button>
                    <input value={input} onChange={(e) => { setInput(e.target.value); sendJson({ type: "typing", is_typing: e.target.value.trim().length > 0 }); }} placeholder={`Message #${room.name}`} style={s.input} autoFocus />
                    <input value={forwardToRoom} onChange={(e) => setForwardToRoom(e.target.value)} placeholder="Room code" style={{ ...s.input, maxWidth: 120 }} />
                    <button type="submit" disabled={!input.trim()} style={{ ...s.sendBtn, opacity: input.trim() ? 1 : 0.45 }}><Send size={18} /></button>
                </div>
                {showEmoji && <div style={s.emojiWrap}>{["\u{1F600}", "\u{1F602}", "\u{1F60D}", "\u{1F973}", "\u{1F525}", "\u{1F44D}", "\u{1F64F}", "\u2764\uFE0F", "\u{1F60E}", "\u{1F91D}", "\u{1F389}", "\u{1F680}", "\u{1F605}", "\u{1F622}", "\u{1F914}", "\u{1F64C}"].map((e) => <button key={e} type="button" style={s.emojiBtn} onClick={() => setInput((p) => `${p}${e}`)}>{e}</button>)}</div>}
            </form>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", height: "100%", background: "radial-gradient(circle at 15% -10%, rgba(119,101,255,0.14), transparent 45%), var(--bg-base)" },
    header: { height: 72, flexShrink: 0, padding: "0 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(140,148,204,0.2)" },
    headerLeft: { display: "flex", alignItems: "center", gap: 12 },
    roomBadge: { width: 34, height: 34, borderRadius: 10, background: "rgba(119,101,255,0.16)", color: "#d4d8ff", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(119,101,255,0.35)" },
    roomName: { fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.1 },
    roomSub: { fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 },
    connection: { marginLeft: 10, display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", fontWeight: 700 },
    dot: { width: 8, height: 8, borderRadius: 99, display: "inline-block" },
    headerActions: { display: "flex", alignItems: "center", gap: 8 },
    memberCount: { fontSize: "0.82rem", color: "var(--text-muted)", minWidth: 28, textAlign: "center" },
    iconBtn: { width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(140,148,204,0.26)", background: "rgba(15,20,36,0.8)", color: "#c7ccff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    dropdown: { position: "absolute", right: 0, top: 40, minWidth: 180, borderRadius: 12, overflow: "hidden", zIndex: 20 },
    dropdownItem: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0.65rem 0.75rem", background: "transparent", border: "none", color: "#d6daff", fontSize: "0.85rem", textAlign: "left", cursor: "pointer" },
    searchBar: { height: 42, borderBottom: "1px solid rgba(140,148,204,0.14)", display: "flex", alignItems: "center", gap: 8, padding: "0 0.8rem", color: "var(--text-muted)" },
    searchInput: { background: "transparent", border: "none", borderRadius: 0, boxShadow: "none", padding: 0, color: "var(--text-primary)" },
    bodyWrap: { flex: 1, minHeight: 0, display: "flex" },
    messageArea: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" },
    historyWall: { padding: "1rem 1.1rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.9rem" },
    msgRow: { display: "flex", gap: 10, maxWidth: "86%" },
    avatar: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0, border: "1px solid rgba(140,148,204,0.28)" },
    msgCol: { display: "flex", flexDirection: "column", gap: 4 },
    msgMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem" },
    msgUser: { fontWeight: 700, color: "#dfe2ff" },
    msgTime: { color: "var(--text-muted)" },
    editedTag: { color: "#bcc2ff", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" },
    actionBtn: { border: "none", background: "transparent", color: "#aeb4e8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, padding: 3 },
    messageWrap: { position: "relative", display: "flex", flexDirection: "column", alignItems: "inherit", gap: 6 },
    bubble: { padding: "0.7rem 0.9rem", borderRadius: 16, fontSize: "0.93rem", lineHeight: "1.45", color: "#fff", whiteSpace: "pre-wrap", boxShadow: "0 10px 18px rgba(5,8,20,0.35)" },
    myBubble: { background: "linear-gradient(138deg, #7a69ff 0%, #5f4de9 100%)", border: "1px solid rgba(170,160,255,0.45)" },
    otherBubble: { background: "linear-gradient(138deg, #242b4f 0%, #1a213f 100%)", border: "1px solid rgba(140,148,204,0.28)" },
    replyPreview: { borderLeft: "3px solid rgba(255,255,255,0.55)", paddingLeft: 8, marginBottom: 5 },
    replyAuthor: { fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.92)" },
    replyText: { fontSize: "0.78rem", color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 },
    reactionRow: { display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap", alignItems: "center" },
    reactionBtn: { border: "1px solid rgba(255,255,255,0.2)", background: "rgba(11,16,34,0.32)", color: "#fff", borderRadius: 999, padding: "0.1rem 0.4rem", fontSize: 11, cursor: "pointer" },
    reactionGhost: { border: "1px solid rgba(255,255,255,0.2)", background: "rgba(11,16,34,0.32)", color: "#dbe1ff", borderRadius: 999, padding: "0.12rem 0.34rem", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
    reactionCount: { border: "1px solid rgba(255,255,255,0.25)", background: "rgba(11,16,34,0.34)", color: "#fff", borderRadius: 999, padding: "0.1rem 0.38rem", fontSize: 11 },
    msgMenu: { position: "absolute", top: 26, right: 0, minWidth: 142, zIndex: 35, borderRadius: 10, background: "rgba(15,20,36,0.95)", border: "1px solid rgba(140,148,204,0.3)", padding: 4 },
    menuItem: { width: "100%", border: "none", background: "transparent", color: "#d8dbff", padding: "0.45rem 0.5rem", textAlign: "left", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
    editWrap: { width: "100%", borderRadius: 12, border: "1px solid rgba(140,148,204,0.3)", background: "rgba(20,26,47,0.75)", padding: 8 },
    editInput: { background: "#12182e", border: "1px solid #6352f0", borderRadius: 10, padding: "0.52rem 0.65rem", color: "#fff" },
    editActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 },
    systemMsg: { textAlign: "center", fontSize: "0.75rem", color: "#b2b9df", margin: "0.2rem 0", border: "1px solid rgba(140,148,204,0.18)", background: "rgba(21,27,48,0.45)", borderRadius: 999, width: "fit-content", alignSelf: "center", padding: "0.25rem 0.7rem" },
    membersPanel: { width: 290, flexShrink: 0, borderLeft: "1px solid rgba(140,148,204,0.18)", padding: "0.85rem" },
    membersTitle: { fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 },
    memberAdd: { display: "flex", gap: 6, marginBottom: 8 },
    memberInput: { flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 9, padding: "0.45rem 0.6rem", fontSize: 12 },
    membersList: { display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: "100%" },
    memberRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, padding: "0.5rem", border: "1px solid rgba(140,148,204,0.15)", background: "rgba(18,24,45,0.52)" },
    memberInfo: { display: "flex", alignItems: "center", gap: 8 },
    memberAvatar: { width: 28, height: 28, borderRadius: 9, background: "rgba(119,101,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 },
    memberName: { display: "flex", alignItems: "center", gap: 4, fontSize: "0.84rem", fontWeight: 700 },
    memberUser: { fontSize: "0.72rem", color: "var(--text-muted)" },
    kickBtn: { width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(239,79,111,0.4)", background: "rgba(239,79,111,0.12)", color: "#ff9fb2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    inputArea: { borderTop: "1px solid rgba(140,148,204,0.2)", padding: "0.7rem 0.9rem", display: "flex", flexDirection: "column", gap: 6 },
    replyComposer: { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(140,148,204,0.26)", background: "rgba(18,24,45,0.65)", borderRadius: 10, padding: "0.45rem 0.6rem" },
    replyComposerTitle: { fontSize: "0.73rem", fontWeight: 700, color: "#c7ccff" },
    replyComposerText: { fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    typing: { fontSize: "0.74rem", color: "#c0c6f6", marginLeft: 5 },
    inputRow: { display: "flex", alignItems: "center", gap: 8 },
    toolBtn: { minWidth: 34, height: 34, borderRadius: 10, border: "1px solid rgba(140,148,204,0.26)", background: "rgba(15,20,36,0.7)", color: "#b9c0f7", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    input: { flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.72rem 1rem", color: "var(--text-primary)" },
    sendBtn: { width: 38, height: 38, border: "1px solid rgba(170,160,255,0.45)", borderRadius: 999, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    emojiWrap: { display: "flex", flexWrap: "wrap", gap: 6, border: "1px solid rgba(140,148,204,0.2)", background: "rgba(13,18,34,0.75)", borderRadius: 12, padding: 8 },
    emojiBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(140,148,204,0.2)", background: "rgba(20,27,48,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    center: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" },
};


