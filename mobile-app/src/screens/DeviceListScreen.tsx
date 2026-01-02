import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { DeviceCard, ScreenContainer, PrimaryButton } from "../components";
import { useBLE } from "../hooks/useBLE";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../app/AppNavigator";
import { commonStyles } from "../styles/screenStyles";

type Props = NativeStackScreenProps<RootStackParamList, "DeviceList">;

export default function DeviceListScreen({ navigation }: Props) {
  const { devices, isScanning, error, startScan, stopScan } = useBLE();

  const handleDevicePress = (deviceId: string, deviceName: string) => {
    navigation.navigate("WifiConfig", { deviceId, deviceName });
  };

  return (
    <ScreenContainer>
      <View style={commonStyles.container}>
        <Text style={commonStyles.title}>Detected devices</Text>

        {error && <Text style={commonStyles.error}>{error}</Text>}

        <PrimaryButton
          title={isScanning ? "Stop scanning" : "Search devices"}
          onPress={isScanning ? stopScan : startScan}
        />

        {isScanning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000000ff" />
            <Text style={styles.scanningText}>Scanning...</Text>
          </View>
        )}

        <View style={styles.list}>
          {devices.length === 0 && !isScanning && (
            <Text style={styles.emptyText}>
              No devices detected. Press the button to scan.
            </Text>
          )}

          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              name={device.name || "Unnamed device"}
              id={device.id}
              onPress={() => handleDevicePress(device.id, device.name || "Device")}
            />
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: "center",
    marginVertical: 20
  },
  scanningText: {
    marginTop: 10,
    fontSize: 14,
    color: "#000000ff"
  },
  emptyText: {
    textAlign: "center",
    color: "#000000ff",
    marginTop: 20,
    fontSize: 14
  },
  list: {
    marginTop: 10
  }
});