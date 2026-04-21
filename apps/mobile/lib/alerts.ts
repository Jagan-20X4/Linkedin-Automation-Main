import { Alert } from "react-native";

export function showError(message: string, title = "Error") {
  Alert.alert(title, message);
}

export function showOk(message: string, title = "Done") {
  Alert.alert(title, message);
}

export function confirmAsync(
  title: string,
  message: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", onPress: () => resolve(true) },
    ]);
  });
}
