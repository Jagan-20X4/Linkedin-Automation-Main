import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { formatApiError } from "../../lib/api-errors";
import { showError } from "../../lib/alerts";
import type { ChatSummary, ScheduledApprovalRow } from "../../lib/types";
import { resolveApprovalTiming } from "../../lib/images";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [approvals, setApprovals] = useState<ScheduledApprovalRow[]>([]);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async (mode: "full" | "silent" = "full") => {
    if (mode === "silent") {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    try {
      const [chRes, apRes] = await Promise.all([
        api.get<{ chats?: ChatSummary[] }>("/api/v2/chats"),
        api.get<{ approvals?: ScheduledApprovalRow[] }>("/api/approvals"),
      ]);
      if (chRes.data.chats) setChats(chRes.data.chats);
      if (apRes.data.approvals) setApprovals(apRes.data.approvals);
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

  const dueCount = useMemo(
    () => approvals.filter((a) => resolveApprovalTiming(a) === "due").length,
    [approvals],
  );
  const publishedCount = useMemo(
    () => approvals.filter((a) => a.status === "published").length,
    [approvals],
  );

  const initialLoading = loading && chats.length === 0 && approvals.length === 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <ScrollView
        className="flex-1 px-4"
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
      >
        <View className="mb-2 flex-row items-center gap-2">
          <Ionicons name="flash-outline" size={22} color="#0a66c2" />
          <Text className="text-xl font-semibold text-primarytext">LinkedIn Autopilot</Text>
        </View>
        <Text className="mb-2 text-sm text-secondarytext">Overview from your backend.</Text>
        {syncing && !initialLoading ? (
          <View className="mb-4 flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#0a66c2" />
            <Text className="text-xs text-muted">Updating…</Text>
          </View>
        ) : null}

        <View className="gap-3 pb-10">
          <View className="rounded-xl border border-border bg-surface p-4">
            <Text className="text-xs font-semibold uppercase text-muted">Total chats</Text>
            {initialLoading ? (
              <ActivityIndicator className="mt-4" size="small" color="#0a66c2" />
            ) : (
              <Text className="mt-2 text-3xl font-bold text-primarytext">{chats.length}</Text>
            )}
          </View>
          <View className="rounded-xl border border-border bg-surface p-4">
            <Text className="text-xs font-semibold uppercase text-muted">Due now (approvals)</Text>
            {initialLoading ? (
              <ActivityIndicator className="mt-4" size="small" color="#0a66c2" />
            ) : (
              <Text className="mt-2 text-3xl font-bold text-rose-300">{dueCount}</Text>
            )}
          </View>
          <View className="rounded-xl border border-border bg-surface p-4">
            <Text className="text-xs font-semibold uppercase text-muted">Published (approvals)</Text>
            {initialLoading ? (
              <ActivityIndicator className="mt-4" size="small" color="#0a66c2" />
            ) : (
              <Text className="mt-2 text-3xl font-bold text-success">{publishedCount}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
