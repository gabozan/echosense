import { StyleSheet } from "react-native";

export const commonStyles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingTop: 60
    },
    title: {
        fontSize: 26,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 20
    },
    error: {
        color: "red",
        textAlign: "center",
        marginBottom: 10,
        fontSize: 14
    }
});