import React, { useState } from "react";
import { StyleSheet, Text, View, Button, TextInput, Image, SafeAreaView, TouchableOpacity, StatusBar, Alert, Modal, ActivityIndicator } from "react-native";
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth"; // Update import statement
import { auth } from "../../config/firebase";
import { MaterialIcons } from '@expo/vector-icons';
// Native Firebase Auth for syncing with Realtime Database
import nativeAuth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Thêm import AsyncStorage
import { getFirestore, doc, getDoc } from "firebase/firestore"; // Thêm import Firestore
import { useNotifications } from '../contextApi/NotificationContext';

export default function Login({ navigation, setIsLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showModal, setShowModal] = useState(false); // State để kiểm soát việc hiển thị modal
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(""); // State riêng cho email quên mật khẩu
  const [isLoading, setIsLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false); // Modal xác minh email
  const [unverifiedUser, setUnverifiedUser] = useState(null); // Lưu user chưa xác minh
  const [resendCooldown, setResendCooldown] = useState(0); // Cooldown gửi lại email
  const db = getFirestore(); // Khởi tạo Firestore
  const { fcmToken, savePushToken } = useNotifications();

  const validateEmail = (email) => {
    // Regular expression to validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Hàm lưu thông tin người dùng vào AsyncStorage
  const saveUserToStorage = async (userData) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      console.log('User data saved to AsyncStorage successfully', userData);
    } catch (error) {
      console.error('Error saving user data to AsyncStorage:', error);
    }
  };

  // Hàm lấy thông tin người dùng từ Firestore
  const getUserData = async (userId) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return userDoc.data();
      } else {
        console.log('User document not found in Firestore', userId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user data from Firestore:', error);
      return null;
    }
  };

  const onHandleLogin = () => {
    if (email.trim() === "" && password.trim() === "") {
      Alert.alert("Email hoặc mật khẩu không được để trống");
    } else if (email.trim() === "") {
      Alert.alert("Email không được để trống");
    } else if (!validateEmail(email)) {
      Alert.alert("Email không đúng định dạng");
    } else if (password.trim() === "") {
      Alert.alert("Mật khẩu không được để trống");
    } else if (password.length < 6) {
      Alert.alert("Mật khẩu phải có ít nhất 6 kí tự");
    } else if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      Alert.alert("Mật khẩu phải chứa ít nhất 1 chữ số và 1 chữ cái");
    } else {
      setIsLoading(true);
      signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;

          // Reload user để lấy trạng thái emailVerified mới nhất
          await user.reload();

          // Kiểm tra email đã xác minh chưa
          if (!user.emailVerified) {
            setIsLoading(false);
            setUnverifiedUser(user);
            setShowVerifyModal(true);
            return;
          }

          // Lấy thông tin người dùng từ Firestore
          const userData = await getUserData(user.uid);

          if (userData) {
            // Lưu thông tin người dùng vào AsyncStorage
            await saveUserToStorage({
              uid: user.uid,
              email: user.email,
              ...userData
            });
          }

          // Lưu FCM token vào Firestore
          if (fcmToken) {
            await savePushToken(user.uid, fcmToken);
          }

          // SYNC: Sign in Native Firebase Auth for Realtime Database access
          try {
            await nativeAuth().signInWithEmailAndPassword(email, password);
            console.log('✅ Native Firebase Auth synced successfully');
          } catch (nativeAuthError) {
            console.log('⚠️ Native Firebase Auth sync failed:', nativeAuthError.message);
            // Continue anyway - video call may not work but app works
          }

          setIsLoading(false);
          setIsLoggedIn(true);
        })
        .catch((err) => {
          setIsLoading(false);
          Alert.alert("Đăng nhập không thành công", "Mật khẩu hoặc Tài khoản không đúng");
        });
    }
  };

  // Gửi lại email xác minh
  const resendVerificationEmail = async () => {
    if (resendCooldown > 0) return;

    try {
      await sendEmailVerification(unverifiedUser);
      Alert.alert("Thành công", "Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư.");

      // Bắt đầu đếm ngược 60 giây
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      if (error.code === 'auth/too-many-requests') {
        Alert.alert("Lỗi", "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.");
      } else {
        Alert.alert("Lỗi", "Không thể gửi email. Vui lòng thử lại sau.");
      }
    }
  };

  // Kiểm tra lại trạng thái xác minh
  const checkVerificationStatus = async () => {
    if (!unverifiedUser) return;

    try {
      await unverifiedUser.reload();
      if (unverifiedUser.emailVerified) {
        setShowVerifyModal(false);

        // Lấy thông tin người dùng từ Firestore
        const userData = await getUserData(unverifiedUser.uid);

        if (userData) {
          await saveUserToStorage({
            uid: unverifiedUser.uid,
            email: unverifiedUser.email,
            ...userData
          });
        }

        // Lưu FCM token vào Firestore
        if (fcmToken) {
          await savePushToken(unverifiedUser.uid, fcmToken);
        }

        setIsLoggedIn(true);
      } else {
        Alert.alert("Chưa xác minh", "Email của bạn chưa được xác minh. Vui lòng kiểm tra hộp thư và nhấn vào link xác minh.");
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể kiểm tra trạng thái. Vui lòng thử lại.");
    }
  };

  const onHandleForgotPassword = () => {
    setForgotEmail(""); // Reset email khi mở modal
    setShowModal(true); // Mở modal khi người dùng nhấn vào "Quên mật khẩu"
  };

  const onCloseModal = () => {
    setShowModal(false); // Đóng modal
    setForgotEmail(""); // Clear email khi đóng modal
  };

  const sendResetEmail = () => {
    // Validate email quên mật khẩu
    if (forgotEmail.trim() === "") {
      Alert.alert("Lỗi", "Email không được để trống");
      return;
    }
    if (!validateEmail(forgotEmail)) {
      Alert.alert("Lỗi", "Email không đúng định dạng");
      return;
    }

    sendPasswordResetEmail(auth, forgotEmail)
      .then(() => {
        Alert.alert(
          'Đã gửi email',
          'Chúng tôi đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.',
        );
        onCloseModal();
      })
      .catch((error) => {
        if (error.code === 'auth/user-not-found') {
          Alert.alert('Lỗi', 'Email này chưa được đăng ký');
        } else if (error.code === 'auth/invalid-email') {
          Alert.alert('Lỗi', 'Email không hợp lệ');
        } else {
          Alert.alert('Lỗi', 'Không thể gửi email. Vui lòng thử lại sau.');
        }
      });
  };


  return (
    <View style={styles.container}>
      <View style={styles.whiteSheet} />
      <SafeAreaView style={styles.form}>
        <Text style={styles.title}>Đăng nhập</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoFocus={true}
          value={email}
          onChangeText={(text) => setEmail(text)}
        />
        <View style={[styles.input, styles.passwordInputContainer]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Mật khẩu"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showPassword}
            textContentType="password"
            value={password}
            onChangeText={(text) => setPassword(text)}
          />
          <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
            <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={24} color="gray" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.button} onPress={onHandleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 18 }}>Đăng nhập</Text>
          )}
        </TouchableOpacity>
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', alignSelf: 'center' }}>
          <Text style={{ color: 'gray', fontWeight: '600', fontSize: 14 }}>Bạn chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
            <Text style={{ color: '#006AF5', fontWeight: '600', fontSize: 14 }}> Đăng ký </Text>
          </TouchableOpacity></View>
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', alignSelf: 'center' }}>
          <TouchableOpacity onPress={onHandleForgotPassword}>
            <Text style={{ color: '#006AF5', fontWeight: '600', fontSize: 14 }}>Quên mật khẩu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <StatusBar barStyle="light-content" />

      {/* Modal Quên mật khẩu */}
      <Modal visible={showModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quên mật khẩu</Text>
            <Text style={{ color: '#666', marginBottom: 15, textAlign: 'center' }}>
              Nhập email đã đăng ký để nhận link đặt lại mật khẩu
            </Text>
            <TextInput
              style={styles.input1}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoFocus={true}
              value={forgotEmail}
              onChangeText={(text) => setForgotEmail(text)}
            />
            <TouchableOpacity style={styles.button2} onPress={sendResetEmail}>
              <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 18 }}>Gửi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onCloseModal}>
              <Text style={{ fontWeight: 'bold', color: '#006AF5', fontSize: 18 }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Xác minh email */}
      <Modal visible={showVerifyModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <MaterialIcons name="mark-email-unread" size={60} color="#006AF5" style={{ marginBottom: 15 }} />
            <Text style={styles.modalTitle}>Xác minh email</Text>
            <Text style={{ color: '#666', marginBottom: 20, textAlign: 'center', lineHeight: 22 }}>
              Email của bạn chưa được xác minh.{'\n'}
              Vui lòng kiểm tra hộp thư và nhấn vào link xác minh, sau đó quay lại đây.
            </Text>

            <TouchableOpacity style={styles.button2} onPress={checkVerificationStatus}>
              <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 16 }}>Tôi đã xác minh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button2, {
                backgroundColor: resendCooldown > 0 ? '#ccc' : '#fff',
                borderWidth: 1,
                borderColor: '#006AF5',
                marginTop: 10
              }]}
              onPress={resendVerificationEmail}
              disabled={resendCooldown > 0}
            >
              <Text style={{ fontWeight: 'bold', color: resendCooldown > 0 ? '#999' : '#006AF5', fontSize: 16 }}>
                {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại email xác minh'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowVerifyModal(false);
                setUnverifiedUser(null);
              }}
            >
              <Text style={{ fontWeight: 'bold', color: '#999', fontSize: 16, marginTop: 15 }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: "#006AF5",
    alignSelf: "center",
    paddingBottom: 24,
  },
  input: {
    backgroundColor: "#F6F7FB",
    height: 58,
    marginBottom: 20,
    fontSize: 16,
    borderRadius: 10,
    padding: 12,
  },
  input1: {
    backgroundColor: "#F6F7FB",
    height: 58,
    marginBottom: 20,
    fontSize: 16,
    borderRadius: 10,
    padding: 12,
    width: 220,
  },
  input2: {
    backgroundColor: "#F6F7FB",
    height: 58,
    marginBottom: 20,
    fontSize: 16,
    borderRadius: 10,
  },
  backImage: {
    width: "100%",
    height: 340,
    position: "absolute",
    top: 0,
    resizeMode: 'cover',
  },
  whiteSheet: {
    width: '100%',
    height: '75%',
    position: "absolute",
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 60,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 30,
  },
  button: {
    backgroundColor: '#006AF5',
    height: 58,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  button2: {
    backgroundColor: '#006AF5',
    height: 58,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    width: 220,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#006AF5',
    marginBottom: 20,
  },
  closeButton: {
    marginTop: 10,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    fontSize: 16,
    flex: 1,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
  },
});