export type UserRole = 'citizen' | 'gov_staff';
export interface AuthUser {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    role: UserRole;
    agencyId?: string;
}
export interface UserPersona {
    uid: string;
    displayName: string;
    photoURL?: string;
    summary: string;
    tags: string[];
    needs: string[];
    offers: string[];
    updatedAt: number;
}
export interface PeerPreview {
    uid: string;
    displayName: string;
    photoURL?: string;
    summary: string;
    tags: string[];
    commonTags: string[];
}
export interface ChannelBroadcast {
    uid: string;
    displayName: string;
    summary: string;
    tags: string[];
    needs: string[];
    publishedAt: number;
}
export interface GovernmentResource {
    rid: string;
    agencyId: string;
    agencyName: string;
    name: string;
    description: string;
    eligibilityCriteria: string[];
    tags: string[];
    contactUrl?: string;
    createdAt: number;
}
export type ThreadType = 'gov_user' | 'user_user';
export type ThreadStatus = 'negotiating' | 'matched' | 'rejected' | 'human_takeover';
export type PresenceState = 'agent' | 'human' | 'both';
export interface AgentThread {
    tid: string;
    type: ThreadType;
    initiatorId: string;
    responderId: string;
    status: ThreadStatus;
    matchScore?: number;
    summary?: string;
    userPresence: PresenceState;
    govPresence: PresenceState;
    peerPresence?: PresenceState;
    createdAt: number;
    updatedAt: number;
}
export type MessageSenderType = `persona_agent:${string}` | `coffee_agent:${string}` | `gov_agent:${string}` | `human:${string}`;
export type MessageType = 'query' | 'answer' | 'decision' | 'human_note';
export interface ThreadMessage {
    mid: string;
    tid: string;
    from: string;
    type: MessageType;
    content: Record<string, unknown>;
    createdAt: number;
}
export interface SwipeCard {
    cardId: string;
    question: string;
    leftLabel: string;
    rightLabel: string;
    leftValue: string;
    rightValue: string;
}
export type SwipeDirection = 'left' | 'right';
export type ClientEvent = {
    type: 'chat_message';
    content: string;
} | {
    type: 'swipe';
    direction: SwipeDirection;
    cardId: string;
    value: string;
} | {
    type: 'human_join';
    threadId: string;
} | {
    type: 'human_leave';
    threadId: string;
} | {
    type: 'thread_message';
    threadId: string;
    content: string;
};
export type ServerEvent = {
    type: 'agent_reply';
    content: string;
    done: boolean;
} | {
    type: 'swipe_card';
    card: SwipeCard;
} | {
    type: 'match_notify';
    thread: AgentThread;
    resource: GovernmentResource;
} | {
    type: 'peer_notify';
    thread: AgentThread;
    peer: PeerPreview;
} | {
    type: 'thread_update';
    thread: AgentThread;
} | {
    type: 'thread_message';
    message: ThreadMessage;
} | {
    type: 'presence_update';
    threadId: string;
    side: 'user' | 'gov' | 'peer';
    state: PresenceState;
} | {
    type: 'persona_updated';
    persona: UserPersona;
} | {
    type: 'error';
    code: string;
    message: string;
};
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    hasMore: boolean;
}
export interface GovStats {
    totalMatches: number;
    humanTakeoverCount: number;
    activeThreads: number;
    matchedToday: number;
    tagDistribution: Record<string, number>;
    needsDistribution: Record<string, number>;
}
export declare const MOCK_PERSONA: UserPersona;
export declare const MOCK_RESOURCE: GovernmentResource;
export declare const MOCK_THREAD: AgentThread;
export declare const MOCK_PEER_PREVIEW: PeerPreview;
//# sourceMappingURL=index.d.ts.map