import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    padding: 14,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: "#eeeeeeff",
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
    color: "#666666ff",
    marginTop: 2,
  }
});