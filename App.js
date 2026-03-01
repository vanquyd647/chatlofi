import { StatusBar } from 'expo-status-bar';
import StackNavigator from './src/navigation/StackNavigator';
import { ChatsProvider } from './src/contextApi/ChatContext';
import { ToastProvider } from './src/contextApi/ToastContext';
import { NotificationProvider } from './src/contextApi/NotificationContext';

export default function App() {
  return (
    <>
      {/* <StatusBar barStyle="light-content" backgroundColor="blue" style='auto'/> */}
      <NotificationProvider>
        <ToastProvider>
          <ChatsProvider>
            <StackNavigator />
          </ChatsProvider>
        </ToastProvider>
      </NotificationProvider>
    </>
  );
}