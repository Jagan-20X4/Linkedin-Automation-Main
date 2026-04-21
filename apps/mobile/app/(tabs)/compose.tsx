import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { formatApiError } from "../../lib/api-errors";
import { showError, showOk } from "../../lib/alerts";

export default function ComposeV1Screen() {
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

  async function generate() {
    setLoading(true);
    setPost("");
    setImageUrl(null);
    try {
      const res = await api.post<{
        post?: string;
        imageUrl?: string;
        images?: string[];
        error?: string;
      }>("/api/generate-post", {
        topic: topic.trim() || undefined,
        tone: tone.trim() || undefined,
        audience: audience.trim() || undefined,
      });
      if (res.data.error) {
        throw new Error(res.data.error);
      }
      if (!res.data.post) {
        throw new Error("Generation failed");
      }
      setPost(res.data.post);
      const img =
        (Array.isArray(res.data.images) && res.data.images[0]) || res.data.imageUrl || null;
      setImageUrl(typeof img === "string" ? img : null);
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    const text = post.trim();
    if (!text) return;
    setPublishBusy(true);
    try {
      await api.post("/api/linkedin/post", { text });
      showOk("Posted to LinkedIn.");
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ paddingTop: insets.top + 8 }}
    >
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <Text className="text-xl font-semibold text-primarytext">Compose</Text>
        <Text className="mt-1 text-sm text-secondarytext">
          Single post with Claude + optional image (same as website Compose tab).
        </Text>

        <Text className="mt-4 text-xs font-medium text-secondarytext">Topic / angle</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g. Lessons from shipping Q1"
          placeholderTextColor="#666"
          multiline
          className="mt-1 min-h-[100px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primarytext"
        />
        <Text className="mt-3 text-xs font-medium text-secondarytext">Tone (optional)</Text>
        <TextInput
          value={tone}
          onChangeText={setTone}
          placeholder="warm, concise"
          placeholderTextColor="#666"
          className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primarytext"
        />
        <Text className="mt-3 text-xs font-medium text-secondarytext">Audience (optional)</Text>
        <TextInput
          value={audience}
          onChangeText={setAudience}
          placeholder="LinkedIn professionals"
          placeholderTextColor="#666"
          className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primarytext"
        />

        <Pressable
          onPress={() => void generate()}
          disabled={loading}
          className="mt-5 flex-row items-center justify-center gap-2 rounded-lg bg-accent py-3 active:opacity-80 disabled:opacity-40"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text className="text-sm font-semibold text-white">Generate</Text>
            </>
          )}
        </Pressable>

        {post ? (
          <View className="mt-6 rounded-xl border border-border bg-surface p-3">
            <Text className="text-xs font-semibold uppercase text-muted">Post</Text>
            <Text className="mt-2 text-sm leading-relaxed text-primarytext">{post}</Text>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ marginTop: 12, height: 192, width: "100%", borderRadius: 8 }}
                resizeMode="cover"
              />
            ) : null}
            <Pressable
              onPress={() => void publish()}
              disabled={publishBusy || !post.trim()}
              className="mt-4 flex-row items-center justify-center gap-2 rounded-lg border border-accentlight bg-accent py-3 active:opacity-80 disabled:opacity-40"
            >
              {publishBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-sm font-semibold text-white">Publish to LinkedIn</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
