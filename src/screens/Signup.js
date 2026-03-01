import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator } from "react-native";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { auth } from '../../config/firebase';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNotifications } from '../contextApi/NotificationContext';

export default function Signup({ navigation, setIsLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Nam');
  const [day, setDay] = useState('1');
  const [month, setMonth] = useState('1');
  const [year, setYear] = useState('2000');
  const [isLoading, setIsLoading] = useState(false);

  const db = getFirestore();
  const { fcmToken, savePushToken } = useNotifications();

  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const years = Array.from({ length: 120 }, (_, i) => (2025 - i).toString());

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const onHandleSignup = async () => {
    // Validate inputs
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !name.trim()) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Lỗi", "Email không đúng định dạng");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      Alert.alert("Lỗi", "Mật khẩu phải chứa ít nhất 1 chữ số và 1 chữ cái");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);
    try {
      // Set photo URL based on gender
      const photoUrl = gender === 'Nam'
        ? 'https://firebasestorage.googleapis.com/v0/b/demo1-14597.appspot.com/o/avatar%2Favatar_male.png?alt=media&token=c800b68c-1e1c-4660-b8a0-4dd8563cf74a'
        : 'https://firebasestorage.googleapis.com/v0/b/demo1-14597.appspot.com/o/avatar%2Favatar_fmale.png?alt=media&token=2301ca57-cf3d-49c2-b7bc-1bf472513dff';

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

      // Update profile
      await updateProfile(userCredential.user, {
        displayName: name,
        photoURL: photoUrl
      });

      // Send email verification (Firebase built-in - FREE!)
      await sendEmailVerification(userCredential.user);

      // Save user to Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        UID: userCredential.user.uid,
        email: email.trim().toLowerCase(),
        gender: gender,
        birthdate: `${day}/${month}/${year}`,
        photoURL: photoUrl,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      // Save FCM token for push notifications
      if (fcmToken) {
        await savePushToken(userCredential.user.uid, fcmToken);
        console.log('FCM token saved for new user');
      }

      // Sign out ngay sau khi đăng ký vì email chưa xác thực
      await signOut(auth);

      setIsLoading(false);
      Alert.alert(
        'Đăng ký thành công! 🎉',
        'Chúng tôi đã gửi email xác thực đến ' + email + '. Vui lòng kiểm tra hộp thư (kể cả thư rác) và click vào link để xác thực tài khoản.\n\nSau khi xác thực, bạn có thể đăng nhập.',
        [{
          text: 'Đăng nhập',
          onPress: () => navigation.navigate("Login")
        }]
      );
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        Alert.alert('Lỗi', 'Email này đã được sử dụng');
      } else if (err.code === 'auth/invalid-email') {
        Alert.alert('Lỗi', 'Email không hợp lệ');
      } else if (err.code === 'auth/weak-password') {
        Alert.alert('Lỗi', 'Mật khẩu quá yếu');
      } else {
        Alert.alert('Lỗi đăng ký', err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.whiteSheet} />
      <View style={styles.form}>
        <Text style={styles.title}>Đăng Ký</Text>
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
        <TextInput
          style={styles.input}
          placeholder="Xác nhận mật khẩu"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showPassword}
          textContentType="password"
          value={confirmPassword}
          onChangeText={(text) => setConfirmPassword(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Tên"
          autoCapitalize="words"
          value={name}
          onChangeText={(text) => setName(text)}
        />
        <View>
          <Text style={styles.radioLabel}>Ngày sinh</Text>
          <View style={styles.datePickerContainer}>
            <Picker
              style={styles.datePicker}
              selectedValue={day}
              onValueChange={(itemValue) => setDay(itemValue)}
            >
              {days.map((d) => (
                <Picker.Item label={d} value={d} key={d} />
              ))}
            </Picker>
            <Picker
              style={styles.datePicker}
              selectedValue={month}
              onValueChange={(itemValue) => setMonth(itemValue)}
            >
              {months.map((m) => (
                <Picker.Item label={m} value={m} key={m} />
              ))}
            </Picker>
            <Picker
              style={styles.datePicker}
              selectedValue={year}
              onValueChange={(itemValue) => setYear(itemValue)}
            >
              {years.map((y) => (
                <Picker.Item label={y} value={y} key={y} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.radioContainer}>
          <Text style={styles.radioLabel}>Giới tính</Text>
          <View style={styles.radioOptions}>
            <TouchableOpacity
              style={[styles.radioButtonMale, gender === 'Nam' && styles.selectedRadioButton]}
              onPress={() => setGender('Nam')}
            >
              <Text style={[styles.radioText, gender === 'Nam' && styles.selectedRadioText]}>Nam</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButtonFMale, gender === 'Nữ' && styles.selectedRadioButton]}
              onPress={() => setGender('Nữ')}
            >
              <Text style={[styles.radioText, gender === 'Nữ' && styles.selectedRadioText]}>Nữ</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={onHandleSignup}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 18 }}>Đăng Ký</Text>
          )}
        </TouchableOpacity>
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', alignSelf: 'center' }}>
          <Text style={{ color: 'gray', fontWeight: '600', fontSize: 14 }}>Bạn đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={{ color: '#006AF5', fontWeight: '600', fontSize: 14 }}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#006AF5" />
          <Text style={styles.loadingText}>Đang tạo tài khoản...</Text>
        </View>
      )}

      <StatusBar barStyle="light-content" />
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
    marginTop: 50,
    marginHorizontal: 30,
  },
  button: {
    backgroundColor: '#006AF5',
    height: 58,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
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
  radioContainer: {
    marginTop: 20,
  },
  radioLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  radioOptions: {
    flexDirection: 'row',
  },
  radioButtonMale: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'gray',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginRight: 5,
    alignItems: 'center',
  },
  radioButtonFMale: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'gray',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginLeft: 5,
    alignItems: 'center',
  },
  selectedRadioButton: {
    backgroundColor: '#006AF5',
    borderColor: '#006AF5',
  },
  radioText: {
    color: 'black',
  },
  selectedRadioText: {
    color: 'white',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePicker: {
    flex: 1,
    height: 58,
    backgroundColor: "#F6F7FB",
    borderRadius: 10,
    marginRight: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#006AF5',
  },
});
