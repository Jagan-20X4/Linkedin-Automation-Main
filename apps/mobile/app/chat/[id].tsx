import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageGallery } from "../../components/ImageGallery";
import { api } from "../../lib/api";
import { formatApiError } from "../../lib/api-errors";
import { showError, showOk } from "../../lib/alerts";
import type { ComposeChat, ComposePost } from "../../lib/types";
import { postImageList } from "../../lib/images";

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = String(rawId ?? "");
  const isNew = id === "new";

  const [topic, setTopic] = useState("");
  const [weeksStr, setWeeksStr] = useState("");
  const [monthsStr, setMonthsStr] = useState("");
  const [chat, setChat] = useState<ComposeChat | null>(null);
  const [loadingChat, setLoadingChat] = useState(!isNew);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [imageBusyKey, setImageBusyKey] = useState<string | null>(null);

  const durationType = useMemo<"weeks" | "months" | null>(() => {
    if (weeksStr.trim()) return "weeks";
    if (monthsStr.trim()) return "months";
    return null;
  }, [weeksStr, monthsStr]);

  const durationValue = useMemo(() => {
    if (durationType === "weeks") return parseInt(weeksStr, 10);
    if (durationType === "months") return parseInt(monthsStr, 10);
    return NaN;
  }, [durationType, weeksStr, monthsStr]);

  const loadChat = useCallback(async () => {
    if (isNew) {
      setChat(null);
      setLoadingChat(false);
      return;
    }
    setLoadingChat(true);
    try {
      const res = await api.get<{ chat?: ComposeChat; error?: string }>(
        `/api/v2/chats/${encodeURIComponent(id)}`,
      );
      if (!res.data.chat) {
        throw new Error(res.data.error ?? "Chat not found");
      }
      const c = res.data.chat;
      setChat(c);
      setTopic(c.topic ?? "");
      if (c.durationType === "weeks") {
        setWeeksStr(String(c.durationValue));
        setMonthsStr("");
      } else {
        setMonthsStr(String(c.durationValue));
        setWeeksStr("");
      }
      const posts = [...(c.posts ?? [])].sort((a, b) => a.index - b.index);
      setExpanded(new Set([posts[0]?.index ?? 1]));
    } catch (e) {
      showError(formatApiError(e));
      router.back();
    } finally {
      setLoadingChat(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  function togglePost(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function generatePlan() {
    const t = topic.trim();
    if (!t) {
      showError("Enter a topic / strategy.");
      return;
    }
    if (!durationType || !Number.isFinite(durationValue) || durationValue < 1) {
      showError("Enter weeks or months (1+).");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ chat?: ComposeChat; error?: string }>("/api/v2/generate", {
        topic: t,
        durationType,
        durationValue,
        chatId: isNew ? null : id,
      });
      if (res.data.error) {
        throw new Error(res.data.error);
      }
      if (!res.data.chat) {
        throw new Error("Generate failed");
      }
      const c = res.data.chat;
      if (isNew) {
        router.replace(`/chat/${c.id}`);
        return;
      }
      setChat(c);
      const posts = [...c.posts].sort((a, b) => a.index - b.index);
      setExpanded(new Set([posts[0]?.index ?? 1]));
      showOk("Plan generated.");
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setGenerating(false);
    }
  }

  async function copyContent(text: string) {
    try {
      await Clipboard.setStringAsync(text);
      showOk("Copied to clipboard.");
    } catch {
      showError("Could not copy.");
    }
  }

  function formatScheduled(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  const sortedPosts = useMemo(() => {
    const posts = chat?.posts ?? [];
    return [...posts].sort((a, b) => a.index - b.index);
  }, [chat]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center border-b border-border px-3 py-2">
        <Pressable onPress={() => router.back()} className="mr-2 p-2 active:opacity-60">
          <Ionicons name="arrow-back" size={22} color="#f0f0f0" />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-primarytext" numberOfLines={1}>
          {isNew ? "New chat" : chat?.title ?? "Chat"}
        </Text>
      </View>

      {loadingChat ? (
        <ActivityIndicator className="mt-10" size="large" color="#0a66c2" />
      ) : (
        <ScrollView className="flex-1 px-3" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
          <Text className="mt-2 text-xs font-medium text-secondarytext">Topic / strategy</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            multiline
            placeholder="Your LinkedIn plan angle…"
            placeholderTextColor="#666"
            className="mt-1 min-h-[140px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primarytext"
          />

          <Text className="mt-4 text-xs font-medium text-secondarytext">Duration (one only)</Text>
          <View className="mt-2 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1 text-[10px] uppercase text-muted">Weeks</Text>
              <TextInput
                value={weeksStr}
                onChangeText={(v) => {
                  setWeeksStr(v);
                  if (v.trim()) setMonthsStr("");
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#666"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primarytext"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[10px] uppercase text-muted">Months</Text>
              <TextInput
                value={monthsStr}
                onChangeText={(v) => {
                  setMonthsStr(v);
                  if (v.trim()) setWeeksStr("");
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#666"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primarytext"
              />
            </View>
          </View>

          <Pressable
            onPress={() => void generatePlan()}
            disabled={generating}
            className="mt-5 flex-row items-center justify-center gap-2 rounded-lg bg-accent py-3 active:opacity-80 disabled:opacity-40"
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text className="text-sm font-semibold text-white">Generate Plan</Text>
              </>
            )}
          </Pressable>

          {sortedPosts.map((p) => (
            <PostCard
              key={p.index}
              post={p}
              chatId={chat?.id ?? id}
              expanded={expanded.has(p.index)}
              onToggle={() => togglePost(p.index)}
              formatScheduled={formatScheduled}
              onCopy={copyContent}
              imageBusyKey={imageBusyKey}
              setImageBusyKey={setImageBusyKey}
              onImagesChanged={() => void loadChat()}
            />
          ))}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function PostCard({
  post,
  chatId,
  expanded,
  onToggle,
  formatScheduled,
  onCopy,
  imageBusyKey,
  setImageBusyKey,
  onImagesChanged,
}: {
  post: ComposePost;
  chatId: string;
  expanded: boolean;
  onToggle: () => void;
  formatScheduled: (iso: string) => string;
  onCopy: (t: string) => void;
  imageBusyKey: string | null;
  setImageBusyKey: (k: string | null) => void;
  onImagesChanged: () => void;
}) {
  const imgs = postImageList(post);
  const busyKey = `${post.index}-img`;
  const busy = imageBusyKey === busyKey;

  async function uploadUri(uri: string, mime: string) {
    setImageBusyKey(busyKey);
    try {
      const fd = new FormData();
      fd.append("file", { uri, name: "upload.jpg", type: mime } as unknown as Blob);
      await api.post(`/api/v2/chats/${encodeURIComponent(chatId)}/posts/${post.index}/images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (e) {
      showError(e instanceof Error ? e.message : "Upload failed");
      throw e;
    } finally {
      setImageBusyKey(null);
    }
  }

  async function removeAt(imageIndex: number) {
    setImageBusyKey(busyKey);
    try {
      await api.delete(
        `/api/v2/chats/${encodeURIComponent(chatId)}/posts/${post.index}/images/${imageIndex}`,
      );
    } catch (e) {
      showError(e instanceof Error ? e.message : "Remove failed");
      throw e;
    } finally {
      setImageBusyKey(null);
    }
  }

  const statusColor =
    post.status === "published" ? "#1db954" : post.status === "rejected" ? "#888" : "#888";

  return (
    <View className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
      <Pressable onPress={onToggle} className="p-3 active:bg-surface2">
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="rounded-md bg-accent/20 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-accentlight">{post.label}</Text>
          </View>
          <Text
            className="text-[10px] font-bold uppercase"
            style={{ color: statusColor }}
          >
            {post.status}
          </Text>
        </View>
        <Text className="mt-2 text-sm font-semibold text-primarytext">{post.theme}</Text>
        <Text className="mt-1 text-xs text-muted">{formatScheduled(post.scheduledDate)}</Text>
        <Text className="mt-1 text-xs text-secondarytext">{expanded ? "Tap to collapse" : "Tap to expand"}</Text>
      </Pressable>
      {expanded ? (
        <View className="border-t border-border">
          <ImageGallery
            images={imgs}
            canEdit={post.status === "pending"}
            busy={busy}
            title="Post images"
            onRefresh={onImagesChanged}
            uploadUri={uploadUri}
            removeAt={removeAt}
          />
          <Text className="px-3 py-2 text-sm leading-relaxed text-primarytext">{post.content}</Text>
          <View className="flex-row flex-wrap items-center gap-2 border-t border-border px-3 py-3">
            <Pressable
              onPress={() => void onCopy(post.content)}
              className="rounded-lg border border-border px-3 py-2 active:opacity-70"
            >
              <Text className="text-xs font-medium text-primarytext">Copy</Text>
            </Pressable>
            {post.status === "pending" ? (
              <Text className="text-[11px] italic text-secondarytext">
                Publish from the Approvals tab.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
