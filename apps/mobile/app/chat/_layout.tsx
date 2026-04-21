import { Stack } from "expo-router";

export default function ChatStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0f0f0f" },
        animation: "slide_from_right",
      }}
    />
  );
}
