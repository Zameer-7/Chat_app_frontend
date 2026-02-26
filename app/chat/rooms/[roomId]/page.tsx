"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Send, Hash, Users, Edit2, Trash2, Check, X, Share2, Reply } from "lucide-react";
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
    const { user, token } = useAuth();
    const [room, setRoom] = useState<any>(null);
    const [input, setInput] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<ReplyMeta | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const wsUrl = token ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/rooms/${roomId}?token=${token}` : null;
    const { messages, send, setMessages, connected } = useWebSocket(wsUrl);

    useEffect(() => {
        // Load history
        api.get(`/rooms/${roomId}/messages`).then((res) => {
            setMessages(res.data.map((m: any) => ({
                type: "message",
                ...m,
                user_nickname: m.user.nickname,
                user_username: m.user.username
            })));
        });
        // Load room details
        api.get(`/rooms/${roomId}`).then((res) => setRoom(res.data));
    }, [roomId, setMessages]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        send(buildMessageContent(input.trim(), replyingTo));
        setInput("");
        setReplyingTo(null);
    };

    const handleDelete = async (msgId: number) => {
        if (!confirm("Are you sure you want to delete this message?")) return;
        try {
            await api.delete(`/rooms/messages/${msgId}`);
            setMessages(prev => (prev as any[]).map(m => m.id === msgId ? { ...m, content: "This message was deleted", is_deleted: true } : m));
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
            setMessages(prev => (prev as any[]).map(m => m.id === msgId ? {
                ...m,
                ...res.data,
                type: "message",
                user_nickname: m.user_nickname || res.data?.user?.nickname,
                user_username: m.user_username || res.data?.user?.username
            } : m));
            setEditingId(null);
            setEditValue("");
        } catch (err) {
            console.error(err);
        }
    };

    if (!room) return <div style={s.center}>Loading...</div>;

    return (
        <div style={s.container}>
            {/* Header */}
            <header style={s.header}>
                <div style={s.headerInfo}>
                    <Hash size={20} color="var(--text-muted)" />
                    <h2 style={s.roomName}>{room.name}</h2>
                    <div style={{ ...s.badge, color: connected ? "var(--success)" : "var(--danger)" }}>
                        {connected ? "Connected" : "Reconnecting..."}
                    </div>
                </div>
                <div style={s.headerActions}>
                    <button style={s.iconBtn} onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Room link copied to clipboard!");
                    }} title="Copy share link">
                        <Share2 size={16} />
                    </button>
                    <div style={s.vDivider} />
                    <Users size={18} color="var(--text-muted)" />
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{room.members?.length || 0}</span>
                </div>
            </header>

            {/* Messages */}
            <div style={s.messageArea} ref={scrollRef}>
                <div style={s.historyWall}>
                    <div style={s.welcome}>
                        <div style={s.welcomeIcon}><Hash size={40} /></div>
                        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fff" }}>Welcome to #{room.name}!</h1>
                        <p style={{ color: "var(--text-muted)", fontSize: "1.05rem" }}>
                            This is the beginning of the #{room.name} channel.
                        </p>
                    </div>

                    {(messages as any[]).map((m: any, i) => {
                        const isMe = m.user_id === user?.id;
                        const parsed = parseMessageContent(String(m.content || ""));
                        if (m.type === "system") {
                            return <div key={i} style={s.systemMsg}>{m.content}</div>;
                        }

                        const isEditing = editingId === m.id;

                        return (
                            <div key={i} style={{ ...s.msgRow, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                <div style={{ ...s.avatar, background: isMe ? 'var(--accent)' : 'var(--bg-elevated)' }}>
                                    {String(m.user_nickname || m.user_name || '?')[0].toUpperCase()}
                                </div>
                                <div style={{ ...s.msgCol, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                    <div style={s.msgMeta}>
                                        {!isMe && <span style={s.msgUser}>{m.user_nickname || m.user_name}</span>}
                                        <span style={s.msgTime}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        {!!m.updated_at && !m.is_deleted && <span style={s.editedTag}>edited</span>}
                                        {isMe && !m.is_deleted && !isEditing && (
                                            <div style={s.msgActions}>
                                                <button onClick={() => {
                                                    setReplyingTo({
                                                        id: m.id,
                                                        username: m.user_username || "",
                                                        nickname: m.user_nickname || "User",
                                                        content: parsed.body.slice(0, 120)
                                                    });
                                                }} style={s.actionBtn}><Reply size={12} /></button>
                                                <button onClick={() => startEdit(m)} style={s.actionBtn}><Edit2 size={12} /></button>
                                                <button onClick={() => handleDelete(m.id)} style={s.actionBtn}><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                        {!isMe && !m.is_deleted && !isEditing && (
                                            <button onClick={() => {
                                                setReplyingTo({
                                                    id: m.id,
                                                    username: m.user_username || "",
                                                    nickname: m.user_nickname || "User",
                                                    content: parsed.body.slice(0, 120)
                                                });
                                            }} style={s.actionBtn}><Reply size={12} /></button>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <div style={s.editWrap}>
                                            <input
                                                style={s.editInput}
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                autoFocus
                                            />
                                            <div style={s.editActions}>
                                                <button onClick={() => handleEditSave(m.id)}><Check size={14} /></button>
                                                <button onClick={() => setEditingId(null)}><X size={14} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ ...s.bubble, background: isMe ? s.myBubble.background : s.otherBubble.background, opacity: m.is_deleted ? 0.6 : 1, fontStyle: m.is_deleted ? 'italic' : 'normal' }}>
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

            {/* Input */}
            <form onSubmit={handleSend} style={s.inputArea}>
                {replyingTo && (
                    <div style={s.replyComposer}>
                        <div>
                            <p style={s.replyComposerTitle}>Replying to @{replyingTo.username || replyingTo.nickname}</p>
                            <p style={s.replyComposerText}>{replyingTo.content}</p>
                        </div>
                        <button type="button" style={s.replyCancel} onClick={() => setReplyingTo(null)}><X size={14} /></button>
                    </div>
                )}
                <div style={s.inputRow}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Message #${room.name}`}
                    autoFocus
                />
                <button type="submit" disabled={!input.trim()} style={s.sendBtn}><Send size={18} /></button>
                </div>
            </form>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", height: "100%", background: "radial-gradient(circle at 20% 0%, #17132f 0%, #0b0f1f 55%, #090d19 100%)" },
    header: { height: 64, flexShrink: 0, padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #2f2b5a", background: "linear-gradient(180deg, #161334 0%, #111027 100%)" },
    headerInfo: { display: "flex", alignItems: "center", gap: 10 },
    roomName: { fontWeight: 700, fontSize: "1rem" },
    badge: { fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" },
    headerActions: { display: "flex", alignItems: "center", gap: 12 },
    vDivider: { width: 1, height: 20, background: "var(--border)", margin: "0 4px" },
    iconBtn: { background: "#1f1a3e", border: "1px solid #2f2b5a", color: "#c6c8ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8 },
    messageArea: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" },
    historyWall: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
    welcome: { marginBottom: "2rem", borderBottom: "1px solid #2f2b5a", paddingBottom: "2rem" },
    welcomeIcon: { width: 64, height: 64, borderRadius: "18px", background: "linear-gradient(145deg, #2a2356 0%, #1b1738 100%)", color: "#d8d9ff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem", border: "1px solid #3a3472" },
    msgRow: { display: "flex", gap: 12, maxWidth: "80%" },
    msgCol: { display: "flex", flexDirection: "column", gap: 4 },
    msgMeta: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", height: 20 },
    msgUser: { fontWeight: 700, color: "var(--text-primary)" },
    msgTime: { color: "#9ea3d9" },
    editedTag: { color: "#b9beff", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 },
    msgActions: { display: "flex", gap: 4, opacity: 0.8 },
    actionBtn: { background: "none", border: "none", color: "#aeb3f1", cursor: "pointer", padding: 2 },
    bubble: { padding: "0.65rem 0.95rem", borderRadius: 14, fontSize: "0.95rem", lineHeight: "1.5", color: "#fff", whiteSpace: "pre-wrap", border: "1px solid #3c3a70", boxShadow: "0 6px 16px rgba(8, 8, 18, 0.35)" },
    myBubble: { background: "linear-gradient(140deg, #6f63ff 0%, #5d52e9 100%)" },
    otherBubble: { background: "linear-gradient(140deg, #27224f 0%, #1f1c3f 100%)" },
    replyPreview: { borderLeft: "3px solid rgba(255,255,255,0.5)", paddingLeft: 8, marginBottom: 6, opacity: 0.9 },
    replyAuthor: { fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.9)" },
    replyText: { fontSize: "0.78rem", color: "rgba(255,255,255,0.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 },
    avatar: { width: 36, height: 36, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0, border: "1px solid #43407a" },
    systemMsg: { textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.5rem 0", textTransform: "uppercase", letterSpacing: "0.05em" },
    editWrap: { display: "flex", flexDirection: "column", gap: 4, background: "#221e45", padding: 8, borderRadius: 8, width: "100%", border: "1px solid #3c3a70" },
    editInput: { background: "#0f1326", border: "1px solid #6f63ff", color: "#fff", padding: "6px 10px", borderRadius: 6, outline: "none" },
    editActions: { display: "flex", justifyContent: "flex-end", gap: 8 },
    inputArea: { padding: "1.2rem 1.5rem 1.5rem", display: "flex", gap: "0.75rem", background: "linear-gradient(180deg, rgba(18,16,40,0.8) 0%, #0f1324 100%)", borderTop: "1px solid #2f2b5a", flexDirection: "column" },
    inputRow: { display: "flex", gap: "0.75rem" },
    replyComposer: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #3c3a70", background: "#1e1a3d", borderRadius: 10, padding: "0.6rem 0.75rem" },
    replyComposerTitle: { fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)" },
    replyComposerText: { fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    replyCancel: { border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
    sendBtn: { background: "linear-gradient(140deg, #7468ff 0%, #5d52e9 100%)", color: "#fff", border: "1px solid #7d73ff", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.1s" },
    center: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }
};
