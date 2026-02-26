"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, Edit2, Trash2, Check, X, Reply, Smile, ArrowLeft, Search, MoreVertical, Copy, Pin, Forward, Archive, BellOff, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/lib/useWebSocket";
import api from "@/lib/api";

const REPLY_PREFIX = /^\[\[reply:(.+?)\]\]\n?/;
const REACTION_EMOJIS = ["\u2764\uFE0F", "\u{1F602}", "\u{1F44D}", "\u{1F525}"];

type ReplyMeta = { id: number; username: string; nickname: string; content: string };

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

export default function DMChatPage() {
    const { userId } = useParams();
    const router = useRouter();
    const { user, token } = useAuth();
    const [otherUser, setOtherUser] = useState<any>({ nickname: "User", username: "user", show_online_status: true });
    const [input, setInput] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<ReplyMeta | null>(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const [isTypingRemote, setIsTypingRemote] = useState(false);
    const [search, setSearch] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const [online, setOnline] = useState(false);
    const [forwardTo, setForwardTo] = useState("");
    const [blockedIds, setBlockedIds] = useState<number[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<number | null>(null);

    const wsUrl = token ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/dms/${userId}?token=${token}` : null;
    const { messages, send, sendJson, setMessages, connected } = useWebSocket(wsUrl);

    useEffect(() => {
        (async () => {
            const [dmRes, userRes, blockedRes] = await Promise.all([api.get(`/dms/${userId}`), api.get(`/users/${userId}`), api.get("/users/blocked")]);
            const base = dmRes.data.map((m: any) => ({ type: "dm", ...m }));
            setMessages(base);
            setOtherUser(userRes.data);
            const rows = Array.isArray(blockedRes.data) ? blockedRes.data : [];
            setBlockedIds(rows.map((b: any) => Number(b.blocked_id)).filter((n: number) => Number.isFinite(n)));
            const unseenIds = base.filter((m: any) => m.sender_id === Number(userId) && !m.seen_at).map((m: any) => m.id);
            if (unseenIds.length) sendJson({ type: "seen", message_ids: unseenIds });
        })().catch(() => {});
    }, [userId, setMessages, sendJson]);

    useEffect(() => {
        if (!messages.length) return;
        const latest = messages[messages.length - 1] as any;
        if (latest?.type === "typing" && latest.sender_id === Number(userId)) {
            setIsTypingRemote(Boolean(latest.is_typing));
        }
        if (latest?.type === "presence") {
            if (latest.user_id === Number(userId) && typeof latest.online === "boolean") setOnline(latest.online);
        }
        if (latest?.type === "seen" && Array.isArray(latest.message_ids)) {
            const ids = new Set(latest.message_ids as number[]);
            setMessages((prev) => (prev as any[]).map((m) => (ids.has(m.id) ? { ...m, seen_at: latest.seen_at || new Date().toISOString() } : m)));
        }
    }, [messages, setMessages, userId]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/chat"); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router]);

    const onInput = (value: string) => {
        setInput(value);
        sendJson({ type: "typing", is_typing: value.trim().length > 0 });
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (blockedIds.includes(Number(userId))) return;
        if (!input.trim()) return;
        send(buildMessageContent(input.trim(), replyingTo));
        setInput("");
        setReplyingTo(null);
        sendJson({ type: "typing", is_typing: false });
    };

    const handleDelete = async (msgId: number, forMeOnly = false) => {
        try {
            await api.delete(`/dms/messages/${msgId}?for_me_only=${forMeOnly}`);
            if (forMeOnly) {
                setMessages((prev) => (prev as any[]).filter((m) => m.id !== msgId));
            } else {
                setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, content: "This message was deleted", is_deleted: true } : m)));
            }
        } catch {}
    };

    const startEdit = (msg: any) => {
        setEditingId(msg.id);
        setEditValue(parseMessageContent(String(msg.content || "")).body);
    };

    const handleEditSave = async (msgId: number) => {
        if (!editValue.trim()) return;
        const current = (messages as any[]).find((m) => m.id === msgId);
        const parsed = parseMessageContent(String(current?.content || ""));
        const res = await api.patch(`/dms/messages/${msgId}`, { content: `${parsed.prefix}${editValue.trim()}` });
        setMessages((prev) => (prev as any[]).map((m) => (m.id === msgId ? { ...m, ...res.data, type: "dm" } : m)));
        setEditingId(null);
        setEditValue("");
    };

    const react = async (id: number, emoji: string) => {
        const res = await api.patch(`/dms/messages/${id}/react`, { emoji });
        setMessages((prev) => (prev as any[]).map((m) => (m.id === id ? { ...m, ...res.data, type: "dm" } : m)));
    };

    const pin = async (id: number) => {
        const res = await api.patch(`/dms/messages/${id}/pin`);
        setMessages((prev) => (prev as any[]).map((m) => (m.id === id ? { ...m, ...res.data, type: "dm" } : m)));
    };

    const forward = async (id: number) => {
        const to = Number(forwardTo || userId);
        if (!to) return;
        await api.post(`/dms/messages/${id}/forward`, { to_user_id: to });
        setForwardTo("");
    };

    const copyMessage = async (m: any) => {
        await navigator.clipboard.writeText(parseMessageContent(String(m.content || "")).body);
    };

    const setPref = async (payload: any) => {
        await api.patch(`/dms/conversations/${userId}/preferences`, payload);
        setShowMenu(false);
    };

    const clearChat = async () => {
        await api.post(`/dms/conversations/${userId}/clear`);
        setMessages([]);
        setShowMenu(false);
    };

    const blockUser = async () => {
        await api.post(`/users/block/${userId}`);
        setBlockedIds((prev) => Array.from(new Set([...prev, Number(userId)])));
        setShowMenu(false);
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (messages as any[]).filter((m) => m.type === "dm" && (!q || String(m.content || "").toLowerCase().includes(q)));
    }, [messages, search]);

    const showOnline = otherUser?.show_online_status !== false;
    const statusLabel = showOnline ? (online ? "Online" : "Last seen recently") : "Last seen recently";
    const statusColor = showOnline ? (online ? "var(--success)" : "#8f96c6") : "#8f96c6";
    const addEmoji = (emoji: string) => setInput((prev) => `${prev}${emoji}`);

    return (
        <div style={s.container} onTouchStart={(e) => { touchStartRef.current = e.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(e) => {
            if (touchStartRef.current == null) return;
            if ((e.changedTouches[0]?.clientX ?? 0) - touchStartRef.current > 80) router.push("/chat");
            touchStartRef.current = null;
        }}>
            <header style={s.header} className="glass">
                <div style={s.headerInfo}>
                    <button style={s.toolBtn} onClick={() => router.push("/chat")}><ArrowLeft size={15} /></button>
                    <div style={s.avatarSmall}>{otherUser.nickname[0].toUpperCase()}</div>
                    <div>
                        <h2 style={s.roomName}>{otherUser.nickname}</h2>
                        <span style={s.usernameSmall}>@{otherUser.username}</span>
                    </div>
                </div>
                <div style={s.headerStatus}>
                    <span className={online && showOnline ? "pulse-dot" : ""} style={{ ...s.statusDot, background: statusColor }} />
                    <span style={s.statusText}>{statusLabel}</span>
                    <div style={{ position: "relative" }}>
                        <button style={s.toolBtn} onClick={() => setShowMenu((v) => !v)}><MoreVertical size={14} /></button>
                        {showMenu && (
                            <div style={s.menu}>
                                <button style={s.menuBtn} onClick={() => setPref({ is_archived: true })}><Archive size={13} /> Archive</button>
                                <button style={s.menuBtn} onClick={() => setPref({ is_muted: true })}><BellOff size={13} /> Mute</button>
                                <button style={s.menuBtn} onClick={() => setPref({ marked_unread: true })}><Mail size={13} /> Mark Unread</button>
                                <button style={s.menuBtn} onClick={clearChat}><Trash2 size={13} /> Clear Chat</button>
                                <button style={{ ...s.menuBtn, color: "#ff99aa" }} onClick={blockUser}>Block User</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div style={s.searchBar}><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inside chat" style={s.searchInput} /></div>

            <div style={s.messageArea} ref={scrollRef}>
                <div style={s.historyWall}>
                    {filtered.map((m: any, i) => {
                        const isMe = m.sender_id === user?.id;
                        const isEditing = editingId === m.id;
                        const parsed = parseMessageContent(String(m.content || ""));
                        let status = "";
                        if (isMe) status = m.seen_at ? "Seen" : m.delivered_at ? "Delivered" : connected ? "Sent" : "";
                        const reactions = JSON.parse(m.reactions || "{}");
                        return (
                            <div key={`${m.id}-${i}`} style={{ ...s.msgRow, flexDirection: isMe ? "row-reverse" : "row" }}>
                                <div style={{ ...s.msgCol, alignItems: isMe ? "flex-end" : "flex-start" }}>
                                        <div style={s.msgMeta}>
                                            <span style={s.msgTime}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                            {!!m.updated_at && !m.is_deleted && <span style={s.editedTag}>edited</span>}
                                            {status && <span style={s.seenTag}>{status}</span>}
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
                                            {parsed.reply && <div style={s.replyPreview}><p style={s.replyAuthor}>Reply to @{parsed.reply.username || parsed.reply.nickname}</p><p style={s.replyText}>{parsed.reply.content}</p></div>}
                                            {parsed.body}
                                            <div style={s.reactionRow}>
                                                {!m.is_deleted && !isEditing && <button onClick={() => setReplyingTo({ id: m.id, username: isMe ? user?.username || "" : otherUser.username || "", nickname: isMe ? user?.nickname || "You" : otherUser.nickname || "User", content: parsed.body.slice(0, 120) })} style={s.reactionGhost}><Reply size={11} /></button>}
                                                {!m.is_deleted && <button onClick={() => copyMessage(m)} style={s.reactionGhost}><Copy size={11} /></button>}
                                                {isMe && !m.is_deleted && !isEditing && <button onClick={() => startEdit(m)} style={s.reactionGhost}><Edit2 size={11} /></button>}
                                                {isMe && !m.is_deleted && !isEditing && <button onClick={() => handleDelete(m.id, false)} style={s.reactionGhost}><Trash2 size={11} /></button>}
                                                
                                                {REACTION_EMOJIS.map((emoji) => (
                                                    <button key={emoji} style={s.reactionBtn} onClick={() => react(m.id, emoji)}>{emoji}</button>
                                                ))}
                                                {Object.entries(reactions).map(([emoji, users]) => {
                                                    const count = Array.isArray(users) ? users.length : 0;
                                                    if (count <= 0) return null;
                                                    return <span key={`count-${emoji}`} style={s.reactionCount}>{emoji} {count}</span>;
                                                })}
                                                {!m.is_deleted && <button onClick={() => pin(m.id)} style={s.reactionGhost}><Pin size={11} /></button>}
                                                {!m.is_deleted && <button onClick={() => forward(m.id)} style={s.reactionGhost}><Forward size={11} /></button>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={handleSend} style={s.inputArea} className="glass">
                {blockedIds.includes(Number(userId)) && (<div style={s.blockedBanner}>You blocked this user. Unblock from Settings to send messages.</div>)}
                {replyingTo && <div style={s.replyComposer}><div><p style={s.replyComposerTitle}>Replying to @{replyingTo.username || replyingTo.nickname}</p><p style={s.replyComposerText}>{replyingTo.content}</p></div><button type="button" style={s.actionBtn} onClick={() => setReplyingTo(null)}><X size={14} /></button></div>}
                {isTypingRemote && <p style={s.typing}>Typing...</p>}
                <div style={s.inputRow}>
                    <button type="button" style={s.toolBtn} onClick={() => setShowEmoji((v) => !v)} title="Emoji"><Smile size={14} /></button>
                    <input value={input} onChange={(e) => onInput(e.target.value)} disabled={blockedIds.includes(Number(userId))} placeholder={blockedIds.includes(Number(userId)) ? "You blocked this user" : `Message @${otherUser.nickname}`} style={s.input} autoFocus />
                    <input value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} placeholder="Forward to user id" style={{ ...s.forwardInput }} />
                    <button type="submit" disabled={!input.trim() || blockedIds.includes(Number(userId))} style={{ ...s.sendBtn, opacity: input.trim() && !blockedIds.includes(Number(userId)) ? 1 : 0.45 }}><Send size={18} /></button>
                </div>
                {showEmoji && <div style={s.emojiWrap}>{["\u{1F600}", "\u{1F602}", "\u{1F60D}", "\u{1F973}", "\u{1F525}", "\u{1F44D}", "\u{1F64F}", "\u2764\uFE0F", "\u{1F60E}", "\u{1F91D}", "\u{1F389}", "\u{1F680}", "\u{1F605}", "\u{1F622}", "\u{1F914}", "\u{1F64C}"].map((e) => <button key={e} type="button" style={s.emojiBtn} onClick={() => addEmoji(e)}>{e}</button>)}</div>}
            </form>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexDirection: "column", height: "100%", background: "radial-gradient(circle at 10% -10%, rgba(119,101,255,0.14), transparent 46%), var(--bg-base)" },
    header: { height: 70, padding: "0 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(140,148,204,0.2)" },
    headerInfo: { display: "flex", alignItems: "center", gap: 10 },
    roomName: { fontWeight: 800, fontSize: "1rem" },
    usernameSmall: { fontSize: "0.75rem", color: "var(--text-muted)" },
    headerStatus: { display: "flex", alignItems: "center", gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 999, display: "inline-block" },
    statusText: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 },
    avatarSmall: { width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff" },
    searchBar: { height: 42, borderBottom: "1px solid rgba(140,148,204,0.14)", display: "flex", alignItems: "center", gap: 8, padding: "0 0.8rem", color: "var(--text-muted)" },
    searchInput: { background: "transparent", border: "none", borderRadius: 0, boxShadow: "none", padding: 0, color: "var(--text-primary)" },
    messageArea: { flex: 1, overflowY: "auto" },
    historyWall: { padding: "1rem", display: "flex", flexDirection: "column", gap: "0.9rem" },
    msgRow: { display: "flex", gap: 10, maxWidth: "86%" },
    msgCol: { display: "flex", flexDirection: "column", gap: 4 },
    msgMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem" },
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
    reactionRow: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" },
    reactionBtn: { border: "1px solid rgba(255,255,255,0.15)", background: "rgba(11,16,34,0.2)", color: "#dbe0ff", borderRadius: 999, padding: "0.1rem 0.35rem", fontSize: 11, cursor: "pointer" },
    reactionCount: { border: "1px solid rgba(255,255,255,0.25)", background: "rgba(11,16,34,0.34)", color: "#fff", borderRadius: 999, padding: "0.1rem 0.38rem", fontSize: 11 },
    reactionGhost: { border: "1px solid rgba(255,255,255,0.15)", background: "rgba(11,16,34,0.2)", color: "#d5dbff", borderRadius: 999, padding: "0.15rem 0.34rem", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
    editWrap: { width: "100%", borderRadius: 12, border: "1px solid rgba(140,148,204,0.3)", background: "rgba(20,26,47,0.75)", padding: 8 },
    editInput: { background: "#12182e", border: "1px solid #6352f0", borderRadius: 10, padding: "0.52rem 0.65rem", color: "#fff" },
    editActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 },
    inputArea: { borderTop: "1px solid rgba(140,148,204,0.2)", padding: "0.7rem 0.9rem", display: "flex", flexDirection: "column", gap: 6 },
    replyComposer: { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(140,148,204,0.26)", background: "rgba(18,24,45,0.65)", borderRadius: 10, padding: "0.45rem 0.6rem" },
    replyComposerTitle: { fontSize: "0.73rem", fontWeight: 700, color: "#c7ccff" },
    replyComposerText: { fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    typing: { fontSize: "0.74rem", color: "#c0c6f6", marginLeft: 5 },
    inputRow: { display: "flex", alignItems: "center", gap: 8, background: "rgba(18,24,45,0.78)", border: "1px solid rgba(140,148,204,0.25)", borderRadius: 999, padding: "0.35rem 0.4rem" },
    toolBtn: { minWidth: 34, height: 34, borderRadius: 10, border: "1px solid rgba(140,148,204,0.26)", background: "rgba(15,20,36,0.7)", color: "#b9c0f7", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, fontWeight: 700 },
    input: { flex: 1, background: "transparent", border: "none", borderRadius: 999, padding: "0.6rem 0.8rem", color: "var(--text-primary)", boxShadow: "none", outline: "none" },
    forwardInput: { display: "none" },
    sendBtn: { width: 38, height: 38, border: "1px solid rgba(170,160,255,0.45)", borderRadius: 999, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    emojiWrap: { display: "flex", flexWrap: "wrap", gap: 6, border: "1px solid rgba(140,148,204,0.2)", background: "rgba(13,18,34,0.75)", borderRadius: 12, padding: 8 },
    emojiBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(140,148,204,0.2)", background: "rgba(20,27,48,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    menu: { position: "absolute", right: 0, top: 38, zIndex: 30, width: 170, borderRadius: 10, background: "rgba(15,20,36,0.95)", border: "1px solid rgba(140,148,204,0.3)", padding: 4 },
    menuBtn: { width: "100%", border: "none", background: "transparent", color: "#d8dbff", padding: "0.45rem 0.5rem", textAlign: "left", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
    center: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" },
};


