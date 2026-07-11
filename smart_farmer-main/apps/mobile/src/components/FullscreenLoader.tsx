import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type FullscreenLoaderProps = {
  label: string;
};

export function FullscreenLoader({ label }: FullscreenLoaderProps): React.JSX.Element {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: 16,
  },
  label: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "600",
  },
});
