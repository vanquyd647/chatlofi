import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    StatusBar,
    Alert,
    Text,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
    Image,
    Vibration,
    BackHandler
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RTCPeerConnection, RTCView, mediaDevices, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getDatabase, ref, set, onValue, push, remove, onChildAdded, serverTimestamp, runTransaction, get } from '@react-native-firebase/database';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

// WebRTC Configuration với STUN/TURN servers
// For production, use your own TURN server (coturn) for reliability
const configuration = {
    iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Additional public STUN servers for better connectivity
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voip.blackberry.com:3478' },
        // TURN servers for NAT traversal (when STUN fails)
        // Option 1: Open Relay TURN (free, limited)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        // Option 2: ExpressTurn (backup)
        {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'efoca',
            credential: 'efoca',
        },
    ],
    iceCandidatePoolSize: 10,
};

const VideoCall = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const {
        callerUid,
        recipientUid,
        callerName,
        recipientName,
        recipientAvatar,
        isInitiator = true, // true = người gọi, false = người nhận
        roomId: passedRoomId, // roomId được truyền từ caller hoặc notification
    } = route.params || {};

    // States
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState(isInitiator ? 'Đang gọi...' : 'Cuộc gọi đến...');
    const [isConnected, setIsConnected] = useState(false);
    const [callState, setCallState] = useState(isInitiator ? 'calling' : 'incoming'); // calling, incoming, connected, ended
    const [partnerInfo, setPartnerInfo] = useState({ name: recipientName || callerName, avatar: recipientAvatar });

    // Refs
    const peerConnection = useRef(null);
    const callTimerRef = useRef(null);
    const roomRef = useRef(null);
    const callTimeoutRef = useRef(null);
    const isEndingRef = useRef(false); // Ngăn spam kết thúc nhiều lần
    const hasStartedRef = useRef(false); // Ngăn startWebRTC lặp
    const listenersRef = useRef({ status: null, endCall: null, offer: null, answer: null, candidates: null }); // Track Firebase listeners for cleanup
    const iceCandidateQueueRef = useRef([]); // Queue ICE candidates until remote description is set
    const remoteDescriptionSetRef = useRef(false); // Track if remote description has been set
    const initialNegotiationDoneRef = useRef(false); // Track if initial negotiation is done (for ICE restart)

    // Sử dụng roomId được truyền vào hoặc tạo mới (fallback)
    const generateRoomId = () => {
        if (passedRoomId) {
            console.log('📍 Sử dụng passedRoomId:', passedRoomId);
            return passedRoomId;
        }
        const sortedIds = [callerUid, recipientUid].sort();
        const generatedId = `call_${sortedIds[0]}_${sortedIds[1]}`; // MUST match notification server format
        console.log('📍 Tạo roomId mới:', generatedId);
        return generatedId;
    };

    const roomId = generateRoomId();
    const currentUserId = isInitiator ? callerUid : recipientUid;

    console.log('🎬 VideoCall params:', {
        callerUid,
        recipientUid,
        callerName,
        isInitiator,
        passedRoomId,
        roomId,
        currentUserId
    });

    // Reset hasStartedRef when entering VideoCall to prevent "already started" bug
    useEffect(() => {
        console.log('🔄 Resetting refs on mount');
        hasStartedRef.current = false;
        isEndingRef.current = false;
        remoteDescriptionSetRef.current = false;
        iceCandidateQueueRef.current = [];
        initialNegotiationDoneRef.current = false;

        // Cleanup when component unmounts
        return () => {
            console.log('🧹 Component unmounting - cleaning up');
            Vibration.cancel();
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        StatusBar.setHidden(true);

        // Xử lý nút back
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleCallEnd();
            return true;
        });

        // Lấy thông tin đối tác
        fetchPartnerInfo();

        if (isInitiator) {
            // Người gọi: Tạo cuộc gọi trong Firebase
            initiateCall();
        } else {
            // Người nhận: Phát nhạc chuông và rung
            playRingtone();
        }

        // Lắng nghe trạng thái cuộc gọi
        listenToCallStatus();

        return () => {
            StatusBar.setHidden(false);
            backHandler.remove();
            cleanup();
        };
    }, []);

    // Lấy thông tin đối tác
    const fetchPartnerInfo = async () => {
        try {
            const partnerId = isInitiator ? recipientUid : callerUid;
            const db = getFirestore();
            const userDoc = await getDoc(doc(db, 'users', partnerId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setPartnerInfo({
                    name: userData.name || 'Người dùng',
                    avatar: userData.avatar || null
                });
            }
        } catch (error) {
            console.log('Lỗi lấy thông tin đối tác:', error);
        }
    };

    // Phát nhạc chuông (chỉ sử dụng vibration)
    const playRingtone = async () => {
        try {
            console.log('🔔 Phát vibration cho cuộc gọi đến');
            // Sử dụng vibration liên tục như nhạc chuông
            // Pattern: chờ 0ms, rung 1000ms, nghỉ 500ms, rung 1000ms - lặp lại
            Vibration.vibrate([0, 1000, 500, 1000], true);
        } catch (error) {
            console.log('Không thể phát vibration:', error);
        }
    };

    // Dừng vibration
    const stopRingtone = () => {
        console.log('🔕 Dừng vibration');
        Vibration.cancel();
    };

    // Người gọi: Tạo cuộc gọi
    const initiateCall = async () => {
        console.log('📞 === CALLER: initiateCall() START ===');
        try {
            console.log('📞 Getting Firebase Realtime Database instance...');
            const db = getDatabase();
            console.log('✅ DB instance:', !!db);

            const callRef = ref(db, `calls/${roomId}`);
            console.log('✅ CallRef path:', `calls/${roomId}`);

            // Clean old data first (fire-and-forget to avoid hang)
            console.log('🧹 Cleaning old call data...');
            try {
                await Promise.race([
                    remove(callRef),
                    new Promise(resolve => setTimeout(resolve, 1000)) // 1s timeout
                ]);
                console.log('✅ Old data cleaned (or timeout)');
            } catch (cleanError) {
                console.log('⚠️ Could not clean old data:', cleanError.message);
            }

            // Tạo call request sạch trong Firebase Realtime Database
            console.log('📝 Creating call record with data:', {
                callerId: callerUid,
                callerName: callerName,
                recipientId: recipientUid,
                status: 'ringing'
            });

            const callData = {
                callerId: callerUid,
                callerName: callerName,
                recipientId: recipientUid,
                status: 'ringing',
                createdAt: Date.now(),
            };

            // Write to Firebase using callback (Promise.await doesn't work)
            console.log('📝 Calling set() on Firebase RTD...');
            await new Promise((resolve, reject) => {
                set(callRef, callData)
                    .then(() => {
                        console.log('✅✅✅ set() completed successfully');
                        resolve();
                    })
                    .catch(error => {
                        console.error('❌ set() failed:', error);
                        reject(error);
                    });

                // Fallback: If promise doesn't resolve in 3s, assume success
                setTimeout(() => {
                    console.log('⚠️ set() timeout - assuming success (data already written)');
                    resolve();
                }, 3000);
            });
            console.log('✅✅✅ Call record created in Firebase RTD');

            // Verify data was written
            console.log('🔍 Verifying data was written...');
            const snapshot = await get(callRef);
            console.log('🔍 Snapshot exists:', snapshot.exists());
            if (snapshot.exists()) {
                console.log('🔍 Snapshot data:', snapshot.val());
            } else {
                console.error('❌ Data was deleted immediately after write!');
            }
            console.log('✅✅✅ Call record SUCCESSFULLY created in Firebase RTD');

            // NOTE: Push notification đã được gửi từ Chat_fr.js trước khi navigate
            // Không gửi duplicate ở đây để tránh callee nhận 2 notifications

            // Bắt đầu WebRTC ngay sau khi tạo call record
            console.log('🎥🎥🎥 === STARTING WEBRTC FOR CALLER ===');
            await startWebRTC(true);
            console.log('✅✅✅ WebRTC started successfully');

            // Timeout sau 60 giây nếu không có ai trả lời
            console.log('⏰ Setting 60s timeout...');
            callTimeoutRef.current = setTimeout(() => {
                if (callState === 'calling') {
                    console.log('⏰ Call timeout - no response after 60s');
                    setConnectionStatus('Không có phản hồi');
                    handleCallEnd();
                }
            }, 60000);

            console.log('📞 === CALLER: initiateCall() COMPLETE ===');

        } catch (error) {
            console.error('❌❌❌ CRITICAL ERROR in initiateCall:', error);
            console.error('❌ Error name:', error.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error stack:', error.stack);
            Alert.alert('Lỗi', `Không thể tạo cuộc gọi: ${error.message}`);
            navigation.goBack();
        }
    };

    // Lắng nghe trạng thái cuộc gọi
    const listenToCallStatus = () => {
        console.log('👂 Setting up call status listener for roomId:', roomId);
        const db = getDatabase();
        const callStatusRef = ref(db, `calls/${roomId}/status`);

        // Listen status changes and store unsubscribe function
        const statusUnsubscribe = onValue(callStatusRef, async (snapshot) => {
            const status = snapshot.val();
            console.log('📞 Call status changed:', status, 'isInitiator:', isInitiator);
            console.log('📞 Snapshot exists:', snapshot.exists());

            // Check full call data to see if entire call was deleted
            const fullCallRef = ref(db, `calls/${roomId}`);
            const fullSnapshot = await get(fullCallRef);
            console.log('📞 Full call data exists:', fullSnapshot.exists());
            if (fullSnapshot.exists()) {
                console.log('📞 Full call data:', fullSnapshot.val());
            } else {
                console.error('❌ ENTIRE CALL WAS DELETED from Firebase RTD!');
            }

            switch (status) {
                case 'accepted':
                    // Chỉ người gọi (initiator) cần cập nhật UI khi callee accepts
                    // WebRTC đã được start trong initiateCall(), không start lại
                    if (isInitiator) {
                        console.log('✅ Người gọi nhận được accepted từ callee');

                        // Dừng ringtone và vibration
                        stopRingtone();
                        Vibration.cancel();

                        setCallState('connected');
                        setConnectionStatus('Đang thiết lập kết nối video...');

                        // Clear timeout
                        if (callTimeoutRef.current) {
                            clearTimeout(callTimeoutRef.current);
                            callTimeoutRef.current = null;
                        }

                        // NOTE: Timer sẽ được start trong ontrack khi video thực sự connected
                    }
                    break;

                case 'declined':
                    // Cuộc gọi bị từ chối
                    console.log('📵 Cuộc gọi bị từ chối');
                    setConnectionStatus('Cuộc gọi bị từ chối');
                    stopRingtone();
                    Vibration.cancel();
                    if (callTimeoutRef.current) {
                        clearTimeout(callTimeoutRef.current);
                    }
                    // Cleanup ngay lập tức không delay
                    cleanup();
                    navigation.goBack();
                    break;

                case 'cancelled':
                    // Người gọi đã hủy cuộc gọi
                    console.log('📵 Cuộc gọi đã bị hủy bởi người gọi');
                    setConnectionStatus('Cuộc gọi đã bị hủy');
                    stopRingtone();
                    Vibration.cancel();
                    // Cleanup ngay lập tức không delay
                    cleanup();
                    navigation.goBack();
                    break;

                case 'ended':
                    // Cuộc gọi kết thúc
                    console.log('📵 Cuộc gọi đã kết thúc');
                    setConnectionStatus('Cuộc gọi đã kết thúc');
                    stopRingtone();
                    Vibration.cancel();
                    // Cleanup ngay lập tức không delay
                    cleanup();
                    navigation.goBack();
                    break;
            }
        });
        listenersRef.current.status = statusUnsubscribe;

        // Listen endCall event (khi một bên kết thúc cuộc gọi đang diễn ra)
        const endCallRef = ref(db, `calls/${roomId}/endCall`);
        const endCallUnsubscribe = onValue(endCallRef, (snapshot) => {
            const endData = snapshot.val();
            if (endData && endData.endedBy !== currentUserId) {
                console.log('📵 Cuộc gọi đã kết thúc bởi đối phương');
                setConnectionStatus('Cuộc gọi đã kết thúc');
                stopRingtone();
                Vibration.cancel();
                // Cleanup ngay lập tức không delay
                cleanup();
                navigation.goBack();
            }
        });
        listenersRef.current.endCall = endCallUnsubscribe;
    };

    // Người nhận: Chấp nhận cuộc gọi
    const acceptCall = async () => {
        console.log('✅ Người nhận chấp nhận cuộc gọi, roomId:', roomId);
        try {
            // Check if call still exists and is in valid state before accepting
            const db = getDatabase();
            const callRef = ref(db, `calls/${roomId}`);
            const snapshot = await get(callRef);

            if (!snapshot.exists()) {
                console.error('❌ Call was already deleted, cannot accept');
                Alert.alert('Lỗi', 'Cuộc gọi đã kết thúc');
                navigation.goBack();
                return;
            }

            // Check if call is still in 'ringing' state (not cancelled by caller)
            const callData = snapshot.val();
            if (callData.status !== 'ringing') {
                console.error('❌ Call is no longer ringing, status:', callData.status);
                Alert.alert('Lỗi', 'Cuộc gọi đã bị hủy');
                navigation.goBack();
                return;
            }

            stopRingtone();
            Vibration.cancel();
            setCallState('connected');
            setConnectionStatus('Đang kết nối...');

            console.log('📝 Đang cập nhật status thành accepted...');

            // Fire-and-forget (don't await runTransaction)
            runTransaction(callRef, (callData) => {
                if (!callData) return callData;
                if (callData.status !== 'ringing') {
                    console.log('⚠️ Không thể accept vì status hiện tại:', callData.status);
                    return callData;
                }
                return {
                    ...callData,
                    status: 'accepted',
                    respondedAt: Date.now(),
                };
            })
                .then(() => console.log('✅ Status updated to accepted'))
                .catch(err => console.error('❌ Failed to update status:', err.message));

            console.log('✅ Accept request sent (async)');

            // Start WebRTC only if not already started
            // NOTE: startWebRTC() has its own hasStartedRef check, so we don't set it here
            if (hasStartedRef.current) {
                console.log('⚠️ WebRTC already started, skipping');
                return;
            }

            console.log('🎥 Người nhận bắt đầu WebRTC...');
            // DO NOT set hasStartedRef here - let startWebRTC() handle it
            await startWebRTC();
        } catch (error) {
            console.error('Lỗi chấp nhận cuộc gọi:', error);
            Alert.alert('Lỗi', 'Không thể kết nối cuộc gọi');
        }
    };

    // Người nhận: Từ chối cuộc gọi
    const declineCall = async () => {
        console.log('❌ Từ chối cuộc gọi, roomId:', roomId);
        try {
            stopRingtone();
            Vibration.cancel();

            const db = getDatabase();
            // Fire-and-forget decline
            runTransaction(ref(db, `calls/${roomId}`), (callData) => {
                if (!callData) return callData;
                if (callData.status !== 'ringing') {
                    console.log('⚠️ Không thể decline vì status hiện tại:', callData.status);
                    return callData;
                }
                return {
                    ...callData,
                    status: 'declined',
                    respondedAt: Date.now(),
                };
            })
                .then(() => console.log('✅ Status updated to declined'))
                .catch(err => console.error('❌ Failed to decline:', err.message));

            // Xóa cuộc gọi sau 2 giây (fire-and-forget)
            setTimeout(() => {
                const callRef = ref(db, `calls/${roomId}`);
                remove(callRef)
                    .then(() => console.log('✅ Call deleted'))
                    .catch(e => console.log('⚠️ Could not delete call:', e.message));
            }, 2000);

            // Cleanup trước khi goBack để dừng vibration
            cleanup();
            navigation.goBack();
        } catch (error) {
            console.error('Lỗi từ chối cuộc gọi:', error);
            navigation.goBack();
        }
    };

    // Bắt đầu WebRTC
    const startWebRTC = async () => {
        console.log('🎥🎥🎥 === startWebRTC() CALLED ===');
        console.log('🎥 isInitiator:', isInitiator);
        console.log('🎥 hasStartedRef.current BEFORE:', hasStartedRef.current);

        if (hasStartedRef.current) {
            console.log('⚠️⚠️⚠️ WebRTC ALREADY STARTED, SKIPPING...');
            return;
        }
        hasStartedRef.current = true;
        console.log('✅ Set hasStartedRef.current = true');

        try {
            // Lấy local stream
            console.log('📹📹📹 Requesting camera/mic permissions...');
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    facingMode: 'user',
                    width: 640,
                    height: 480,
                },
            });
            console.log('✅✅✅ GOT CAMERA/MIC SUCCESSFULLY');
            console.log('📹 Stream ID:', stream.id);
            console.log('📹 Stream tracks:', stream.getTracks().map(t => `${t.kind}(${t.id})`));
            setLocalStream(stream);

            // Tạo peer connection
            console.log('🔗 Tạo RTCPeerConnection...');
            const pc = new RTCPeerConnection(configuration);
            peerConnection.current = pc;

            // Add local tracks to peer connection
            stream.getTracks().forEach(track => {
                console.log('➕ Adding track:', track.kind);
                pc.addTrack(track, stream);
            });

            // Handle remote stream
            pc.ontrack = (event) => {
                console.log('📺 Received remote track:', event.track.kind);
                if (event.streams && event.streams[0]) {
                    console.log('✅ Setting remote stream');
                    setRemoteStream(event.streams[0]);
                    setIsConnected(true);
                    setConnectionStatus('Đã kết nối');
                    startCallTimer();
                }
            };

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const cand = event.candidate;
                    console.log('🧊 Got ICE candidate');
                    console.log('🧊 Candidate JSON:', JSON.stringify(cand.toJSON()));
                    sendIceCandidate(cand);
                } else {
                    console.log('🧊 ICE gathering complete');
                }
            };

            // Handle ICE connection state
            pc.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state:', pc.iceConnectionState);
                switch (pc.iceConnectionState) {
                    case 'checking':
                        setConnectionStatus('Đang kết nối...');
                        break;
                    case 'connected':
                    case 'completed':
                        console.log('✅ ICE connection established');
                        break;
                    case 'failed':
                        console.error('❌ ICE connection failed - trying to restart');
                        // Try ICE restart (only initiator should restart to avoid conflicts)
                        if (peerConnection.current && isInitiator) {
                            console.log('🔄 Initiator restarting ICE...');
                            try {
                                peerConnection.current.restartIce();
                                // After restartIce(), onnegotiationneeded will fire
                            } catch (e) {
                                console.error('❌ ICE restart failed:', e);
                            }
                        }
                        break;
                    case 'disconnected':
                        console.warn('⚠️ ICE disconnected - may reconnect');
                        setConnectionStatus('Đang kết nối lại...');
                        break;
                    case 'closed':
                        console.log('🔒 ICE connection closed');
                        break;
                }
            };

            // Handle negotiation needed (for ICE restart only, not initial offer)
            pc.onnegotiationneeded = async () => {
                console.log('🔄 Negotiation needed, initialNegotiationDone:', initialNegotiationDoneRef.current);
                
                // Skip if initial negotiation not done yet (createOffer handles initial case)
                if (!initialNegotiationDoneRef.current) {
                    console.log('⏭️ Skipping - initial negotiation will be handled by createOffer()');
                    return;
                }
                
                // Only initiator should create new offer for renegotiation (ICE restart)
                if (isInitiator && peerConnection.current) {
                    try {
                        console.log('📤 Creating new offer for ICE restart...');
                        const offer = await peerConnection.current.createOffer({ iceRestart: true });
                        await peerConnection.current.setLocalDescription(offer);
                        
                        const db = getDatabase();
                        const offerRef = ref(db, `calls/${roomId}/offer`);
                        await set(offerRef, {
                            type: offer.type,
                            sdp: offer.sdp,
                        });
                        console.log('✅ ICE restart offer sent');
                        
                        // Reset remoteDescription flag to process new answer
                        remoteDescriptionSetRef.current = false;
                    } catch (e) {
                        console.error('❌ ICE restart failed:', e);
                    }
                }
            };

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                console.log('🔗 Connection state:', pc.connectionState);
                switch (pc.connectionState) {
                    case 'connected':
                        setConnectionStatus('Đã kết nối');
                        setIsConnected(true);
                        break;
                    case 'disconnected':
                        setConnectionStatus('Đã ngắt kết nối');
                        break;
                    case 'failed':
                        setConnectionStatus('Kết nối thất bại');
                        console.error('❌ WebRTC connection failed');
                        setTimeout(() => handleCallEnd(), 2000);
                        break;
                    case 'closed':
                        setConnectionStatus('Cuộc gọi đã kết thúc');
                        break;
                }
            };

            // Thiết lập signaling TRƯỚC khi tạo offer
            setupSignaling(pc);

            // Chờ một chút để signaling listeners sẵn sàng
            await new Promise(resolve => setTimeout(resolve, 500));

            // Nếu là người gọi (initiator), tạo offer
            if (isInitiator) {
                console.log('📤 Caller creating offer...');
                await createOffer(pc);
            } else {
                console.log('📥 Callee waiting for offer...');
            }

        } catch (error) {
            console.error('❌ Lỗi bắt đầu WebRTC:', error);
            // Reset hasStartedRef to allow retry
            hasStartedRef.current = false;
            Alert.alert('Lỗi', 'Không thể khởi tạo camera/mic. Vui lòng kiểm tra quyền.');
            handleCallEnd();
        }
    };

    // Thiết lập signaling qua Firebase
    const setupSignaling = (pc) => {
        const db = getDatabase();
        roomRef.current = ref(db, `calls/${roomId}`);

        // Lắng nghe offer (chỉ callee)
        if (!isInitiator) {
            const offerRef = ref(db, `calls/${roomId}/offer`);
            console.log('👂 Callee listening for offer...');
            const offerUnsubscribe = onValue(offerRef, async (snapshot) => {
                const data = snapshot.val();
                console.log('📥 Offer snapshot:', data ? 'có data' : 'null');
                
                // Safety check: Ensure peerConnection is still valid
                if (!peerConnection.current || peerConnection.current.connectionState === 'closed') {
                    console.log('⚠️ Ignoring offer - connection closed');
                    return;
                }
                
                if (data && pc.remoteDescription === null) {
                    try {
                        console.log('📥 Callee nhận offer, đang setRemoteDescription...');
                        await pc.setRemoteDescription(new RTCSessionDescription(data));
                        console.log('✅ Callee đã set remote description');
                        
                        // FIX: Mark remote description as set and process queued candidates
                        remoteDescriptionSetRef.current = true;
                        await processQueuedIceCandidates(pc);

                        console.log('📤 Callee tạo answer...');
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        console.log('✅ Callee đã set local description (answer)');

                        // Gửi answer
                        const answerRef = ref(db, `calls/${roomId}/answer`);
                        await set(answerRef, {
                            type: answer.type,
                            sdp: answer.sdp,
                        });
                        console.log('✅ Callee đã gửi answer');
                        
                        // Mark initial negotiation as done (for ICE restart handling)
                        initialNegotiationDoneRef.current = true;
                    } catch (error) {
                        console.error('❌ Lỗi xử lý offer:', error);
                    }
                }
            });
            listenersRef.current.offer = offerUnsubscribe;
        }

        // Lắng nghe answer (chỉ caller)
        if (isInitiator) {
            const answerRef = ref(db, `calls/${roomId}/answer`);
            console.log('👂 Caller listening for answer...');
            const answerUnsubscribe = onValue(answerRef, async (snapshot) => {
                const data = snapshot.val();
                console.log('📥 Answer snapshot:', data ? 'có data' : 'null');
                
                // Safety check: Ensure peerConnection is still valid
                if (!peerConnection.current || peerConnection.current.connectionState === 'closed') {
                    console.log('⚠️ Ignoring answer - connection closed');
                    return;
                }
                
                if (data && pc.remoteDescription === null) {
                    try {
                        console.log('📥 Caller nhận answer, đang setRemoteDescription...');
                        await pc.setRemoteDescription(new RTCSessionDescription(data));
                        console.log('✅ Caller đã set remote description (answer)');
                        
                        // FIX: Mark remote description as set and process queued candidates
                        remoteDescriptionSetRef.current = true;
                        await processQueuedIceCandidates(pc);
                    } catch (error) {
                        console.error('❌ Lỗi xử lý answer:', error);
                    }
                }
            });
            // FIX: Save answer listener for proper cleanup
            listenersRef.current.answer = answerUnsubscribe;
        }

        // Lắng nghe ICE candidates (cả hai bên)
        const candidatesRef = ref(db, `calls/${roomId}/candidates`);
        console.log('👂 Listening for ICE candidates...');
        const candidatesUnsubscribe = onChildAdded(candidatesRef, async (snapshot) => {
            const data = snapshot.val();
            if (data && data.sender !== currentUserId) {
                // Safety check: Ensure peerConnection is still valid
                if (!peerConnection.current || peerConnection.current.connectionState === 'closed') {
                    console.log('⚠️ Ignoring ICE candidate - connection closed');
                    return;
                }

                const candidate = new RTCIceCandidate(data.candidate);
                
                // FIX: Queue candidates if remote description not set yet
                if (!remoteDescriptionSetRef.current) {
                    console.log('🧊 Queuing ICE candidate (waiting for remote description)');
                    iceCandidateQueueRef.current.push(candidate);
                    return;
                }
                
                try {
                    console.log('🧊 Nhận ICE candidate từ', data.sender === callerUid ? 'caller' : 'callee');
                    await pc.addIceCandidate(candidate);
                    console.log('✅ Đã thêm ICE candidate');
                } catch (error) {
                    console.error('❌ Lỗi thêm ICE candidate:', error);
                }
            }
        });
        listenersRef.current.candidates = candidatesUnsubscribe;
    };

    // Process queued ICE candidates after remote description is set
    const processQueuedIceCandidates = async (pc) => {
        console.log('🧊 Processing', iceCandidateQueueRef.current.length, 'queued ICE candidates');
        while (iceCandidateQueueRef.current.length > 0) {
            // Safety check before each candidate
            if (!peerConnection.current || peerConnection.current.connectionState === 'closed') {
                console.log('⚠️ Connection closed, stopping ICE candidate processing');
                iceCandidateQueueRef.current = [];
                return;
            }
            
            const candidate = iceCandidateQueueRef.current.shift();
            try {
                await pc.addIceCandidate(candidate);
                console.log('✅ Đã thêm queued ICE candidate');
            } catch (error) {
                console.error('❌ Lỗi thêm queued ICE candidate:', error);
            }
        }
    };

    // Tạo offer
    const createOffer = async (pc) => {
        try {
            console.log('📤 Creating offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log('✅ Set local description (offer)');

            const db = getDatabase();
            const offerRef = ref(db, `calls/${roomId}/offer`);
            const offerData = {
                type: offer.type,
                sdp: offer.sdp,
            };

            console.log('📤 Uploading offer to Firebase...');
            // Fire-and-forget (don't await - Firebase set() doesn't resolve properly)
            set(offerRef, offerData)
                .then(() => {
                    console.log('✅✅ Offer uploaded to Firebase');
                    // Mark initial negotiation as done (for ICE restart handling)
                    initialNegotiationDoneRef.current = true;
                })
                .catch(err => console.error('❌ Failed to upload offer:', err.message));
            console.log('✅ Offer sent (async)');
        } catch (error) {
            console.error('❌ Lỗi tạo offer:', error);
        }
    };

    // Gửi ICE candidate
    const sendIceCandidate = async (candidate) => {
        try {
            const candidateJSON = candidate.toJSON();
            console.log('🧊📤 Sending ICE candidate:', candidateJSON.candidate?.substring(0, 50) + '...');
            const db = getDatabase();
            const candidatesRef = ref(db, `calls/${roomId}/candidates`);
            const candidateData = {
                sender: currentUserId,
                candidate: candidateJSON,
            };

            // Fire-and-forget (don't await - Firebase push() doesn't resolve properly)
            push(candidatesRef, candidateData)
                .then(() => console.log('✅ ICE candidate uploaded'))
                .catch(err => console.error('❌ Failed to send ICE:', err.message));
        } catch (error) {
            console.error('❌ Lỗi gửi ICE candidate:', error);
        }
    };

    // Bắt đầu timer
    const startCallTimer = () => {
        if (callTimerRef.current) return;
        callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    // Format thời gian
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Toggle mute
    const toggleMute = () => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    // Toggle video
    const toggleVideo = () => {
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    // Switch camera
    const switchCamera = () => {
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track._switchCamera();
            });
        }
    };

    // Kết thúc cuộc gọi
    const handleCallEnd = async () => {
        if (isEndingRef.current) {
            console.log('⏳ Đang kết thúc, bỏ qua yêu cầu lặp');
            return;
        }
        isEndingRef.current = true;

        // Determine correct status: 'cancelled' if call not connected yet, 'ended' if connected
        const newStatus = (callState === 'calling' || callState === 'incoming') ? 'cancelled' : 'ended';
        console.log('🔴 Kết thúc cuộc gọi, roomId:', roomId, 'isInitiator:', isInitiator, 'callState:', callState, 'newStatus:', newStatus);
        
        try {
            const db = getDatabase();
            const callRef = ref(db, `calls/${roomId}`);

            // Fire-and-forget status update
            runTransaction(callRef, (callData) => {
                if (!callData) return callData;
                return {
                    ...callData,
                    status: newStatus,
                    endedAt: Date.now(),
                    endedBy: currentUserId,
                };
            })
                .then(() => console.log('✅ Status updated to', newStatus))
                .catch(err => console.error('❌ Failed to update status:', err.message));

            // Fire-and-forget endCall signal
            const endCallRef = ref(db, `calls/${roomId}/endCall`);
            set(endCallRef, {
                endedBy: currentUserId,
                endedAt: Date.now(),
            })
                .then(() => console.log('✅ End call signal sent'))
                .catch(err => console.error('❌ Failed to send end signal:', err.message));

            // Dừng ringtone/vibration ngay lập tức
            stopRingtone();
            Vibration.cancel();

            setCallState('ended');
            setConnectionStatus('Cuộc gọi đã kết thúc');

            // Xóa cuộc gọi sau 3 giây (fire-and-forget)
            setTimeout(() => {
                remove(callRef)
                    .then(() => console.log('✅ Call deleted'))
                    .catch(e => console.log('⚠️ Could not delete call:', e.message));
            }, 3000);
        } catch (error) {
            console.error('Lỗi kết thúc cuộc gọi:', error);
        }

        // Cleanup và goBack ngay lập tức
        cleanup();
        navigation.goBack();

        // Reset flag sau khi cleanup
        setTimeout(() => {
            isEndingRef.current = false;
        }, 500);
    };

    // Cleanup
    const cleanup = () => {
        console.log('🧹 Cleanup started');

        // Stop ringtone and vibration first
        stopRingtone();
        Vibration.cancel();

        // Stop timer
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }

        // Clear call timeout
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }

        // IMPORTANT: Remove Firebase listeners BEFORE closing peer connection
        // to prevent race conditions where listeners try to use closed connection
        if (listenersRef.current.status) {
            console.log('🧹 Removing status listener');
            listenersRef.current.status();
            listenersRef.current.status = null;
        }
        if (listenersRef.current.endCall) {
            console.log('🧹 Removing endCall listener');
            listenersRef.current.endCall();
            listenersRef.current.endCall = null;
        }
        if (listenersRef.current.offer) {
            console.log('🧹 Removing offer listener');
            listenersRef.current.offer();
            listenersRef.current.offer = null;
        }
        if (listenersRef.current.answer) {
            console.log('🧹 Removing answer listener');
            listenersRef.current.answer();
            listenersRef.current.answer = null;
        }
        if (listenersRef.current.candidates) {
            console.log('🧹 Removing candidates listener');
            listenersRef.current.candidates();
            listenersRef.current.candidates = null;
        }

        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        // Close peer connection (after listeners are removed)
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        hasStartedRef.current = false;
        isEndingRef.current = false;
        remoteDescriptionSetRef.current = false;
        iceCandidateQueueRef.current = [];
        initialNegotiationDoneRef.current = false;

        console.log('🧹 Cleanup complete');
    };

    if (!callerUid || !recipientUid) {
        Alert.alert('Lỗi', 'Không có thông tin cuộc gọi');
        navigation.goBack();
        return null;
    }

    // UI cho màn hình đang gọi / cuộc gọi đến
    if (callState === 'calling' || callState === 'incoming') {
        return (
            <View style={styles.container}>
                <View style={styles.callingContainer}>
                    {/* Avatar */}
                    <View style={styles.avatarLarge}>
                        {partnerInfo.avatar ? (
                            <Image
                                source={{ uri: partnerInfo.avatar }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Icon name="account" size={80} color="#fff" />
                        )}
                    </View>

                    {/* Tên người gọi/nhận */}
                    <Text style={styles.callingName}>{partnerInfo.name}</Text>
                    <Text style={styles.callingStatus}>{connectionStatus}</Text>

                    {/* Nút điều khiển */}
                    <View style={styles.callingControls}>
                        {callState === 'incoming' ? (
                            <>
                                {/* Từ chối cuộc gọi */}
                                <TouchableOpacity
                                    style={styles.declineButton}
                                    onPress={declineCall}
                                >
                                    <Icon name="phone-hangup" size={36} color="#fff" />
                                </TouchableOpacity>

                                {/* Chấp nhận cuộc gọi */}
                                <TouchableOpacity
                                    style={styles.acceptButton}
                                    onPress={acceptCall}
                                >
                                    <Icon name="phone" size={36} color="#fff" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            /* Người gọi - chỉ có nút huỷ */
                            <TouchableOpacity
                                style={styles.declineButton}
                                onPress={handleCallEnd}
                            >
                                <Icon name="phone-hangup" size={36} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    // UI cho cuộc gọi đang diễn ra
    return (
        <View style={styles.container}>
            {/* Remote Video - Full screen */}
            {remoteStream ? (
                <RTCView
                    streamURL={remoteStream.toURL()}
                    style={styles.remoteVideo}
                    objectFit="cover"
                    mirror={false}
                />
            ) : (
                <View style={styles.remoteVideoPlaceholder}>
                    {partnerInfo.avatar ? (
                        <Image
                            source={{ uri: partnerInfo.avatar }}
                            style={styles.avatarImageSmall}
                        />
                    ) : (
                        <Icon name="account" size={100} color="#666" />
                    )}
                    <Text style={styles.waitingText}>{connectionStatus}</Text>
                </View>
            )}

            {/* Local Video - Picture in Picture */}
            {localStream && !isVideoOff && (
                <View style={styles.localVideoContainer}>
                    <RTCView
                        streamURL={localStream.toURL()}
                        style={styles.localVideo}
                        objectFit="cover"
                        mirror={true}
                    />
                </View>
            )}

            {/* Header */}
            <SafeAreaView style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.callerName}>{partnerInfo.name || 'Cuộc gọi video'}</Text>
                    {isConnected && (
                        <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
                    )}
                </View>
            </SafeAreaView>

            {/* Controls */}
            <View style={styles.controls}>
                {/* Switch Camera */}
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={switchCamera}
                >
                    <Icon name="camera-flip" size={28} color="#fff" />
                </TouchableOpacity>

                {/* Toggle Video */}
                <TouchableOpacity
                    style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
                    onPress={toggleVideo}
                >
                    <Icon
                        name={isVideoOff ? "video-off" : "video"}
                        size={28}
                        color="#fff"
                    />
                </TouchableOpacity>

                {/* Toggle Mute */}
                <TouchableOpacity
                    style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                    onPress={toggleMute}
                >
                    <Icon
                        name={isMuted ? "microphone-off" : "microphone"}
                        size={28}
                        color="#fff"
                    />
                </TouchableOpacity>

                {/* End Call */}
                <TouchableOpacity
                    style={styles.endCallButton}
                    onPress={handleCallEnd}
                >
                    <Icon name="phone-hangup" size={32} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    // Styles cho màn hình đang gọi
    callingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    avatarLarge: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarImageSmall: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    callingName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '600',
        marginBottom: 10,
    },
    callingStatus: {
        color: '#888',
        fontSize: 16,
        marginBottom: 80,
    },
    callingControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 60,
    },
    declineButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#F44336',
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Styles cho cuộc gọi đang diễn ra
    remoteVideo: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    remoteVideoPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    waitingText: {
        color: '#888',
        fontSize: 18,
        marginTop: 20,
    },
    localVideoContainer: {
        position: 'absolute',
        top: 100,
        right: 20,
        width: 120,
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    localVideo: {
        width: '100%',
        height: '100%',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingTop: 50,
        paddingBottom: 20,
    },
    headerContent: {
        alignItems: 'center',
    },
    callerName: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
    },
    duration: {
        color: '#4CAF50',
        fontSize: 16,
        marginTop: 5,
    },
    controls: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        paddingHorizontal: 30,
    },
    controlButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlButtonActive: {
        backgroundColor: '#666',
    },
    endCallButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F44336',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
});

export default VideoCall;