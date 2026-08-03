import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type ConnectionFallbackProps = {
  webUrl: string;
  helpText: string;
  onRetry: () => void;
};

export function ConnectionFallback({ webUrl, helpText, onRetry }: ConnectionFallbackProps): React.JSX.Element {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>Smart Farmer Market</Text>
        <Text style={styles.copy}>The mobile shell could not reach the web app.</Text>
        <Text style={styles.helpText}>{helpText}</Text>
        <Text style={styles.url}>{webUrl}</Text>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(webUrl)}>
            <Text style={styles.secondaryButtonText}>Open in browser</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    color: colors.title,
  },
  copy: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    color: colors.text,
  },
  helpText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    color: colors.text,
  },
  url: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    color: colors.primary,
    fontWeight: "600",
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.surface,
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.title,
  },
});
