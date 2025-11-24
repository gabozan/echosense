import React from "react";
import { View, ViewProps } from "react-native";
import styles from "./styles";

export default function ScreenContainer({ children }: ViewProps) {
  return <View style={styles.container}>{children}</View>;
}