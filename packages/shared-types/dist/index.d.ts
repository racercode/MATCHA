export interface Timestamp {
    seconds: number;
    nanoseconds: number;
    toMillis?(): number;
    toDate?(): Date;
}
/** Convert any Timestamp to unix milliseconds */
export declare const toMs: (ts: Timestamp) => number;
/** Create a Timestamp from unix milliseconds */
export declare const msToTimestamp: (ms: number) => Timestamp;
/** Timestamp for right now */
export declare const nowTimestamp: () => Timestamp;
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
    needs: string[];
    offers: string[];
    updatedAt: Timestamp;
}
export interface PeerPreview {
    uid: string;
    displayName: string;
    photoURL?: string;
    summary: string;
}
export interface ChannelMessage {
    msgId: string;
    uid: string;
    summary: string;
    publishedAt: Timestamp;
}
export interface GovernmentResource {
    rid: string;
    agencyId: string;
    agencyName: string;
    name: string;
    description: string;
    eligibilityCriteria: string[];
    contactUrl?: string;
    pdfStoragePath?: string;
    createdAt: Timestamp;
}
export interface ChannelReply {
    replyId: string;
    messageId: string;
    govId: string;
    content: string;
    matchScore: number;
    createdAt: Timestamp;
}
export interface HumanThread {
    tid: string;
    type: 'gov_user';
    userId: string;
    govId: string;
    channelReplyId: string;
    matchScore: number;
    status: 'open' | 'closed';
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface HumanMessage {
    mid: string;
    from: string;
    content: string;
    createdAt: Timestamp;
}
export interface PeerThread {
    tid: string;
    type: 'user_user';
    userAId: string;
    userBId: string;
    matchRationale: string;
    status: 'active' | 'closed';
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface PeerMessage {
    mid: string;
    from: string;
    content: string;
    createdAt: Timestamp;
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
    type: 'persona_message';
    content: string;
} | {
    type: 'peer_message';
    threadId: string;
    content: string;
} | {
    type: 'human_message';
    threadId: string;
    content: string;
};
export type ServerEvent = {
    type: 'agent_reply';
    content: string;
    done: boolean;
} | {
    type: 'peer_message';
    message: PeerMessage;
} | {
    type: 'human_message';
    message: HumanMessage;
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
    totalReplies: number;
    avgMatchScore: number;
    openedConversations: number;
    openRate: number;
    scoreDistribution: {
        '90-100': number;
        '70-89': number;
        '50-69': number;
        '0-49': number;
    };
}
export declare const MOCK_PERSONA: UserPersona;
export declare const MOCK_RESOURCE: GovernmentResource;
export declare const MOCK_PEER_PREVIEW: PeerPreview;
//# sourceMappingURL=index.d.ts.map