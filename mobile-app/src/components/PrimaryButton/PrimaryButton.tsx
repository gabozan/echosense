import React from "react";
import { Pressable, Text } from "react-native";
import styles from "./styles";

type Props = {
  title: string;
  onPress: () => void;
  size?: "normal" | "small";
  disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, size = "normal", disabled = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, size === "small" && styles.smallButton, disabled && styles.disabled]}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}