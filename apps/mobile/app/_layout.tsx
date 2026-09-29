import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { NunitoSans_400Regular } from '@expo-google-fonts/nunito-sans/400Regular';
import { Text, View } from 'react-native';
import { colors } from '@timely/design';
export default function Layout() {
  const [loaded,error] = useFonts({ Baloo2: Baloo2_700Bold, NunitoSans: NunitoSans_400Regular });
  if (!loaded && !error) return <View style={{flex:1,backgroundColor:colors.background,padding:24}}><Text>Opening your day…</Text></View>;
  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false }}/></SafeAreaProvider>;
}
