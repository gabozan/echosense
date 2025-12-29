import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { DeviceCard, ScreenContainer, PrimaryButton } from "../components";
import { useBLE } from "../hooks/useBLE";

export default function DeviceListScreen() {
  const { devices, isScanning, error, startScan, stopScan } = useBLE();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Dispositivos detectados</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton
          title={isScanning ? "Detener escaneo" : "Buscar dispositivos"}
          onPress={isScanning ? stopScan : startScan}
        />

        {isScanning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Escaneando...</Text>
          </View>
        )}

        <View style={styles.list}>
          {devices.length === 0 && !isScanning && (
            <Text style={styles.emptyText}>
              No se han detectado dispositivos. Presiona el botón para escanear.
            </Text>
          )}

          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              name={device.name || "Dispositivo sin nombre"}
              id={device.id}
              onPress={() => console.log("Click en", device.name, device.id)}
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
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  scanningText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 14,
  },
  list: {
    marginTop: 10,
  },
});
