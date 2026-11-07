import { SafeAreaProvider, SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';

export function ModalSafeAreaView(props: SafeAreaViewProps) {
  return (
    <SafeAreaProvider>
      <SafeAreaView {...props} />
    </SafeAreaProvider>
  );
}
