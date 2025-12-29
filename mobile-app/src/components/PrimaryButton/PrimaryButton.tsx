import React from "react";
import { Pressable, Text } from "react-native";
import styles from "./styles";

type Props = {
  title: string;
  onPress: () => void;
  size?: "normal" | "small";
};

export default function PrimaryButton({ title, onPress, size = "normal" }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, size === "small" && styles.smallButton]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}