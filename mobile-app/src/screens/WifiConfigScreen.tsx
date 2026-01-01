import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from "react-native";
import { ScreenContainer, PrimaryButton } from "../components";
import { useBLE } from "../hooks/useBLE";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
    DeviceList: undefined;
    WifiConfig: { deviceId: string; deviceName: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "WifiConfig">;

export default function WifiConfigScreen({ route, navigation }: Props) {
    const { deviceId, deviceName } = route.params;
    const [ssid, setSsid] = useState("");
    const [password, setPassword] = useState("");
    const [isSending, setIsSending] = useState(false);

    const {
        isConnecting,
        isConnected,
        error,
        connectToDevice,
        sendWifiCredentials,
        disconnect,
    } = useBLE();

    // Conectar al dispositivo al montar la pantalla
    useEffect(() => {
        connectToDevice(deviceId);
        return () => {
            disconnect();
        };
    }, [deviceId]);

    const handleSend = async () => {
        if (!ssid.trim()) {
            Alert.alert("Error", "Please enter the WiFi network SSID");
            return;
        }

        setIsSending(true);
        const success = await sendWifiCredentials(ssid, password);
        setIsSending(false);

        if (success) {
            Alert.alert(
                "Success",
                "WiFi credentials sent successfully",
                [
                    {
                        text: "OK",
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } else {
            Alert.alert("Error", "Could not send credentials");
        }
    };

    return (
        <ScreenContainer>
            <View style={styles.container}>
                <Text style={styles.title}>Configure WiFi</Text>
                <Text style={styles.subtitle}>Device: {deviceName}</Text>

                {isConnecting && (
                    <View style={styles.statusContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.statusText}>Connecting...</Text>
                    </View>
                )}

                {error && <Text style={styles.error}>{error}</Text>}

                {isConnected && (
                    <>
                        <View style={styles.connectedBadge}>
                            <Text style={styles.connectedText}>✓ Connected</Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>SSID (Network name)</Text>
                            <TextInput
                                style={styles.input}
                                value={ssid}
                                onChangeText={setSsid}
                                placeholder="Enter network name"
                                placeholderTextColor="#999"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter password"
                                placeholderTextColor="#999"
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.buttonContainer}>
                            <PrimaryButton
                                title={isSending ? "Sending..." : "Send credentials"}
                                onPress={handleSend}
                                disabled={isSending || !ssid.trim()}
                            />
                        </View>
                    </>
                )}

                <View style={styles.backButtonContainer}>
                    <PrimaryButton
                        title="Back"
                        onPress={() => navigation.goBack()}
                        size="small"
                    />
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
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        marginBottom: 30,
    },
    statusContainer: {
        alignItems: "center",
        marginVertical: 30,
    },
    statusText: {
        marginTop: 10,
        fontSize: 14,
        color: "#666",
    },
    error: {
        color: "red",
        textAlign: "center",
        marginBottom: 10,
        fontSize: 14,
    },
    connectedBadge: {
        backgroundColor: "#e8f5e9",
        padding: 10,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 20,
    },
    connectedText: {
        color: "#2e7d32",
        fontWeight: "600",
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
        color: "#333",
    },
    input: {
        backgroundColor: "#f5f5f5",
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    buttonContainer: {
        marginTop: 20,
    },
    backButtonContainer: {
        marginTop: 20,
        alignItems: "center",
    },
});
