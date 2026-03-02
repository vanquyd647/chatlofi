# BÁO CÁO PHÂN TÍCH CHUYÊN SÂU - ChatLofi App

> Phân tích 31 screens, xác định thành phần chung, kiểm tra nghiệp vụ theo chuẩn app mạng xã hội

---

## MỤC LỤC

1. [Thành phần chung (Common Patterns)](#1-thành-phần-chung-common-patterns)
2. [Kiểm tra nghiệp vụ theo từng module](#2-kiểm-tra-nghiệp-vụ-theo-từng-module)
3. [Tổng hợp lỗi P0 (Critical)](#3-tổng-hợp-lỗi-p0-critical)
4. [Tổng hợp lỗi P1 (High)](#4-tổng-hợp-lỗi-p1-high)
5. [Tính năng còn thiếu so với chuẩn mạng xã hội](#5-tính-năng-còn-thiếu-so-với-chuẩn-mạng-xã-hội)
6. [Đề xuất quy trình nâng cấp](#6-đề-xuất-quy-trình-nâng-cấp)

---

## 1. THÀNH PHẦN CHUNG (Common Patterns)

### 1.1 Skeleton Loader (BỊ TRÙNG LẶP)

**Xuất hiện tại:** Chat.js, Friends.js, SearchFriend.js

Cả 3 file đều copy-paste cùng một đoạn code shimmer animation:

```javascript
// Copy-paste giống nhau ở 3 nơi
const shimmerAnim = new Animated.Value(0);
Animated.loop(
  Animated.sequence([
    Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
    Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
  ])
).start();
```

**→ Nên tạo:** `src/components/SkeletonLoader.js`

---

### 1.2 Empty State (BỊ TRÙNG LẶP x5, đã có component nhưng chưa dùng hết)

| Screen | Cách triển khai | Có dùng `<EmptyState>` component? |
|--------|----------------|-----------------------------------|
| Groups.js | `<EmptyState>` component | ✅ Đã dùng |
| Chat.js | Inline code (Ionicons + text) | ❌ |
| Friends.js | Inline code (Ionicons + text) | ❌ |
| SearchFriend.js | Inline code (Ionicons + text) | ❌ |
| Notifications.js | Inline code (Ionicons + text) | ❌ |

Pattern chung: Icon 64-80px, color `#ccc`, title fontSize 18 `#333`, subtitle fontSize 14 `#888`.

**→ Nên:** Áp dụng `<EmptyState>` cho tất cả 4 screen còn lại.

---

### 1.3 Modal Action Sheet (BỊ TRÙNG LẶP)

**Xuất hiện tại:** Chat.js, Friends.js, TimeLine.js

Cấu trúc chung:
- `<Modal animationType="slide/fade">` + `Pressable` backdrop
- Header: Avatar + Name
- Divider: 1px `#f0f0f0`
- Options: Icon + Text rows
- Destructive action: color `#F44336`

**→ Nên tạo:** `src/components/ActionSheet.js`

---

### 1.4 Blue Header Bar (BỊ TRÙNG LẶP)

**Xuất hiện tại:** Chat.js, SearchFriend.js, Notifications.js, Option_chat.js

Pattern:
```javascript
backgroundColor: "#006AF5", paddingHorizontal: 12, paddingVertical: 10,
elevation: 3, shadowColor: '#000'
```

**→ Đã có:** `<AppHeader>` component nhưng chưa áp dụng ở SearchFriend.js, Notifications.js

---

### 1.5 Alert.alert Confirm Pattern (CHUNG)

Mọi screen đều dùng cùng pattern:
```javascript
Alert.alert('Title', 'Message', [
  { text: 'Hủy', style: 'cancel' },
  { text: 'Xóa', style: 'destructive', onPress: handler }
]);
```

**→ Nên tạo:** `src/utils/confirmAlert.js` helper function

---

### 1.6 Firestore User Data Fetch (BỊ TRÙNG LẶP x10+)

Pattern lặp lại ở hầu hết screen:
```javascript
const user = auth.currentUser;
const docRef = doc(db, 'users', user.uid);
const docSnap = await getDoc(docRef);
const userData = docSnap.data();
```

**→ Đã có:** `userService.getUserById()` nhưng chưa screen nào dùng.

---

### 1.7 Avatar Rendering (BỊ TRÙNG LẶP)

| Screen | Size | Fallback |
|--------|------|----------|
| Chat.js | 56×56 | Không fallback |
| Friends.js | 50×50 | `via.placeholder.com/50` |
| SearchFriend.js | 60×60 | `via.placeholder.com/60` |
| Groups.js | 55×55 | Không fallback |
| Notifications.js | 50×50 | Ionicons icon |

**→ Đã có:** `<Avatar>` component nhưng chưa áp dụng đồng bộ.

---

### 1.8 Firestore onSnapshot + Cleanup (BỊ LỖI NHIỀU NƠI)

| Screen | Cleanup đúng? | Vấn đề |
|--------|---------------|--------|
| Chat.js | ✅ Đúng | — |
| Chat_fr.js | ❌ SAI | `async` function trả về Promise, không phải unsubscribe |
| Friends.js | ✅ Đúng | — |
| Friend_received.js | ❌ THIẾU | Không capture unsubscribe |
| Friend_sent.js | ❌ SAI | Nested listener, nhân bản memory leak |
| TimeLine.js | ❌ SAI | Nested comment listeners không cleanup |
| Notifications.js | ✅ Đúng | — |
| Groups.js | ✅ Đúng | — |

**→ Ưu tiên fix:** 4 screen bị memory leak.

---

### 1.9 State Pattern (CHUNG)

Mỗi screen đều có bộ state giống nhau:
```javascript
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [modalVisible, setModalVisible] = useState(false);
const [modalData, setModalData] = useState(null);
const [userData, setUserData] = useState(null);
```

**→ Nên tạo:** Custom hooks: `useUserData()`, `useFirestoreList()`, `useModal()`.

---

### 1.10 Service Layer (ĐÃ TẠO nhưng chưa screen nào dùng!)

| Service | Tạo rồi? | Screens nào nên dùng? | Đang dùng? |
|---------|----------|----------------------|------------|
| chatService.js | ✅ | Chat.js, Chat_fr.js, Option_chat.js | ❌ |
| groupService.js | ✅ | Groups.js, Add_group.js, Setting_group.js, Manager_group.js | ❌ |
| friendService.js | ✅ | Friends.js, Friend_received.js, Friend_sent.js, SearchFriend.js | ❌ |
| userService.js | ✅ | Profile.js, Personal_page.js, Edit_in4Personal.js | ❌ |
| storageService.js | ✅ | Chat_fr.js, TimeLine.js, Personal_page.js | ❌ |
| authService.js | ✅ | Login.js, Signup.js | ❌ |
| postService.js | ✅ | TimeLine.js, PostDetail.js, MyPosts.js | ❌ |
| notificationService.js | ❌ CHƯA TẠO | Notifications.js | — |

---

## 2. KIỂM TRA NGHIỆP VỤ THEO TỪNG MODULE

### 2.1 Module Auth (Login.js, Signup.js, PermissionsScreen.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Email validation | ✅ | Regex check đúng |
| Password validation (6 chars, 1 số + 1 chữ) | ✅ | Đủ cơ bản |
| Email verification trước khi login | ✅ | Có modal + resend + cooldown 60s |
| Forgot password | ✅ | sendPasswordResetEmail |
| Dual auth (Web SDK + Native SDK) | ⚠️ | Sync cho Realtime DB, nhưng lưu 2 phiên đăng nhập |
| FCM token persistence | ✅ | savePushToken sau login |
| **Thiếu:** Logout không xóa FCM token | ❌ | Push notification vẫn gửi sau logout |
| **Thiếu:** Không kiểm tra tài khoản disabled | ❌ | Admin không thể ban user |
| **Thiếu:** Rate limiting login attempts | ❌ | Chỉ có Firebase mặc định |

---

### 2.2 Module Chat (Chat.js, Chat_fr.js, Option_chat.js, Forward_message.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Gửi tin nhắn text | ✅ | GiftedChat + Firestore |
| Gửi hình ảnh | ✅ | ImagePicker + Storage |
| Gửi video | ✅ | ImagePicker + Storage |
| Gửi file đính kèm | ✅ | DocumentPicker + Storage |
| Gửi audio | ✅ | DocumentPicker + Storage |
| Thu hồi tin nhắn (10 phút) | ⚠️ | Client-side check only, audio không bị xóa |
| Xóa tin nhắn cho mình | ⚠️ | Read-modify-write không có transaction |
| Phản ứng emoji (6 loại) | ✅ | arrayUnion/arrayRemove |
| Ghim cuộc trò chuyện | ✅ | arrayUnion/arrayRemove trên Chats doc |
| Tắt thông báo chat | ✅ | mutedUsers array |
| Xóa mềm cuộc trò chuyện | ✅ | detailDelete field |
| Chuyển tiếp tin nhắn | ⚠️ | Không có label "Forwarded", mất audio, không gửi notification |
| Reply tin nhắn | ⚠️ | Chỉ là text prefix, không phải structured reference |
| Tìm kiếm tin nhắn | ⚠️ | Full scan client-side, không scale |
| **P0:** onSnapshot memory leak | ❌ | async function trả Promise |
| **P0:** clearAllNotifications xóa hết | ❌ | Xóa notification các chat khác |
| **P0:** Xóa lịch sử = xóa cho TẤT CẢ | ❌ | handleClearHistory gọi deleteDoc |

**THIẾU HOÀN TOÀN:**
- ❌ Read receipts (đã xem)
- ❌ Typing indicator (đang nhập)
- ❌ Delivered status (✓✓)
- ❌ Online/Offline presence
- ❌ Unread count per conversation
- ❌ Message editing
- ❌ Pinned messages (trong chat)
- ❌ Multi-select messages
- ❌ Message search trong chat
- ❌ Link preview (Open Graph)
- ❌ Emoji full picker
- ❌ Sticker/GIF
- ❌ Location sharing
- ❌ Contact sharing

---

### 2.3 Module Friends (SearchFriend.js, FriendRequest.js, Friend_received.js, Friend_sent.js, Friends.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Tìm bạn theo tên | ⚠️ | Exact match only (`==`), không tìm gần đúng |
| Gửi lời mời kết bạn | ✅ | addDoc friend_Sents + friend_Receiveds |
| Hủy lời mời | ✅ | deleteDoc cả 2 bên |
| Chấp nhận lời mời | ⚠️ | 4+ writes không atomic, bug ID_roomChat |
| Từ chối lời mời | ⚠️ | forEach async anti-pattern |
| Hủy kết bạn | ✅ | deleteDoc cả 2 bên |
| Danh sách bạn bè | ✅ | onSnapshot + sort alphabetical |
| **P0:** ID_roomChat bug | ❌ | State bị overwrite bởi item cuối trong forEach |
| **P0:** forEach async anti-pattern | ❌ | Không await, fire-and-forget |
| **P0:** Friend_sent.js auto-delete side effect | ❌ | onSnapshot listener tự xóa data |

**THIẾU:**
- ❌ Tìm kiếm gần đúng (prefix/fuzzy search)
- ❌ Block/Unblock user
- ❌ Report user
- ❌ Gợi ý bạn bè (mutual friends)
- ❌ Friend categories/groups

---

### 2.4 Module Groups (Groups.js, Add_group.js, Add_mem_gr.js, Option_chat.js, Setting_group.js, Manager_group.js, Select_Ad.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Tạo nhóm | ⚠️ | Dual-write không atomic, weak random ID |
| Thêm thành viên | ⚠️ | Không chống trùng, không cập nhật UID_Chats |
| Xóa thành viên | ⚠️ | Không check quyền admin, có thể xóa admin |
| Bổ nhiệm/xóa sub-admin | ⚠️ | Không atomic, sub-admin có thể xóa sub-admin khác |
| Chuyển quyền admin | ❌ | Bug: arrayRemove trỏ sai doc |
| Giải tán nhóm | ❌ | Không check quyền, không xác nhận, không xóa subcollections |
| Rời nhóm | ⚠️ | 4 updateDoc không atomic |
| **P0:** Select_Ad.js duplicate arrayRemove → sai doc | ❌ | Copy-paste lỗi |
| **P0:** Setting_group.js không check admin | ❌ | Any member can dissolve |
| **P0:** Manager_group.js admin bị xóa | ❌ | Không guard admin UID |

**THIẾU:**
- ❌ Group invite link / QR code
- ❌ Member approval / pending requests
- ❌ Group description
- ❌ Group announcement/pin
- ❌ Group media gallery
- ❌ Search members
- ❌ Member join date tracking
- ❌ Max member limit enforcement

---

### 2.5 Module Social (TimeLine.js, PostDetail.js, MyPosts.js, Discovery.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Đăng bài viết (text + images + video + audio) | ✅ | Multi-media support |
| Feed real-time | ⚠️ | Mixed onSnapshot + getDocs for pagination |
| React emoji bài viết | ⚠️ | Read-modify-write race condition |
| Bình luận + reply | ⚠️ | Reply chỉ cosmetic, không threaded |
| Share bài viết | ⚠️ | Share count race condition (increment) |
| Xóa bài viết | ⚠️ | Không xóa comments subcollection, không xóa media |
| Sửa bài viết | ✅ | Có trong TimeLine.js |
| **P0:** Memory leak nested listeners | ❌ | Comment count listeners nhân bản |
| **P0:** Post delete orphans comments | ❌ | Subcollection tồn tại mãi |
| **P0:** Reaction race condition | ❌ | Concurrent users mất data |

**THIẾU:**
- ❌ Post privacy (public/friends/private)
- ❌ Post reporting / hiding
- ❌ Bookmark / Save post
- ❌ User tagging / @mentions
- ❌ Hashtag support
- ❌ Location tagging
- ❌ Link preview / OG cards
- ❌ Poll / Survey
- ❌ Comment deletion/editing (by author)
- ❌ Comment sorting (newest/oldest)
- ❌ "Who reacted" viewer
- ❌ Content moderation

---

### 2.6 Module Profile (Profile.js, Personal_page.js, Edit_in4Personal.js, Setting_app.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Xem profile | ✅ | Real-time listener |
| Cập nhật tên | ⚠️ | Cascade scan ALL posts → không scale |
| Cập nhật ảnh | ⚠️ | Delete trước rồi upload → race condition mất ảnh |
| Cập nhật giới tính + ngày sinh | ✅ | writeBatch |
| **P0:** Scan ALL posts để cascade | ❌ | getDocs('posts') toàn bộ hệ thống |
| **P0:** Batch 500 limit không handle | ❌ | >500 posts = crash |
| **P0:** onSnapshot reset form đang edit | ❌ | External change xóa input user |

**THIẾU:**
- ❌ Cover photo
- ❌ Bio / status text
- ❌ Privacy settings per field
- ❌ Account deletion
- ❌ Two-factor authentication

---

### 2.7 Module Video Call (VideoCall.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| WebRTC peer-to-peer | ✅ | STUN + TURN + ICE candidates |
| Firebase RTDB signaling | ✅ | Offer/Answer/Candidates |
| Call lifecycle (ring → accept/decline → end) | ⚠️ | Cleanup race conditions |
| Ringtone | ⚠️ | External URL, fails offline |
| **P0:** TURN credentials hardcoded | ❌ | Username/password trong source |
| **P0:** Không check friendship before call | ❌ | Gọi bất kỳ ai |
| **P0:** React hooks rule violation | ❌ | Conditional return sau hooks |

**THIẾU:**
- ❌ Call history / logs
- ❌ Screen keep-awake
- ❌ Network quality indicator
- ❌ Group video call
- ❌ Voice-only call option
- ❌ Screen sharing

---

### 2.8 Module Notifications (Notifications.js)

| Nghiệp vụ | Đúng? | Chi tiết |
|------------|-------|---------|
| Real-time notifications | ✅ | onSnapshot |
| Filter (All/Read/Unread) | ✅ | Client-side filter tabs |
| Mark as read | ✅ | updateDoc |
| Mark all as read | ✅ | writeBatch |
| Delete notification | ✅ | deleteDoc |
| Navigate to source | ✅ | Dynamic routing based on type |

**THIẾU:**
- ❌ Notification settings per type
- ❌ Do not disturb mode
- ❌ Notification grouping/stacking
- ❌ Notification sound customization

---

### 2.9 Screens Stub / Incomplete

| Screen | Tình trạng |
|--------|-----------|
| Discovery.js | Navigation tới screens không tồn tại, game buttons no-op |
| Phonebook.js | QR + Plus buttons no-op |
| Phonebook_2.js | Selection feature không hoạt động |
| PlayVideo.js | Full GET thay vì HEAD request |

---

## 3. TỔNG HỢP LỖI P0 (CRITICAL) — 38 LỖI

| # | File | Lỗi | Loại |
|---|------|-----|------|
| 1 | Chat_fr.js | Memory leak — onSnapshot không unsubscribe | Bug |
| 2 | Chat_fr.js | clearAllNotifications xóa tất cả thay vì chat hiện tại | Bug |
| 3 | Chat_fr.js | Recall time check chỉ client-side | Security |
| 4 | Chat_fr.js | Math.random() cho message ID | Security |
| 5 | Option_chat.js | handleClearHistory xóa messages cho TẤT CẢ users | Bug |
| 6 | Option_chat.js | handleLeaveGroup 4 updateDoc không transaction | Data |
| 7 | TimeLine.js | Reaction read-modify-write race condition | Data |
| 8 | TimeLine.js | Share count race condition | Data |
| 9 | TimeLine.js | Memory leak — nested comment listeners | Bug |
| 10 | TimeLine.js | Post delete orphans comments subcollection | Data |
| 11 | PostDetail.js | Reaction null thay vì deleteField() | Data |
| 12 | PostDetail.js | Post delete orphans comments | Data |
| 13 | Setting_group.js | No admin check for dissolve | Security |
| 14 | Setting_group.js | No confirmation dialog | UX |
| 15 | Setting_group.js | Non-atomic dual delete | Data |
| 16 | Setting_group.js | Incomplete cleanup (messages, members, media) | Data |
| 17 | Manager_group.js | No authorization in delete_Member | Security |
| 18 | Manager_group.js | Admin có thể bị xóa | Bug |
| 19 | Manager_group.js | Non-atomic multi-doc updates | Data |
| 20 | Manager_group.js | No confirmation dialogs | UX |
| 21 | Friend_received.js | ID_roomChat bug (state overwrite) | Bug |
| 22 | Friend_received.js | 4+ writes không atomic | Data |
| 23 | Friend_received.js | forEach async anti-pattern | Bug |
| 24 | Friend_sent.js | Auto-delete side effect in onSnapshot | Bug |
| 25 | Friend_sent.js | Nested listener memory leak | Bug |
| 26 | Select_Ad.js | Duplicate arrayRemove trỏ sai doc | Bug |
| 27 | Select_Ad.js | Non-atomic dual-write | Data |
| 28 | Select_Ad.js | No confirmation dialog | UX |
| 29 | Select_Ad.js | No error flow control | Bug |
| 30 | Add_group.js | Dual-write without transaction | Data |
| 31 | Add_group.js | Search fires every keystroke (cost) | Perf |
| 32 | Add_mem_gr.js | No duplicate member prevention | Bug |
| 33 | Add_mem_gr.js | UID_Chats field not updated | Data |
| 34 | Add_mem_gr.js | No permission check | Security |
| 35 | Personal_page.js | Scan ALL posts for cascade update | Perf |
| 36 | Edit_in4Personal.js | onSnapshot resets form while editing | Bug |
| 37 | VideoCall.js | TURN credentials hardcoded | Security |
| 38 | Profile.js | Crash if user is null | Bug |

---

## 4. TỔNG HỢP LỖI P1 (HIGH) — 30+ LỖI

| # | File | Lỗi |
|---|------|-----|
| 1 | Chat_fr.js | Audio không bị xóa khi recall |
| 2 | Chat_fr.js | Không validate file size upload |
| 3 | Chat_fr.js | Hardcoded MIME types |
| 4 | Chat_fr.js | Document path overwrite collision |
| 5 | Chat_fr.js | Reply chỉ là text prefix |
| 6 | Chat_fr.js | Optimistic UI không rollback |
| 7 | Forward_message.js | Forward mất audio |
| 8 | Forward_message.js | Forward không gửi notification |
| 9 | Forward_message.js | Forward không có label "Forwarded" |
| 10 | Option_chat.js | Message search full scan client-side |
| 11 | Option_chat.js | No authorization check |
| 12 | TimeLine.js | No media size validation |
| 13 | TimeLine.js | No post text length limit |
| 14 | TimeLine.js | Mixed real-time + one-time pagination |
| 15 | PostDetail.js | handleLikeComment non-atomic |
| 16 | PostDetail.js | No comment deletion capability |
| 17 | Friend_received.js | onSnapshot unsubscribe leak |
| 18 | Friend_received.js | No duplicate friend check |
| 19 | Friend_received.js | No button loading/disabled state |
| 20 | Manager_group.js | Sub-admin can remove other sub-admins |
| 21 | Manager_group.js | Block/View profile buttons no-op |
| 22 | Personal_page.js | Batch 500-op limit not handled |
| 23 | Personal_page.js | Race condition photo update |
| 24 | Personal_page.js | Email exposed on other profiles |
| 25 | VideoCall.js | No concurrent call prevention |
| 26 | VideoCall.js | acceptCall not awaited before WebRTC |
| 27 | VideoCall.js | Firebase RTDB cleanup unreliable |
| 28 | MyPosts.js | Pull-to-refresh hangs indefinitely |
| 29 | MyPosts.js | Delete doesn't clean up media |
| 30 | Discovery.js | Navigation to non-existent screens |
| 31 | PlayVideo.js | Full GET instead of HEAD for type detect |

---

## 5. TÍNH NĂNG CÒN THIẾU SO VỚI CHUẨN MẠNG XÃ HỘI

### 5.1 Thiếu quan trọng (Must-have cho social app)

| # | Tính năng | Module | Độ ưu tiên |
|---|-----------|--------|-----------|
| 1 | **Read receipts** (đã xem / đã gửi / đã nhận) | Chat | Cao |
| 2 | **Typing indicator** (đang nhập...) | Chat | Cao |
| 3 | **Online/Offline presence** | User | Cao |
| 4 | **Unread count** per conversation | Chat | Cao |
| 5 | **Block/Unblock user** | Friend | Cao |
| 6 | **Report user/content** | All | Cao |
| 7 | **Post privacy settings** (public/friends/private) | Social | Cao |
| 8 | **Content moderation** | Social | Cao |
| 9 | **Account deletion** (GDPR compliance) | Auth | Cao |
| 10 | **Push notification settings** per type | Notification | Trung bình |

### 5.2 Nên có (Should-have)

| # | Tính năng | Module |
|---|-----------|--------|
| 11 | Message editing | Chat |
| 12 | Fuzzy/prefix search (tìm gần đúng) | Friend |
| 13 | Comment deletion/editing | Social |
| 14 | Link preview / Open Graph | Chat + Social |
| 15 | Group invite link / QR code | Group |
| 16 | Call history / logs | Video Call |
| 17 | Mutual friend suggestions | Friend |
| 18 | Bookmark / Save post | Social |
| 19 | Notification grouping | Notification |
| 20 | User bio / status text | Profile |

### 5.3 Nice-to-have

| # | Tính năng | Module |
|---|-----------|--------|
| 21 | Stickers / GIF library | Chat |
| 22 | Location sharing | Chat |
| 23 | Poll / Survey posts | Social |
| 24 | Hashtag support | Social |
| 25 | User tagging / @mentions | Social + Chat |
| 26 | Group video call | Video Call |
| 27 | Screen sharing | Video Call |
| 28 | Custom chat wallpaper | Chat |
| 29 | Disappearing messages | Chat |
| 30 | Cover photo | Profile |

---

## 6. ĐỀ XUẤT QUY TRÌNH NÂNG CẤP

### Phase 1: Fix P0 Bugs (Tuần 1-2) — KHẨN CẤP

```
1.1 Fix memory leaks (Chat_fr, Friend_sent, TimeLine)
    → Sửa async unsubscribe pattern
    → Cleanup nested listeners
    
1.2 Fix data corruption bugs
    → ID_roomChat bug (Friend_received)
    → Select_Ad arrayRemove sai doc
    → handleClearHistory xóa cho tất cả (Option_chat)
    → Admin bị xóa (Manager_group)
    → Duplicate members (Add_mem_gr)
    
1.3 Add authorization checks
    → Setting_group: check admin before dissolve
    → Manager_group: check admin before remove
    → Add_mem_gr: check permission before add
    
1.4 Add confirmation dialogs
    → Setting_group dissolve
    → Manager_group remove/promote
    → Select_Ad transfer admin
    
1.5 Atomic operations
    → Convert all dual-writes to writeBatch
    → Use transactions for read-modify-write
```

### Phase 2: Integrate Service Layer (Tuần 3-4)

```
2.1 Friend screens → friendService.js
    → Friend_received.js → acceptFriendRequest()
    → Friend_sent.js → cancelFriendRequest()
    → SearchFriend.js → sendFriendRequest()
    
2.2 Group screens → groupService.js
    → Add_group.js → createGroup()
    → Manager_group.js → removeMember(), toggleSubAdmin()
    → Setting_group.js → dissolveGroup()
    → Select_Ad.js → transferAdminAndLeave()
    
2.3 Chat screens → chatService.js
    → Chat_fr.js → sendMessage(), recallMessage()
    → Option_chat.js → toggleMuteChat(), togglePinChat()
    
2.4 Social screens → postService.js
    → TimeLine.js → createPost(), togglePostReaction()
    → PostDetail.js → addComment(), toggleCommentLike()
    
2.5 Tạo notificationService.js (chưa có)
```

### Phase 3: Extract Shared Components (Tuần 5)

```
3.1 SkeletonLoader component
    → Extract từ Chat.js, tái sử dụng cho Friends, SearchFriend
    
3.2 Áp dụng EmptyState component cho tất cả screens
    
3.3 ActionSheet component
    → Extract từ Chat.js modal pattern
    
3.4 Áp dụng Avatar component thống nhất
    
3.5 confirmAlert utility function
```

### Phase 4: Missing Features - Priority 1 (Tuần 6-8)

```
4.1 Read receipts + Delivered status
    → Thêm fields: lastReadAt, deliveredAt per user per conversation
    
4.2 Typing indicator
    → Realtime Database: /typing/{roomId}/{uid}
    
4.3 Online/Offline presence
    → Realtime Database: /presence/{uid}
    
4.4 Unread count per conversation
    → Derived from lastReadAt vs lastMessage.createdAt
    
4.5 Block/Unblock user
    → Collection: users/{uid}/blockedUsers
    
4.6 Move TURN credentials to server-side
    → API endpoint trên notification-server
```

### Phase 5: Polish & Scale (Tuần 9-12)

```
5.1 Replace "all posts" scan → collectionGroup query
5.2 Add file size validation (max 10MB image, 50MB video)
5.3 Image compression before upload
5.4 Debounce all search inputs (300ms)
5.5 Proper error handling + user feedback trên mọi screen
5.6 Add pagination cho Friends, Groups, Comments
5.7 Post privacy settings
5.8 Report user/content system
```

---

## TỔNG KẾT

| Metric | Số lượng |
|--------|---------|
| Tổng screens phân tích | 31 |
| Lỗi P0 (Critical) | 38 |
| Lỗi P1 (High) | 30+ |
| Common patterns cần extract | 9 |
| Services đã tạo nhưng chưa dùng | 7/8 |
| Tính năng thiếu (must-have) | 10 |
| Tính năng thiếu (should-have) | 10 |
| Tính năng thiếu (nice-to-have) | 10 |

**Ưu tiên #1:** Fix 38 lỗi P0 — đặc biệt memory leaks, data corruption, và security issues.
**Ưu tiên #2:** Integrate service layer đã tạo — loại bỏ code trùng lặp và đảm bảo atomic operations.
**Ưu tiên #3:** Extract shared components — giảm code duplicate ~40%.
