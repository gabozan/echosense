import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    padding: 14,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: "#aeaeaeff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  infoContainer: {
    flex: 1,
  },

  name: {
    fontSize: 18,
    fontWeight: "bold",
  },

  id: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },

  button: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#4C6EF5",
    borderRadius: 8,
  },

  buttonText: {
    color: "white",
    fontWeight: "600",
  }
});