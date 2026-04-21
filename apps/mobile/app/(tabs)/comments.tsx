import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import type { CommentRow, PublishedPostRecord } from "../../lib/types";

const LIST_PERF = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 6,
  windowSize: 5,
  removeClippedSubviews: Platform.OS === "android",
} as const;

export default function CommentsScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<PublishedPostRecord[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [syncingPosts, setSyncingPosts] = useState(false);
  const [selected, setSelected] = useState<PublishedPostRecord | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyComment, setBusyComment] = useState<string | null>(null);
  const hasLoadedPosts = useRef(false);

  const loadPosts = useCallback(async (mode: "full" | "silent" = "full") => {
    if (mode === "silent") {
      setSyncingPosts(true);
    } else {
      setLoadingPosts(true);
    }
    try {
      const res = await api.get<{ posts?: PublishedPostRecord[] }>("/api/comments/posts");
      if (res.data.posts) setPosts(res.data.posts);
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setLoadingPosts(false);
      setSyncingPosts(false);
      hasLoadedPosts.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!selected) {
        void loadPosts(hasLoadedPosts.current ? "silent" : "full");
      }
    }, [loadPosts, selected]),
  );

  const loadComments = useCallback(async (post: PublishedPostRecord) => {
    setLoadingComments(true);
    setComments([]);
    try {
      const res = await api.get<{ comments?: CommentRow[] }>(
        `/api/comments/fetch/${encodeURIComponent(post.postId)}`,
      );
      setComments(res.data.comments ?? []);
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadComments(selected);
  }, [selected, loadComments]);

  async function suggestReply(comment: CommentRow) {
    if (!selected) return;
    setBusyComment(comment.id);
    try {
      const res = await api.post<{ suggestion?: string; error?: string }>("/api/comments/suggest-reply", {
        postContent: selected.content,
        commentText: comment.text,
        authorName: comment.author,
      });
      const s = res.data.suggestion?.trim();
      if (!s) throw new Error(res.data.error ?? "No suggestion");
      setReplyDrafts((prev) => ({ ...prev, [comment.id]: s }));
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setBusyComment(null);
    }
  }

  async function sendReply(comment: CommentRow) {
    if (!selected) return;
    const text = (replyDrafts[comment.id] ?? "").trim();
    if (!text) {
      showError("Enter a reply.");
      return;
    }
    setBusyComment(comment.id);
    try {
      await api.post("/api/comments/reply", {
        postId: selected.postId,
        commentId: comment.id,
        replyText: text,
      });
      showOk("Reply posted.");
      setReplyDrafts((prev) => ({ ...prev, [comment.id]: "" }));
      await loadComments(selected);
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setBusyComment(null);
    }
  }

  function formatTime(iso: string | null) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  const initialPostsLoading = loadingPosts && posts.length === 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="px-4 pb-2">
        <Text className="text-xl font-semibold text-primarytext">Comments</Text>
        <Text className="mt-1 text-sm text-secondarytext">
          Published posts from your tracker. Select a post to load LinkedIn comments.
        </Text>
      </View>

      {!selected ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          {...LIST_PERF}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
          ListHeaderComponent={
            initialPostsLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#0a66c2" />
                <Text className="mt-3 text-sm text-muted">Loading posts…</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            syncingPosts && posts.length > 0 ? (
              <View className="flex-row items-center justify-center gap-2 py-3">
                <ActivityIndicator size="small" color="#0a66c2" />
                <Text className="text-xs text-muted">Updating…</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !initialPostsLoading ? (
              <Text className="text-center text-sm text-muted">No published posts yet.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              className="mb-3 rounded-xl border border-border bg-surface p-4 active:opacity-80"
            >
              <Text className="text-xs text-muted">{item.publishedAt}</Text>
              {item.theme ? (
                <Text className="mt-1 text-sm font-semibold text-primarytext">{item.theme}</Text>
              ) : null}
              <Text className="mt-2 text-sm text-secondarytext" numberOfLines={4}>
                {item.content}
              </Text>
              <Text className="mt-2 text-[10px] font-mono text-muted" numberOfLines={1}>
                {item.postId}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          <Pressable
            onPress={() => setSelected(null)}
            className="mb-3 self-start rounded-lg border border-border px-3 py-2 active:opacity-70"
          >
            <Text className="text-xs font-semibold text-accentlight">← All posts</Text>
          </Pressable>
          <Text className="text-sm font-semibold text-primarytext">{selected.theme ?? "Post"}</Text>
          <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
            {selected.content}
          </Text>

          <Text className="mt-4 text-sm font-semibold text-primarytext">Comments</Text>
          {loadingComments ? (
            <ActivityIndicator className="mt-4" color="#0a66c2" />
          ) : comments.length === 0 ? (
            <Text className="mt-2 text-sm text-muted">No comments loaded.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} className="mt-3 rounded-xl border border-border bg-surface2 p-3">
                <Text className="text-sm font-semibold text-primarytext">{c.author}</Text>
                <Text className="text-[10px] text-muted">{formatTime(c.createdAt)}</Text>
                <Text className="mt-2 text-sm leading-relaxed text-primarytext">{c.text}</Text>
                <TextInput
                  value={replyDrafts[c.id] ?? ""}
                  onChangeText={(v) => setReplyDrafts((prev) => ({ ...prev, [c.id]: v }))}
                  placeholder="AI suggested reply (editable)"
                  placeholderTextColor="#666"
                  multiline
                  className="mt-2 min-h-[72px] rounded-lg border border-border bg-surface px-2 py-2 text-sm text-primarytext"
                />
                <View className="mt-2 flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => void suggestReply(c)}
                    disabled={busyComment === c.id}
                    className="rounded-lg border border-border px-3 py-2 active:opacity-70 disabled:opacity-40"
                  >
                    {busyComment === c.id ? (
                      <ActivityIndicator size="small" color="#1d8aff" />
                    ) : (
                      <Text className="text-xs font-medium text-accentlight">Suggest reply</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => void sendReply(c)}
                    disabled={busyComment === c.id}
                    className="rounded-lg bg-accent px-3 py-2 active:opacity-80 disabled:opacity-40"
                  >
                    <Text className="text-xs font-semibold text-white">Send reply</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
