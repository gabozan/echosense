import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DeviceListScreen from "../screens/DeviceListScreen";
import WifiConfigScreen from "../screens/WifiConfigScreen";

export type RootStackParamList = {
  DeviceList: undefined;
  WifiConfig: { deviceId: string; deviceName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeviceList" component={DeviceListScreen} />
      <Stack.Screen name="WifiConfig" component={WifiConfigScreen} />
    </Stack.Navigator>
  );
}

