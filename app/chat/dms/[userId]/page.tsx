"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Send, User, Edit2, Trash2, Check, X, Reply } from "lucide-react";
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

export default function DMChatPage() {
    const { userId } = useParams();
    const { user, token } = useAuth();
    const [otherUser, setOtherUser] = useState<any>(null);
    const [input, setInput] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<ReplyMeta | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const wsUrl = token ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/dms/${userId}?token=${token}` : null;
    const { messages, send, setMessages, connected } = useWebSocket(wsUrl);

    useEffect(() => {
        // Load history
        api.get(`/dms/${userId}`).then((res) => {
            setMessages(res.data.map((m: any) => ({
                type: "dm",
                ...m
            })));
        });
        // Find user details
        api.get("/friends/all").then((res) => {
            const found = (res.data as any[]).find(u => u.id === Number(userId));
            if (found) setOtherUser(found);
            else {
                // Fallback: fetch from direct user endpoint if not a friend? 
                // For now assume they are friends or in recent DMs
                api.get(`/users/search?q=`).then(res2 => {
                    const found2 = (res2.data as any[]).find(u => u.id === Number(userId));
                    if (found2) setOtherUser(found2);
                });
            }
        });
    }, [userId, setMessages]);

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
        if (!confirm("Delete this message?")) return;
        try {
            await api.delete(`/dms/messages/${msgId}`);
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
            const res = await api.patch(`/dms/messages/${msgId}`, payload);
            setMessages(prev => (prev as any[]).map(m => m.id === msgId ? { ...m, ...res.data, type: "dm" } : m));
            setEditingId(null);
            setEditValue("");
        } catch (err) {
            console.error(err);
        }
    };

    if (!otherUser) return <div style={s.center}>Loading...</div>;

    return (
        <div style={s.container}>
            {/* Header */}
            <header style={s.header}>
                <div style={s.headerInfo}>
                    <div style={s.avatarSmall}>{otherUser.nickname[0].toUpperCase()}</div>
                    <div style={s.headerText}>
                        <h2 style={s.roomName}>{otherUser.nickname}</h2>
                        <span style={s.usernameSmall}>@{otherUser.username}</span>
                    </div>
                </div>
                <div style={s.headerStatus}>
                    <div style={{ ...s.statusDot, background: connected ? "var(--success)" : "var(--danger)" }} />
                    <span style={s.statusText}>{connected ? "Connected" : "Reconnecting..."}</span>
                </div>
            </header>

            {/* Messages */}
            <div style={s.messageArea} ref={scrollRef}>
                <div style={s.historyWall}>
                    <div style={s.welcome}>
                        <div style={s.welcomeIcon}><User size={32} /></div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{otherUser.nickname}</h1>
                        <p style={{ color: 'var(--text-muted)' }}>This is the beginning of your legendary conversation with **@{otherUser.username}**.</p>
                    </div>

                    {(messages as any[]).map((m: any, i) => {
                        const isMe = m.sender_id === user?.id;
                        const isEditing = editingId === m.id;
                        const parsed = parseMessageContent(String(m.content || ""));

                        return (
                            <div key={i} style={{ ...s.msgRow, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                <div style={{ ...s.msgCol, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                    <div style={s.msgMeta}>
                                        <span style={s.msgTime}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        {!!m.updated_at && !m.is_deleted && <span style={s.editedTag}>edited</span>}
                                        {isMe && !m.is_deleted && !isEditing && (
                                            <div style={s.msgActions}>
                                                <button onClick={() => {
                                                    setReplyingTo({
                                                        id: m.id,
                                                        username: m.sender_username || user?.username || "",
                                                        nickname: m.sender_nickname || user?.nickname || "You",
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
                                                    username: otherUser.username || "",
                                                    nickname: otherUser.nickname || "User",
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
                                        <div style={{ ...s.bubble, background: isMe ? 'var(--accent)' : 'var(--bg-elevated)', opacity: m.is_deleted ? 0.6 : 1, fontStyle: m.is_deleted ? 'italic' : 'normal' }}>
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
                    placeholder={`Message @${otherUser.nickname}`}
                    autoFocus
                />
                <button type="submit" disabled={!input.trim()} style={s.sendBtn}><Send size={18} /></button>
                </div>
            </form>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-base)" },
    header: { height: 60, flexShrink: 0, padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" },
    headerInfo: { display: "flex", alignItems: "center", gap: 12 },
    headerText: { display: "flex", flexDirection: "column" },
    roomName: { fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" },
    usernameSmall: { fontSize: "0.75rem", color: "var(--text-muted)" },
    headerStatus: { display: "flex", alignItems: "center", gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: "50%" },
    statusText: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 },
    messageArea: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" },
    historyWall: { padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" },
    welcome: { marginBottom: "3rem", borderBottom: "1px solid var(--border)", paddingBottom: "2.5rem" },
    welcomeIcon: { width: 64, height: 64, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", color: "var(--accent)" },
    msgRow: { display: "flex", gap: 12, maxWidth: "85%" },
    msgCol: { display: "flex", flexDirection: "column", gap: 4 },
    msgMeta: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", height: 18 },
    msgTime: { color: "var(--text-muted)" },
    editedTag: { color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" },
    msgActions: { display: "flex", gap: 6, opacity: 0.6 },
    actionBtn: { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" },
    bubble: { padding: "0.75rem 1rem", borderRadius: 12, fontSize: "0.95rem", lineHeight: "1.5", color: "#fff", whiteSpace: "pre-wrap" },
    replyPreview: { borderLeft: "3px solid rgba(255,255,255,0.5)", paddingLeft: 8, marginBottom: 6, opacity: 0.9 },
    replyAuthor: { fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.9)" },
    replyText: { fontSize: "0.78rem", color: "rgba(255,255,255,0.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 },
    avatarSmall: { width: 36, height: 36, borderRadius: "30%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: 800, color: "#fff", flexShrink: 0 },
    editWrap: { display: "flex", flexDirection: "column", gap: 6, background: "var(--bg-elevated)", padding: 10, borderRadius: 10, width: "100%", border: "1px solid var(--accent)" },
    editInput: { background: "var(--bg-base)", border: "none", color: "#fff", padding: "6px", borderRadius: 6, outline: "none", fontSize: "0.95rem" },
    editActions: { display: "flex", justifyContent: "flex-end", gap: 10 },
    inputArea: { padding: "1.5rem", display: "flex", gap: "0.75rem", background: "var(--bg-base)", flexDirection: "column" },
    inputRow: { display: "flex", gap: "0.75rem" },
    replyComposer: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", borderRadius: 10, padding: "0.6rem 0.75rem" },
    replyComposerTitle: { fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)" },
    replyComposerText: { fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    replyCancel: { border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
    sendBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.1s" },
    center: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }
};
