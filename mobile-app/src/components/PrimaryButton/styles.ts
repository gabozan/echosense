import { StyleSheet } from "react-native";

export default StyleSheet.create({
  button: {
    backgroundColor: "#000000ff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 0,
  },

  disabled: {
    opacity: 0.5,
  },

  text: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
