"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, Hash, Users, Edit2, Trash2, Check, X, Share2, Reply, SmilePlus, Paperclip, MoreHorizontal, Crown, UserX, DoorOpen, Flag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/lib/useWebSocket";
import api from "@/lib/api";

const REPLY_PREFIX = /^\[\[reply:(.+?)\]\]\n?/;

type ReplyMeta = {
    id: number;
    username: string;
    nickname: string;
    content: string;
};

function parseMessageContent(raw: string) {
    const match = raw.match(REPLY_PREFIX);
    if (!match) return { body: raw, reply: null as ReplyMeta | null, prefix: "" };
    try {
        const prefix = match[0];
        const reply = JSON.parse(decodeURIComponent(match[1])) as ReplyMeta;
        const body = raw.slice(prefix.length);
        return { body, reply, prefix };
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
    const [isTyping, setIsTyping] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const wsUrl = token ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/rooms/${roomId}?token=${token}` : null;
    const { messages, send, setMessages, connected } = useWebSocket(wsUrl);

    const isHost = room?.created_by === user?.id;

    const loadRoomData = async () => {
        const [msgRes, roomRes] = await Promise.all([
            api.get(`/rooms/${roomId}/messages`),
            api.get(`/rooms/${roomId}`),
        ]);
        setMessages(
            msgRes.data.map((m: any) => ({
                type: "message",
                ...m,
                user_nickname: m.user.nickname,
                user_username: m.user.username,
            }))
        );
        setRoom(roomRes.data);
    };

    useEffect(() => {
        api.post(`/rooms/${roomId}/join`).catch(() => {}).finally(loadRoomData);
    }, [roomId, setMessages]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const handleInputChange = (value: string) => {
        setInput(value);
        setIsTyping(value.trim().length > 0);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 1200);
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        send(buildMessageContent(input.trim(), replyingTo));
        setInput("");
        setReplyingTo(null);
        setIsTyping(false);
    };

    const handleDelete = async (msgId: number) => {
        if (!confirm("Delete this message?")) return;
        try {
            await api.delete(`/rooms/messages/${msgId}`);
            setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, content: "This message was deleted", is_deleted: true } : m)));
        } catch (err) {
            console.error(err);
        }
    };

    const startEdit = (msg: any) => {
        setEditingId(msg.id);
        setEditValue(parseMessageContent(String(msg.content || "")).body);
    };

    const handleEditSave = async (msgId: number) => {
        if (!editValue.trim()) return;
        try {
            const current = (messages as any[]).find((m) => m.id === msgId);
            const parsed = parseMessageContent(String(current?.content || ""));
            const payload = { content: `${parsed.prefix}${editValue.trim()}` };
            const res = await api.patch(`/rooms/messages/${msgId}`, payload);
            setMessages((prev) =>
                (prev as any[]).map((m) =>
                    m.id === msgId
                        ? {
                              ...m,
                              ...res.data,
                              type: "message",
                              user_nickname: m.user_nickname || res.data?.user?.nickname,
                              user_username: m.user_username || res.data?.user?.username,
                          }
                        : m
                )
            );
            setEditingId(null);
            setEditValue("");
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemoveUser = async (memberUserId: number) => {
        if (!confirm("Remove this user from room?")) return;
        try {
            await api.delete(`/rooms/${roomId}/members/${memberUserId}`);
            await loadRoomData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to remove user");
        }
    };

    const handleEndSession = async () => {
        if (!confirm("End room session for all users?")) return;
        try {
            await api.post(`/rooms/${roomId}/end`);
            router.push("/chat");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to end session");
        }
    };

    const handleDeleteRoom = async () => {
        if (!confirm("Delete this room permanently?")) return;
        try {
            await api.delete(`/rooms/${roomId}`);
            router.push("/chat");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete room");
        }
    };

    const handleLeave = async () => {
        try {
            await api.delete(`/rooms/${roomId}/leave`);
            router.push("/chat");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to leave room");
        }
    };

    if (!room) return <div style={s.center}>Loading room...</div>;

    return (
        <div style={s.container}>
            <header style={s.header} className="glass">
                <div style={s.headerLeft}>
                    <div style={s.roomBadge}><Hash size={16} /></div>
                    <div>
                        <h2 style={s.roomName}>{room.name}</h2>
                        <p style={s.roomSub}>Room ID: {room.room_id || room.id}</p>
                    </div>
                    <div style={{ ...s.connection, color: connected ? "var(--success)" : "var(--danger)" }}>
                        <span className="pulse-dot" style={{ ...s.dot, background: connected ? "var(--success)" : "var(--danger)" }} />
                        {connected ? "Live" : "Reconnecting"}
                    </div>
                </div>

                <div style={s.headerActions}>
                    <button style={s.iconBtn} onClick={() => navigator.clipboard.writeText(room.share_link || window.location.href)} title="Copy room link"><Share2 size={16} /></button>
                    <button style={s.iconBtn} onClick={() => setShowMembers((v) => !v)} title="Members"><Users size={16} /></button>
                    <span style={s.memberCount}>{room.members?.length || 0}</span>
                    <div style={{ position: "relative" }}>
                        <button style={s.iconBtn} onClick={() => setShowRoomMenu((v) => !v)} title="Room options"><MoreHorizontal size={16} /></button>
                        {showRoomMenu && (
                            <div style={s.dropdown} className="glass">
                                <button style={s.dropdownItem} onClick={handleLeave}><DoorOpen size={14} /> Leave Room</button>
                                {isHost && <button style={s.dropdownItem} onClick={handleEndSession}><Flag size={14} /> End Session</button>}
                                {isHost && <button style={{ ...s.dropdownItem, color: "#ff8b9f" }} onClick={handleDeleteRoom}><Trash2 size={14} /> Delete Room</button>}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div style={s.bodyWrap}>
                <div style={s.messageArea} ref={scrollRef}>
                    <div style={s.historyWall}>
                        <div style={s.welcomeCard}>
                            <div style={s.welcomeIcon}><Hash size={28} /></div>
                            <h1 style={s.welcomeTitle}>This is the beginning of your room.</h1>
                            <p style={s.welcomeSub}>Share the room link and start real-time collaboration.</p>
                        </div>

                        {(messages as any[]).map((m: any, i) => {
                            const isMe = m.user_id === user?.id;
                            const parsed = parseMessageContent(String(m.content || ""));

                            if (m.type === "system") {
                                return <div key={i} style={s.systemMsg}>{m.content}</div>;
                            }

                            const isEditing = editingId === m.id;
                            return (
                                <div key={i} style={{ ...s.msgRow, flexDirection: isMe ? "row-reverse" : "row", animation: "messageIn 0.25s ease" }}>
                                    <div style={{ ...s.avatar, background: isMe ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "#242d52" }}>
                                        {String(m.user_nickname || "?")[0].toUpperCase()}
                                    </div>

                                    <div style={{ ...s.msgCol, alignItems: isMe ? "flex-end" : "flex-start" }}>
                                        <div style={s.msgMeta}>
                                            {!isMe && <span style={s.msgUser}>{m.user_nickname}</span>}
                                            <span style={s.msgTime}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                            {!!m.updated_at && !m.is_deleted && <span style={s.editedTag}>edited</span>}
                                            {isMe && <span style={s.seenTag}>Seen</span>}
                                            <div style={s.msgActions}>
                                                {!m.is_deleted && !isEditing && <button onClick={() => setReplyingTo({ id: m.id, username: m.user_username || "", nickname: m.user_nickname || "User", content: parsed.body.slice(0, 120) })} style={s.actionBtn}><Reply size={12} /></button>}
                                                {isMe && !m.is_deleted && !isEditing && <button onClick={() => startEdit(m)} style={s.actionBtn}><Edit2 size={12} /></button>}
                                                {isMe && !m.is_deleted && !isEditing && <button onClick={() => handleDelete(m.id)} style={s.actionBtn}><Trash2 size={12} /></button>}
                                            </div>
                                        </div>

                                        {isEditing ? (
                                            <div style={s.editWrap}>
                                                <input style={s.editInput} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                                                <div style={s.editActions}>
                                                    <button onClick={() => handleEditSave(m.id)} style={s.actionBtn}><Check size={14} /></button>
                                                    <button onClick={() => setEditingId(null)} style={s.actionBtn}><X size={14} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ ...s.bubble, ...(isMe ? s.myBubble : s.otherBubble), opacity: m.is_deleted ? 0.6 : 1, fontStyle: m.is_deleted ? "italic" : "normal" }}>
                                                {parsed.reply && (
                                                    <div style={s.replyPreview}>
                                                        <p style={s.replyAuthor}>Reply to @{parsed.reply.username || parsed.reply.nickname}</p>
                                                        <p style={s.replyText}>{parsed.reply.content}</p>
                                                    </div>
                                                )}
                                                {parsed.body}
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
                        <div style={s.membersList}>
                            {(room.members || []).map((m: any) => (
                                <div key={m.id} style={s.memberRow}>
                                    <div style={s.memberInfo}>
                                        <div style={s.memberAvatar}>{m.nickname?.[0] || "?"}</div>
                                        <div>
                                            <p style={s.memberName}>{m.nickname} {m.role === "host" && <Crown size={12} color="#f7ce46" />}</p>
                                            <p style={s.memberUser}>@{m.username}</p>
                                        </div>
                                    </div>
                                    {isHost && m.id !== user?.id && (
                                        <button style={s.kickBtn} onClick={() => handleRemoveUser(m.id)}><UserX size={12} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </div>

            <form onSubmit={handleSend} style={s.inputArea} className="glass">
                {replyingTo && (
                    <div style={s.replyComposer}>
                        <div>
                            <p style={s.replyComposerTitle}>Replying to @{replyingTo.username || replyingTo.nickname}</p>
                            <p style={s.replyComposerText}>{replyingTo.content}</p>
                        </div>
                        <button type="button" style={s.actionBtn} onClick={() => setReplyingTo(null)}><X size={14} /></button>
                    </div>
                )}
                {isTyping && <p style={s.typing}>You are typing...</p>}
                <div style={s.inputRow}>
                    <button type="button" style={s.toolBtn}><SmilePlus size={16} /></button>
                    <button type="button" style={s.toolBtn}><Paperclip size={16} /></button>
                    <button type="button" style={s.toolBtn}>GIF</button>
                    <input value={input} onChange={(e) => handleInputChange(e.target.value)} placeholder={`Message #${room.name}`} style={s.input} autoFocus />
                    <button type="submit" disabled={!input.trim()} style={{ ...s.sendBtn, opacity: input.trim() ? 1 : 0.45 }}><Send size={18} /></button>
                </div>
            </form>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", height: "100%", background: "radial-gradient(circle at 15% -10%, rgba(119,101,255,0.14), transparent 45%), #0c1122" },
    header: { height: 72, flexShrink: 0, padding: "0 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(140,148,204,0.2)" },
    headerLeft: { display: "flex", alignItems: "center", gap: 12 },
    roomBadge: { width: 34, height: 34, borderRadius: 10, background: "rgba(119,101,255,0.16)", color: "#d4d8ff", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(119,101,255,0.35)" },
    roomName: { fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.1 },
    roomSub: { fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 },
    connection: { marginLeft: 10, display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", fontWeight: 700 },
    dot: { width: 8, height: 8, borderRadius: 99, display: "inline-block" },
    headerActions: { display: "flex", alignItems: "center", gap: 8 },
    memberCount: { fontSize: "0.82rem", color: "var(--text-muted)", minWidth: 18, textAlign: "center" },
    iconBtn: { width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(140,148,204,0.26)", background: "rgba(15,20,36,0.8)", color: "#c7ccff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    dropdown: { position: "absolute", right: 0, top: 40, minWidth: 180, borderRadius: 12, overflow: "hidden", zIndex: 20 },
    dropdownItem: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0.65rem 0.75rem", background: "transparent", border: "none", color: "#d6daff", fontSize: "0.85rem", textAlign: "left", cursor: "pointer" },
    bodyWrap: { flex: 1, minHeight: 0, display: "flex" },
    messageArea: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" },
    historyWall: { padding: "1rem 1.1rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.9rem" },
    welcomeCard: { padding: "1rem", borderRadius: 14, border: "1px solid rgba(140,148,204,0.18)", background: "rgba(18,24,45,0.58)", marginBottom: 8 },
    welcomeIcon: { width: 44, height: 44, borderRadius: 12, background: "rgba(119,101,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, color: "#d7dbff" },
    welcomeTitle: { fontSize: "1.1rem", fontWeight: 800, marginBottom: 2 },
    welcomeSub: { color: "var(--text-muted)", fontSize: "0.86rem" },
    msgRow: { display: "flex", gap: 10, maxWidth: "86%" },
    avatar: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0, border: "1px solid rgba(140,148,204,0.28)" },
    msgCol: { display: "flex", flexDirection: "column", gap: 4 },
    msgMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem" },
    msgUser: { fontWeight: 700, color: "#dfe2ff" },
    msgTime: { color: "var(--text-muted)" },
    editedTag: { color: "#bcc2ff", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" },
    seenTag: { color: "#7fd1ff", fontSize: "0.68rem" },
    msgActions: { display: "flex", gap: 2 },
    actionBtn: { border: "none", background: "transparent", color: "#aeb4e8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, padding: 3 },
    bubble: { padding: "0.7rem 0.9rem", borderRadius: 16, fontSize: "0.93rem", lineHeight: "1.45", color: "#fff", whiteSpace: "pre-wrap", boxShadow: "0 10px 18px rgba(5,8,20,0.35)" },
    myBubble: { background: "linear-gradient(138deg, #7a69ff 0%, #5f4de9 100%)", border: "1px solid rgba(170,160,255,0.45)" },
    otherBubble: { background: "linear-gradient(138deg, #242b4f 0%, #1a213f 100%)", border: "1px solid rgba(140,148,204,0.28)" },
    replyPreview: { borderLeft: "3px solid rgba(255,255,255,0.55)", paddingLeft: 8, marginBottom: 5 },
    replyAuthor: { fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.92)" },
    replyText: { fontSize: "0.78rem", color: "rgba(255,255,255,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 },
    editWrap: { width: "100%", borderRadius: 12, border: "1px solid rgba(140,148,204,0.3)", background: "rgba(20,26,47,0.75)", padding: 8 },
    editInput: { background: "#12182e", border: "1px solid #6352f0", borderRadius: 10, padding: "0.52rem 0.65rem", color: "#fff" },
    editActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 },
    systemMsg: { textAlign: "center", fontSize: "0.75rem", color: "#b2b9df", margin: "0.2rem 0", border: "1px solid rgba(140,148,204,0.18)", background: "rgba(21,27,48,0.45)", borderRadius: 999, width: "fit-content", alignSelf: "center", padding: "0.25rem 0.7rem" },
    membersPanel: { width: 280, flexShrink: 0, borderLeft: "1px solid rgba(140,148,204,0.18)", padding: "0.85rem" },
    membersTitle: { fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 },
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
    toolBtn: { minWidth: 34, height: 34, borderRadius: 10, border: "1px solid rgba(140,148,204,0.26)", background: "rgba(15,20,36,0.7)", color: "#b9c0f7", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, fontWeight: 700 },
    input: { flex: 1, background: "#11172b", border: "1px solid #2f3b66", borderRadius: 999, padding: "0.72rem 1rem", color: "#fff" },
    sendBtn: { width: 38, height: 38, border: "1px solid rgba(170,160,255,0.45)", borderRadius: 999, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    center: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" },
};
