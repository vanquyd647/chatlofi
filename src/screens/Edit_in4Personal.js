import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import { subscribeToUser, updateUserProfile, cascadeUpdateName } from '../services/userService';
import { RadioButton } from 'react-native-paper';
import moment from 'moment';
import { useToast } from '../contextApi/ToastContext';

const Edit_in4Personal = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  const user = auth.currentUser;
  const [userData, setUserData] = useState(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState(moment("01/01/2000", 'DD/MM/YYYY').toDate());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeToUser(user.uid, (data) => {
      setUserData(data);
      setName(data.name);
      setBirthdate(moment(data.birthdate, 'DD/MM/YYYY').toDate());
      setGender(data.gender);
    });
    return () => unsubscribe();
  }, [user]);

  const handleConfirm = (selectedDate) => {
    setBirthdate(selectedDate);
    hideDatePicker();
    // Thực hiện các thao tác cần thiết khi người dùng lưu ngày sinh
  };

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const name_default = userData?.name;
  const gender_default = userData?.gender;
  const birthdate_default = userData?.birthdate;
  const [isDataChanged, setDataChanged] = useState(false);

  useEffect(() => {
    // Kiểm tra xem liệu dữ liệu có thay đổi không
    const dataChanged = name !== name_default || gender !== gender_default || moment(birthdate).format('DD/MM/YYYY') !== birthdate_default;
    setDataChanged(dataChanged);
  }, [name, gender, birthdate]);

  const saveChanges = async () => {
    try {
      // Validate tên
      const trimmedName = name.trim();
      if (trimmedName === '') {
        showToast('Tên không được để trống!', 'warning');
        return;
      }
      if (trimmedName.length < 2) {
        showToast('Tên phải có ít nhất 2 ký tự!', 'warning');
        return;
      }
      if (trimmedName.length > 50) {
        showToast('Tên không được quá 50 ký tự!', 'warning');
        return;
      }

      // Validate ngày sinh không được là ngày tương lai
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (birthdate > today) {
        showToast('Ngày sinh không được là ngày tương lai!', 'warning');
        return;
      }

      // Validate tuổi tối thiểu 13
      const minAgeDate = new Date();
      minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
      if (birthdate > minAgeDate) {
        showToast('Bạn phải đủ 13 tuổi để sử dụng ứng dụng!', 'warning');
        return;
      }

      showToast('Đang cập nhật thông tin...', 'info', 2000);

      // Cập nhật thông tin qua userService
      await updateUserProfile(user.uid, {
        name: name,
        gender: gender,
        birthdate: moment(birthdate).format('DD/MM/YYYY')
      });

      // Cascade cập nhật tên vào tất cả bài post và comments
      if (name !== name_default) {
        await cascadeUpdateName(user.uid, name);
      }

      showToast('Cập nhật thông tin thành công!', 'success');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Không thể cập nhật thông tin. Vui lòng thử lại.', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.searchContainer}>
          <Pressable onPress={() => navigation.goBack()}>
            <AntDesign name="arrowleft" size={20} color="white" />
          </Pressable>
          <View style={styles.searchInput}>
            <Text style={styles.textSearch}>Chỉnh sửa thông tin</Text>
          </View>
        </View>
        <View>
          <View style={{ margin: 20 }}>
            <Text style={{ fontWeight: "bold" }}>Thông tin cá nhân</Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginBottom: 20 }}>
            <View style={{ width: 120 }}>
              <Text>Tên</Text>
            </View>
            <TextInput
              style={{ flex: 1 }}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setIsEmpty(text.trim() === '');
              }}
            />
            {isEmpty && (
              <View style={{ marginRight: 40 }}>
                <MaterialIcons name="error" size={24} color="red" />
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginBottom: 20 }}>
            <View style={{ width: 120 }}>
              <Text>Giới tính</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <TouchableOpacity onPress={() => setGender('Nam')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <RadioButton.Android status={gender === 'Nam' ? 'checked' : 'unchecked'} onPress={() => setGender('Nam')} color="#006AF5" />
                <Text>Nam</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGender('Nữ')} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}>
                <RadioButton.Android status={gender === 'Nữ' ? 'checked' : 'unchecked'} onPress={() => setGender('Nữ')} color="#006AF5" />
                <Text>Nữ</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginBottom: 20 }}>
            <View style={{ width: 120 }}>
              <Text>Ngày sinh</Text>
            </View>
            <TouchableOpacity onPress={showDatePicker} style={{ flex: 1 }}>
              <Text >{moment(birthdate).format('DD/MM/YYYY')}</Text>
            </TouchableOpacity>
          </View>
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            date={birthdate}
            maximumDate={new Date()}
            onConfirm={handleConfirm}
            onCancel={hideDatePicker}
          />
        </View>
        <View style={{ margin: 20 }}>
          {isDataChanged && (
            <TouchableOpacity onPress={saveChanges}>
              <View style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: "#006AF5", height: 50, borderRadius: 20 }}>
                <Text style={{ fontWeight: 'bold', color: 'white' }}>Lưu</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#006AF5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 4,
  },
  textSearch: {
    color: "white",
    fontWeight: '600',
    fontSize: 16,
  },
  itemContainer: {
    marginTop: 20,
    flex: 1,
    margin: 20,
  },
  image: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  text: {
    marginTop: 10,
  },
  containerProfile: {
    marginTop: 20,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'white',
    width: '100%',
    height: 120,
  },
  title: {
    fontSize: 24,
  },
  avatar: {
    width: 75,
    height: 75,
    borderRadius: 35,
    borderWidth: 2,  // Độ rộng của khung viền
    borderColor: '#006AF5',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
  },
  h1: {
    margin: 20,
    flexDirection: "column",
    alignItems: "center",
  },

});

export default Edit_in4Personal;
