import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { DeviceCard, ScreenContainer } from "../components";

export default function DeviceListScreen() {
  // Mock temporal (más tarde BLE)
  const devices = [
    { name: "ESP32 Node A", id: "00:11:22:33" },
    { name: "ESP32 Node B", id: "44:55:66:77" },
    { name: "MANEL CALVO", id: "44:55:16:77" },
  ];

  return (
    <ScreenContainer>
        <View style={styles.container}>
            <Text style={styles.title}>Dispositivos detectados</Text>

            <View style={styles.list}>
                {devices.map((d) => (
                <DeviceCard
                    key={d.id}
                    name={d.name}
                    id={d.id}
                    onPress={() => console.log("Click en", d.name)}
                />
                ))}
            </View>
        </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  list: {
    marginTop: 10,
  },
});
