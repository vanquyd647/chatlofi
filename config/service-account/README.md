# Service Account Setup

## Hướng dẫn lấy Service Account Key từ Firebase Console

1. Truy cập Firebase Console: https://console.firebase.google.com/
2. Chọn project: `chatlofi-9c2c8`
3. Vào **Settings** (biểu tượng bánh răng) → **Service Accounts**
4. Click **Generate new private key**
5. Click **Generate key** để xác nhận
6. File JSON sẽ được tải về (tên dạng: `chatlofi-9c2c8-firebase-adminsdk-xxxxx.json`)
7. Đổi tên file thành: `service-account-key.json`
8. Copy file vào thư mục này: `config/service-account/service-account-key.json`

## ⚠️ Quan trọng

- **KHÔNG** commit file `service-account-key.json` lên Git
- File này đã được thêm vào `.gitignore`
- Giữ file này bảo mật tuyệt đối

## Cấu trúc file service-account-key.json

```json
{
  "type": "service_account",
  "project_id": "chatlofi-9c2c8",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@chatlofi-9c2c8.iam.gserviceaccount.com",
  "client_id": "xxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40chatlofi-9c2c8.iam.gserviceaccount.com"
}
```
