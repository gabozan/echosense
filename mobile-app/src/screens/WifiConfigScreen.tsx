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
import { commonStyles } from "../styles/screenStyles";

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
            <View style={commonStyles.container}>
                <Text style={commonStyles.title}>Configure WiFi</Text>
                <Text style={styles.subtitle}>Device: {deviceName}</Text>

                {isConnecting && (
                    <View style={styles.statusContainer}>
                        <ActivityIndicator size="large" color="#000000ff" />
                        <Text style={styles.statusText}>Connecting...</Text>
                    </View>
                )}

                {error && <Text style={commonStyles.error}>{error}</Text>}

                {isConnected && (
                    <>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>SSID (Network name)</Text>
                            <TextInput
                                style={styles.input}
                                value={ssid}
                                onChangeText={setSsid}
                                placeholder="Enter network name"
                                placeholderTextColor="#999999ff"
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
                                placeholderTextColor="#999999ff"
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
    subtitle: {
        fontSize: 14,
        color: "#000000ff",
        textAlign: "center",
        marginBottom: 30
    },
    statusContainer: {
        alignItems: "center",
        marginVertical: 30
    },
    statusText: {
        marginTop: 10,
        fontSize: 14,
        color: "#000000ff"
    },
    inputContainer: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
        color: "#000000ff"
    },
    input: {
        backgroundColor: "#f5f5f5",
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        color: "#000000ff"
    },
    buttonContainer: {
        marginTop: 20,
    },
    backButtonContainer: {
        marginTop: 20,
        alignItems: "center"
    }
});