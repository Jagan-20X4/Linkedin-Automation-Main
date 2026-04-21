import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { formatApiError } from "../../lib/api-errors";
import { showError } from "../../lib/alerts";
import type { ChatSummary } from "../../lib/types";

const LIST_PERF = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 6,
  windowSize: 5,
  removeClippedSubviews: Platform.OS === "android",
} as const;

function formatDate(iso: string) {
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

const ChatRow = memo(function ChatRow({
  item,
  onOpen,
  onDeleteRequest,
}: {
  item: ChatSummary;
  onOpen: (id: string) => void;
  onDeleteRequest: (id: string, title: string) => void;
}) {
  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable
          onPress={() => onDeleteRequest(item.id, item.displayTitle ?? item.title)}
          className="mb-3 ml-2 w-20 items-center justify-center rounded-lg bg-rose-700 active:opacity-80"
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text className="mt-1 text-[10px] font-semibold text-white">Delete</Text>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onOpen(item.id)}
        onLongPress={() => onDeleteRequest(item.id, item.displayTitle ?? item.title)}
        className="mb-3 rounded-xl border border-border bg-surface p-4 active:opacity-80"
      >
        <Text className="text-base font-semibold text-primarytext">{item.displayTitle ?? item.title}</Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-accent/25 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-accentlight">
              {item.durationType === "weeks" ? `${item.durationValue} wk` : `${item.durationValue} mo`}
            </Text>
          </View>
          <Text className="text-xs text-muted">{item.postCount} posts</Text>
          <Text className="text-xs text-muted">{formatDate(item.createdAt)}</Text>
        </View>
      </Pressable>
    </Swipeable>
  );
});

export default function ComposeV2ListScreen() {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async (mode: "full" | "silent" = "full") => {
    if (mode === "silent") {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.get<{ chats?: ChatSummary[] }>("/api/v2/chats");
      if (res.data.chats) setChats(res.data.chats);
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedOnce.current ? "silent" : "full");
    }, [load]),
  );

  const deleteChat = useCallback((id: string, title: string) => {
    Alert.alert("Delete chat", `Remove “${title}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/v2/chats/${encodeURIComponent(id)}`);
            await load("silent");
          } catch (e) {
            showError(formatApiError(e));
          }
        },
      },
    ]);
  }, [load]);

  const onOpen = useCallback((id: string) => {
    router.push(`/chat/${id}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatSummary }) => (
      <ChatRow item={item} onOpen={onOpen} onDeleteRequest={deleteChat} />
    ),
    [onOpen, deleteChat],
  );

  const initialLoading = loading && chats.length === 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-4 pb-3">
        <Text className="text-xl font-semibold text-primarytext">Compose V2</Text>
        <Pressable
          onPress={() => router.push("/chat/new")}
          className="flex-row items-center gap-1 rounded-lg bg-accent px-3 py-2 active:opacity-80"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text className="text-sm font-semibold text-white">New Chat</Text>
        </Pressable>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        {...LIST_PERF}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          initialLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#0a66c2" />
              <Text className="mt-3 text-sm text-muted">Loading chats…</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load("full");
            }}
            tintColor="#0a66c2"
          />
        }
        ListFooterComponent={
          syncing && chats.length > 0 ? (
            <View className="flex-row items-center justify-center gap-2 py-3">
              <ActivityIndicator size="small" color="#0a66c2" />
              <Text className="text-xs text-muted">Updating…</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !initialLoading ? (
            <Text className="mt-10 text-center text-sm text-muted">No chats yet. Tap + New Chat</Text>
          ) : null
        }
      />
    </View>
  );
}
