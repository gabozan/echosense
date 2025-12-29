import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DeviceListScreen from "../screens/DeviceListScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeviceList" component={DeviceListScreen} />
    </Stack.Navigator>
  );
}
