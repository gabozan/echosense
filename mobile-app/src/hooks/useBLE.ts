import { useState, useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { Device } from "react-native-ble-plx";
import BLEService from "../services/BLEService";

export const useBLE = () => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Solicitar permisos de Bluetooth en Android
    const requestPermissions = async () => {
        if (Platform.OS === "android") {
            try {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);

                const allGranted = Object.values(granted).every(
                    (status) => status === PermissionsAndroid.RESULTS.GRANTED
                );

                if (!allGranted) {
                    setError("Bluetooth permissions denied");
                    return false;
                }
                return true;
            } catch (err) {
                console.error("Error requesting permissions:", err);
                setError("Error requesting permissions");
                return false;
            }
        }
        return true;
    };

    // Iniciar el escaneo
    const startScan = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        setDevices([]);
        setError(null);
        setIsScanning(true);

        BLEService.scanForDevices(
            (device) => {
                setDevices((prevDevices) => {
                    // Evitar duplicados
                    const exists = prevDevices.find((d) => d.id === device.id);
                    if (exists) return prevDevices;
                    return [...prevDevices, device];
                });
            },
            (error) => {
                console.error("Scan error:", error);
                setError("Error during scanning");
                setIsScanning(false);
            }
        );

        // Detener automáticamente después de 10 segundos
        setTimeout(() => {
            stopScan();
        }, 10000);
    };

    // Detener el escaneo
    const stopScan = () => {
        BLEService.stopScan();
        setIsScanning(false);
    };

    // Conectar a un dispositivo
    const connectToDevice = async (deviceId: string): Promise<boolean> => {
        setIsConnecting(true);
        setError(null);
        try {
            await BLEService.connectToDevice(deviceId);
            setIsConnected(true);
            setIsConnecting(false);
            return true;
        } catch (err) {
            console.error("Connection error:", err);
            setError("Error connecting to device");
            setIsConnecting(false);
            return false;
        }
    };

    // Enviar credenciales WiFi
    const sendWifiCredentials = async (ssid: string, password: string): Promise<boolean> => {
        setError(null);
        try {
            await BLEService.writeWifiCredentials(ssid, password);
            return true;
        } catch (err) {
            console.error("Write error:", err);
            setError("Error sending WiFi credentials");
            return false;
        }
    };

    // Desconectar del dispositivo
    const disconnect = async () => {
        try {
            await BLEService.disconnectDevice();
            setIsConnected(false);
        } catch (err) {
            console.error("Disconnect error:", err);
        }
    };

    // Cleanup al desmontar
    useEffect(() => {
        return () => {
            BLEService.stopScan();
            BLEService.disconnectDevice();
        };
    }, []);

    return {
        devices,
        isScanning,
        isConnecting,
        isConnected,
        error,
        startScan,
        stopScan,
        connectToDevice,
        sendWifiCredentials,
        disconnect,
    };
};

