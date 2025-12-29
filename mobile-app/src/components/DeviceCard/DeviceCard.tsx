import React from "react";
import { View, Text } from "react-native";
import PrimaryButton from "../PrimaryButton";
import styles from "./styles";

type Props = {
  name: string;
  id: string;
  onPress: () => void;
};

export default function DeviceCard({ name, id, onPress }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.id}>{id}</Text>
      </View>

      <PrimaryButton title="Connect" size="small" onPress={onPress} />
    </View>
  );
}