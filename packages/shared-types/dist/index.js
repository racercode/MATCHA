"use strict";
// =============================================================================
// @matcha/shared-types
// Single source of truth for all interfaces shared across apps and services.
// ALL changes here require notifying all three groups.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_PEER_PREVIEW = exports.MOCK_RESOURCE = exports.MOCK_PERSONA = exports.nowTimestamp = exports.msToTimestamp = exports.toMs = void 0;
/** Convert any Timestamp to unix milliseconds */
const toMs = (ts) => ts.toMillis?.() ?? ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1_000_000);
exports.toMs = toMs;
/** Create a Timestamp from unix milliseconds */
const msToTimestamp = (ms) => ({
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
});
exports.msToTimestamp = msToTimestamp;
/** Timestamp for right now */
const nowTimestamp = () => (0, exports.msToTimestamp)(Date.now());
exports.nowTimestamp = nowTimestamp;
// ---------------------------------------------------------------------------
// Mock helpers (Group C provides, remove before prod)
// ---------------------------------------------------------------------------
exports.MOCK_PERSONA = {
    uid: 'mock-uid-001',
    displayName: '陳小明',
    summary: '正在尋找就業輔導和職業培訓資源的年輕人',
    needs: ['就業輔導', '職業培訓'],
    offers: ['軟體開發經驗', '社區志工'],
    updatedAt: (0, exports.nowTimestamp)(),
};
exports.MOCK_RESOURCE = {
    rid: 'mock-rid-001',
    agencyId: 'labor-dept',
    agencyName: '勞動部',
    name: '青年就業促進計畫',
    description: '提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢',
    eligibilityCriteria: ['年齡 18–29 歲', '具中華民國國籍', '非在學中'],
    contactUrl: 'https://www.mol.gov.tw',
    createdAt: (0, exports.nowTimestamp)(),
};
exports.MOCK_PEER_PREVIEW = {
    uid: 'mock-uid-002',
    displayName: '林小華',
    summary: '對社會企業和公共政策有興趣，想找同路人交流',
};
//# sourceMappingURL=index.js.map