# ChatLofi - Phân Tích Kiến Trúc & Nghiệp Vụ

## 1. Tổng Quan Hệ Thống

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.73.2 + Expo 50 |
| Auth | Firebase Auth (email/password + email verification) |
| Database | Cloud Firestore (chính) + Realtime Database (WebRTC signaling) |
| Storage | Firebase Storage (ảnh, video, tài liệu, audio) |
| Push | FCM + Notification Server (Render.com) |
| Navigation | React Navigation v6 (Native Stack + Bottom Tabs + Material Top Tabs) |
| Chat UI | react-native-gifted-chat |
| Video Call | react-native-webrtc + STUN/TURN |
| State | React Context API (3 contexts) |

### 31 Screens
```
Auth:         PermissionsScreen → Login ↔ Signup
Tabs:         Chat | Phonebook | Discovery | TimeLine | Profile
Chat:         Chat_fr, Option_chat, Forward_message, PlayVideo, VideoCall
Group:        Add_group, Setting_group, Manager_group, Add_mem_gr, Select_Ad
Friend:       SearchFriend, FriendRequest, Friend_received, Friend_sent, Friends
Social:       PostDetail, MyPosts
Profile:      Personal_page, Edit_in4Personal, Setting_app, Notifications
Other:        Phonebook_2, Groups
```

---

## 2. Firestore Data Model

### Collections & Subcollections
```
users/{uid}                          → Hồ sơ người dùng
  ├── friendData/{docId}             → Danh sách bạn bè
  ├── friend_Sents/{docId}           → Lời mời đã gửi
  └── friend_Receiveds/{docId}       → Lời mời đã nhận

Chats/{roomId}                       → Phòng chat (1-1 & nhóm)
  └── chat_mess/{msgId}              → Tin nhắn

Group/{roomId}                       → Metadata nhóm (MIRROR của Chats)

posts/{postId}                       → Bài đăng
  └── comments/{commentId}           → Bình luận

notifications/{notifId}              → Thông báo push
calls/{roomId}                       → WebRTC signaling (Realtime Database)
```

### Quan hệ dữ liệu quan trọng
- **Group ↔ Chats**: Dual-write pattern — mỗi thao tác nhóm ghi vào CẢ HAI collection
- **users.photoURL → posts.userInfo.photoURL → comments.commenterPhoto**: Denormalized — khi đổi ảnh phải batch-update tất cả
- **users.name → posts.userInfo.name → comments.commenterName**: Tương tự

---

## 3. Phân Tích Nghiệp Vụ Theo Module

### 3.1 Auth (Xác thực)
```
Đăng ký → createUser → sendEmailVerification → signOut (chờ verify)
Đăng nhập → signIn → check emailVerified → cho vào app / chặn
Quên MK → sendPasswordResetEmail (cooldown 60s)
Đăng xuất → removePushToken → clearNotifications → signOut (cả 2 Auth)
```
**Vấn đề**: Dùng 2 Firebase Auth instances (JS SDK + Native) để sync Realtime Database, logic sync chưa hoàn chỉnh.

### 3.2 Chat (Tin nhắn)
```
Danh sách chat:
  - Real-time via onSnapshot trên Chats (where UID array-contains user.uid)
  - Pin/Mute: Optimistic UI + arrayUnion/arrayRemove trên pinnedBy/mutedUsers
  - Soft-delete: Push {uidDelete, timeDelete} vào detailDelete array

Gửi tin nhắn:
  1. Upload media → Firebase Storage (images/videos/documents/audios/{uid}/)
  2. addDoc → Chats/{roomId}/chat_mess
  3. sendMessageNotification → Notification Server

Thu hồi (10 phút):
  - updateDoc: text="Tin nhắn đã được thu hồi!", isRecalled=true, xóa media fields

Xóa (chỉ mình):
  - Push {uidDelete, timeDelete} vào deleteDetail_mess array

Reply: Prepend "[tên: nội dung gốc]\n\n" vào text
Forward: Navigate → Forward_message → addDoc vào selected rooms
Reactions: 6 emoji, toggle arrayUnion/arrayRemove trên reactions.{emoji}
```

### 3.3 Group (Nhóm)
```
Tạo nhóm:
  - Chọn ≥2 bạn → tạo random hex ID → setDoc BOTH Group + Chats
  
Quản lý:
  - Thêm thành viên: arrayUnion UID vào cả Group + Chats
  - Xóa thành viên: arrayRemove UID + Sub_Admin khỏi cả hai
  - Chuyển admin: updateDoc Admin_group + remove old admin from UID
  - Giải tán: deleteDoc BOTH Group + Chats (HARD DELETE!)
  - Rời nhóm: Admin → chuyển admin trước; Member → arrayRemove
```
**Vấn đề nghiêm trọng**: Không dùng transaction/batch → race condition khi dual-write.

### 3.4 Friend (Bạn bè)
```
Tìm bạn:
  - Query users where name == input (exact match, KHÔNG phải contains)
  - Check 4 trạng thái: isFriend / hasSentRequest / hasReceivedRequest / stranger

Gửi lời mời:
  - addDoc → users/{me}/friend_Sents + users/{them}/friend_Receiveds

Chấp nhận:
  - addDoc → BOTH users' friendData subcollection
  - deleteDoc → BOTH sides' request docs
  - sendFriendRequestAcceptedNotification

Từ chối / Hủy:
  - deleteDoc → BOTH sides' request docs

Hủy kết bạn:
  - deleteDoc → BOTH users' friendData/{docId}
```
**Vấn đề**: Tìm bạn chỉ exact match tên, không search by email/phone. Auto-cleanup stale requests chạy client-side.

### 3.5 Social (Mạng xã hội)
```
Tạo bài:
  - Upload media → Storage posts/{uid}/
  - addDoc → posts (text, media[], userInfo{}, createdAt)

Feed:
  - Cursor-based pagination (10/page, startAfter)
  - 6 loại reaction: like/love/haha/wow/sad/angry → reactions.{userId}.type

Bình luận:
  - Subcollection posts/{postId}/comments
  - Reply: sets replyTo field + @mention prefix
  - Like comment: toggle userId in likes array

Chia sẻ:
  - Tạo post mới với sharedFrom: originalPostId
```

### 3.6 Video Call
```
Flow:
  1. Caller: tạo RTCPeerConnection → createOffer → set call data vào RTD
  2. Callee: nhận qua onChildAdded → createAnswer → set answer vào RTD  
  3. ICE candidates trao đổi qua callerCandidates/calleeCandidates
  4. Timeout 60s → auto-end nếu không trả lời
  5. Kết thúc: remove() call data khỏi RTD

STUN/TURN:
  - Google STUN: stun:stun.l.google.com:19302
  - Metered.ca TURN (credentials hardcoded)
```

### 3.7 Notifications (Thông báo)
```
Server: Node.js trên Render.com → Firebase Admin SDK → FCM
Client: 
  - Foreground: FCM onMessage → scheduleNotificationAsync (local)
  - Background: FCM background handler (index.js)
  - Killed: getInitialNotification
  
Notifications.js routing:
  type → screen mapping:
  - new_message → Chat_fr
  - friend_request → Friend_received  
  - friend_accept → Personal_page / Friends
  - post_reaction/comment/share/mention → PostDetail
  - group_invite → Chat_fr
  - comment_reply/comment_like → PostDetail
```

---

## 4. Vấn Đề Kiến Trúc Hiện Tại

### 🔴 Nghiêm trọng (Cần sửa)

#### 4.1 Tight Coupling qua Navigation Params
`Chat_fr` nhận **10 params khác nhau** từ **6 nguồn** — mỗi nguồn truyền tập con khác nhau:

| Nguồn | Params |
|-------|--------|
| Chat.js | `friendData, ID_room1, chatData` |
| Friends.js | `friendData2` |
| Groups.js | `GroupData` |
| Notifications.js | `friendId, friendName, friendPhoto, roomId, RoomID` |
| StackNavigator.js | `callerUid, recipientUid, ...` (VideoCall redirect) |

**Hậu quả**: Chat_fr phải handle mọi tổ hợp params có thể, code phức tạp, khó maintain.

#### 4.2 Inconsistent Naming
Cùng 1 khái niệm nhưng tên param khác nhau:
- Room ID: `ID_room1` / `roomId` / `RoomID` / `RoomID1` / `ID_roomChat`
- Friend data: `friendData` / `friendData2` / `friendId` / `friendUID`
- Admin: `Admin_group` / `Admin_group1`

#### 4.3 Dual-Write Không An Toàn
Group operations ghi vào CẢ `Group` + `Chats` — nếu 1 write fail, data inconsistent. Không dùng `writeBatch` hay `runTransaction`.

#### 4.4 Business Logic Trong Screens
100% business logic (Firestore CRUD, validation, file upload) nằm trực tiếp trong screen components. Không có service layer.

### 🟡 Trung bình (Nên cải thiện)

#### 4.5 ChatContext Quá Đơn Giản
```js
// Hiện tại - chỉ là global state holder
const [chats, setChats] = useState([]);
```
Không có logic xử lý, không cache, không optimistic update pattern.

#### 4.6 NotificationContext Quá Lớn
~400 dòng, chứa 12+ hàm `sendXxxNotification` — mỗi hàm chỉ là HTTP fetch wrapper với pattern giống nhau.

#### 4.7 Denormalized Data Cascade
Khi đổi tên/ảnh → phải batch-update ALL posts + ALL comments. Nếu có 1000 bài viết, sẽ rất chậm.

#### 4.8 Không có Error Boundary
Không có xử lý lỗi tập trung. Mỗi screen tự try/catch riêng lẻ.

### 🟢 Nhẹ (Nice to have)

#### 4.9 Firebase Config Hardcoded
API key và credentials nằm trực tiếp trong source code.

#### 4.10 Không có TypeScript
Không có type checking → dễ truyền sai params mà không biết.

---

## 5. Quy Trình Đề Xuất (Để Nâng Cấp)

### Phase 1: Service Layer (Tách logic khỏi screens)

Tạo `src/services/` với:
```
src/services/
  ├── authService.js       → login, signup, logout, resetPassword
  ├── chatService.js       → fetchChats, sendMessage, recallMessage, deleteMessage
  ├── friendService.js     → sendRequest, acceptRequest, unfriend, searchUsers
  ├── groupService.js      → createGroup, addMember, removeMember, dissolveGroup
  ├── postService.js       → createPost, deletePost, addReaction, addComment
  ├── storageService.js    → uploadImage, uploadVideo, uploadAudio, uploadDocument
  ├── notificationService.js → sendNotification (unified API)
  └── userService.js       → updateProfile, updatePhoto, fetchUserData
```

### Phase 2: Chuẩn hóa Navigation Params

**Quy tắc**: Mỗi screen chỉ nhận 1-2 ID params → tự fetch data cần thiết.

Trước:
```js
// 6 nguồn truyền 10 params khác nhau
navigation.navigate('Chat_fr', { friendData, ID_room1, chatData, friendData2, GroupData, ... })
```

Sau:
```js
// Tất cả nguồn chỉ truyền roomId
navigation.navigate('Chat_fr', { roomId: 'xxx' })
// Chat_fr tự fetch room data + member data từ Firestore
```

### Phase 3: Cải thiện Contexts

```
src/contexts/
  ├── AuthContext.js       → user, userData, isLoggedIn (thay vì dùng AuthenticatedUserContext trong StackNavigator)
  ├── ChatContext.js       → chats, pinnedChats, mutedChats + methods
  ├── UserContext.js       → currentUser profile data (real-time)
  ├── NotificationContext.js → FCM + routing (giữ nguyên nhưng refactor)
  └── ToastContext.js      → giữ nguyên
```

### Phase 4: Chuẩn hóa Naming Convention

| Hiện tại | Đề xuất |
|----------|---------|
| `ID_room1`, `roomId`, `RoomID`, `RoomID1` | `roomId` |
| `friendData`, `friendData2` | `userData` hoặc `userId` |
| `Admin_group`, `Admin_group1` | `adminId` |
| `UID`, `UID1` | `memberIds` |
| `ChatData_props`, `ChatData_props1` | `chatData` |
| `Name_group` | `groupName` |
| `Photo_group` | `groupPhoto` |
| `Sub_Admin` | `subAdminIds` |
| `UID_Chats` | `chatKey` |

### Phase 5: Safe Dual-Write

```js
// Trước (unsafe)
await updateDoc(doc(db, 'Group', roomId), { UID: arrayRemove(uid) });
await updateDoc(doc(db, 'Chats', roomId), { UID: arrayRemove(uid) });

// Sau (safe)
const batch = writeBatch(db);
batch.update(doc(db, 'Group', roomId), { UID: arrayRemove(uid) });
batch.update(doc(db, 'Chats', roomId), { UID: arrayRemove(uid) });
await batch.commit();
```

---

## 6. Mức Độ Ưu Tiên

| Ưu tiên | Hành động | Lý do |
|---------|-----------|-------|
| **P0** | Tạo Service Layer cho Chat + Group | Giảm coupling, dễ test, dễ maintain |
| **P0** | Batch writes cho Group operations | Tránh data inconsistency |
| **P1** | Chuẩn hóa navigation params | Giảm complexity Chat_fr từ 10→2 params |
| **P1** | Chuẩn hóa naming convention | Consistency across codebase |
| **P2** | Tách AuthContext riêng | Hiện tại auth state nằm trong StackNavigator |
| **P2** | Refactor NotificationContext | Giảm 12 hàm trùng lặp → 1 hàm generic |
| **P3** | TypeScript migration | Bắt lỗi type tại compile time |
| **P3** | Environment config | Tách Firebase credentials ra .env |

---

## 7. Navigation Flow Diagram

```
[PermissionsScreen] → [Login] ↔ [Signup]
                          ↓
                    [BottomTabs]
                    ├── Tin nhắn (Chat) ────→ Chat_fr ──→ Option_chat ──→ Setting_group
                    │     │                    │   │                        Manager_group
                    │     │                    │   │                        Add_mem_gr
                    │     │                    │   │                        Select_Ad
                    │     │                    │   ├──→ Forward_message
                    │     │                    │   ├──→ PlayVideo  
                    │     │                    │   └──→ VideoCall
                    │     ├──→ SearchFriend
                    │     └──→ Notifications ──→ (Routes to 6+ screens)
                    │
                    ├── Danh bạ (Phonebook)
                    │     ├── Friends ──→ Chat_fr / Personal_page / FriendRequest
                    │     └── Groups  ──→ Chat_fr / Add_group
                    │
                    ├── Khám phá (Discovery)
                    │
                    ├── Nhật ký (TimeLine) ──→ PostDetail / Personal_page / MyPosts
                    │
                    └── Cá nhân (Profile) ──→ Personal_page ──→ Edit_in4Personal
                                           ──→ Setting_app
                                           ──→ MyPosts ──→ PostDetail
```

---

## 8. Kết Luận

**App đã hoạt động đủ tính năng** cho một ứng dụng chat hoàn chỉnh:
- ✅ Chat 1-1 & nhóm (text, ảnh, video, audio, file, voice)
- ✅ Thu hồi, xóa, reply, forward, reactions
- ✅ Video call WebRTC
- ✅ Quản lý nhóm (tạo, thêm/xóa thành viên, chuyển admin, giải tán)
- ✅ Bạn bè (gửi/nhận/hủy lời mời, hủy kết bạn)
- ✅ Mạng xã hội (đăng bài, reactions, comments, share)
- ✅ Push notifications (đầy đủ loại)
- ✅ Ghim/tắt thông báo chat

**Vấn đề chính là kiến trúc code**, không phải tính năng:
1. Business logic trộn lẫn trong UI components
2. Navigation params coupling quá chặt
3. Dual-write pattern không an toàn
4. Naming inconsistent

**Giải pháp**: Áp dụng Phase 1-2 (Service Layer + Chuẩn hóa params) sẽ cải thiện đáng kể khả năng nâng cấp và maintain.
