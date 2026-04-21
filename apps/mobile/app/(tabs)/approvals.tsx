import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageGallery } from "../../components/ImageGallery";
import { api } from "../../lib/api";
import { formatApiError } from "../../lib/api-errors";
import { confirmAsync, showError, showOk } from "../../lib/alerts";
import { approvalImageList, resolveApprovalTiming } from "../../lib/images";
import type { ApprovalTiming, ScheduledApprovalRow } from "../../lib/types";

const FILTERS: { key: "all" | ApprovalTiming; label: string }[] = [
  { key: "all", label: "All" },
  { key: "due", label: "Due Now" },
  { key: "upcoming", label: "Upcoming" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

const POLL_MS = 120_000;

const LIST_PERF = {
  initialNumToRender: 5,
  maxToRenderPerBatch: 4,
  windowSize: 5,
  removeClippedSubviews: Platform.OS === "android",
} as const;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function countdownLabel(days: number) {
  if (days <= 0) return "Due";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.ceil(days / 7)} wk`;
  return `In ${Math.ceil(days / 30)} mo`;
}

const ApprovalRow = memo(function ApprovalRow({
  item: a,
  expanded,
  draftText,
  timing: t,
  isSaving,
  isAction,
  isImageBusy,
  onToggleExpand,
  onDraftLine,
  onSaveId,
  onApproveId,
  onRejectId,
  onRefreshGallery,
  onUploadImage,
  onRemoveImage,
}: {
  item: ScheduledApprovalRow;
  expanded: boolean;
  draftText: string;
  timing: ApprovalTiming;
  isSaving: boolean;
  isAction: boolean;
  isImageBusy: boolean;
  onToggleExpand: (id: string) => void;
  onDraftLine: (id: string, text: string) => void;
  onSaveId: (id: string) => void;
  onApproveId: (id: string) => void;
  onRejectId: (id: string) => void;
  onRefreshGallery: () => void;
  onUploadImage: (approvalId: string, uri: string, mime: string) => Promise<void>;
  onRemoveImage: (approvalId: string, imageIndex: number) => Promise<void>;
}) {
  const borderClass =
    t === "due" ? "border-rose-500" : t === "published" ? "border-success" : "border-border";
  const opacity = t === "upcoming" ? 0.65 : 1;
  const imgs = approvalImageList(a);

  const uploadUri = useCallback(
    async (uri: string, mime: string) => onUploadImage(a.id, uri, mime),
    [a.id, onUploadImage],
  );
  const removeAt = useCallback(
    async (imageIndex: number) => onRemoveImage(a.id, imageIndex),
    [a.id, onRemoveImage],
  );

  const handleToggle = useCallback(() => onToggleExpand(a.id), [a.id, onToggleExpand]);
  const handleDraft = useCallback((text: string) => onDraftLine(a.id, text), [a.id, onDraftLine]);
  const handleSave = useCallback(() => onSaveId(a.id), [a.id, onSaveId]);
  const handleApprove = useCallback(() => onApproveId(a.id), [a.id, onApproveId]);
  const handleReject = useCallback(() => onRejectId(a.id), [a.id, onRejectId]);

  return (
    <Pressable
      onPress={handleToggle}
      className={`mb-3 rounded-xl border-2 bg-surface p-3 active:opacity-90 ${borderClass}`}
      style={{ opacity }}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        {t === "due" ? (
          <View className="rounded-md bg-rose-600/40 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-rose-100">DUE NOW</Text>
          </View>
        ) : t === "upcoming" ? (
          <View className="rounded-md bg-white/10 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-muted">
              {countdownLabel(a.daysUntil ?? 0)}
            </Text>
          </View>
        ) : t === "published" ? (
          <View className="rounded-md bg-success/25 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-success">Published</Text>
          </View>
        ) : (
          <View className="rounded-md bg-zinc-600/40 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase text-muted">Rejected</Text>
          </View>
        )}
        <Text className="text-[10px] font-semibold uppercase text-muted">{a.label}</Text>
      </View>
      <Text className="mt-2 text-xs text-secondarytext">
        Topic: <Text className="text-primarytext">“{a.displayChatTitle ?? a.chatTitle}”</Text>
      </Text>
      <Text className="mt-1 text-sm text-primarytext">
        <Text className="text-muted">Theme: </Text>
        {a.theme}
      </Text>
      <Text className="mt-1 text-xs text-muted">Scheduled: {formatDate(a.scheduledDate)}</Text>

      {expanded ? (
        <View className="mt-3 border-t border-border pt-3">
          {a.status === "pending" ? (
            <>
              <Text className="text-xs text-muted">Edit content</Text>
              <TextInput
                value={draftText}
                onChangeText={handleDraft}
                multiline
                className="mt-1 min-h-[120px] rounded-lg border border-border bg-surface2 px-2 py-2 text-sm text-primarytext"
              />
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className="mt-2 self-start rounded-lg bg-accent px-3 py-2 active:opacity-80 disabled:opacity-40"
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-xs font-semibold text-white">Save changes</Text>
                )}
              </Pressable>
            </>
          ) : (
            <ScrollView nestedScrollEnabled className="max-h-48">
              <Text className="text-sm leading-relaxed text-primarytext">{a.content}</Text>
            </ScrollView>
          )}

          <ImageGallery
            images={imgs}
            canEdit={a.status === "pending"}
            busy={isImageBusy}
            title="Post images"
            onRefresh={onRefreshGallery}
            uploadUri={uploadUri}
            removeAt={removeAt}
          />

          {t === "due" && a.status === "pending" ? (
            <View className="mt-4 flex-row flex-wrap justify-end gap-2">
              <Pressable
                onPress={handleReject}
                disabled={isAction || isImageBusy}
                className="rounded-lg border border-border px-4 py-2 active:opacity-70 disabled:opacity-40"
              >
                <Text className="text-sm text-primarytext">Reject</Text>
              </Pressable>
              <Pressable
                onPress={handleApprove}
                disabled={isAction || isImageBusy || isSaving}
                className="rounded-lg bg-accent px-4 py-2 active:opacity-80 disabled:opacity-40"
              >
                {isAction ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Approve & Publish</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <Text className="mt-2 text-xs text-muted">Tap to expand</Text>
      )}
    </Pressable>
  );
});

export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const [approvals, setApprovals] = useState<ScheduledApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedOnce = useRef(false);
  const draftRef = useRef(draftContent);
  useEffect(() => {
    draftRef.current = draftContent;
  }, [draftContent]);

  const load = useCallback(async (mode: "full" | "silent" = "full") => {
    if (mode === "silent") {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.get<{ approvals?: ScheduledApprovalRow[] }>("/api/approvals");
      if (res.data.approvals) {
        setApprovals(res.data.approvals);
        setDraftContent((prev) => {
          const next = { ...prev };
          for (const a of res.data.approvals ?? []) {
            if (next[a.id] === undefined) next[a.id] = a.content;
          }
          return next;
        });
      }
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
      intervalRef.current = setInterval(() => void load("silent"), POLL_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }, [load]),
  );

  const filtered = useMemo(() => {
    return approvals.filter((a) => {
      const t = resolveApprovalTiming(a);
      if (filter === "all") return true;
      return t === filter;
    });
  }, [approvals, filter]);

  const dueCount = useMemo(
    () => approvals.filter((a) => resolveApprovalTiming(a) === "due").length,
    [approvals],
  );

  const saveContent = useCallback(
    async (approvalId: string) => {
      const fromDraft = draftRef.current[approvalId];
      const row = approvals.find((x) => x.id === approvalId);
      const text = (fromDraft ?? row?.content ?? "").trim();
      if (!text) {
        showError("Content cannot be empty.");
        return;
      }
      setSavingId(approvalId);
      try {
        await api.patch(`/api/approvals/${encodeURIComponent(approvalId)}`, { content: text });
        showOk("Saved.");
        await load("silent");
      } catch (e) {
        showError(formatApiError(e));
      } finally {
        setSavingId(null);
      }
    },
    [approvals, load],
  );

  const approve = useCallback(
    async (id: string) => {
      setActionId(id);
      try {
        await api.post(`/api/approvals/${encodeURIComponent(id)}/approve`);
        showOk("Published to LinkedIn.");
        await load("silent");
      } catch (e) {
        showError(formatApiError(e));
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const reject = useCallback(async (id: string) => {
    const ok = await confirmAsync("Reject post?", "This will mark the approval as rejected.");
    if (!ok) return;
    setActionId(id);
    try {
      await api.post(`/api/approvals/${encodeURIComponent(id)}/reject`);
      showOk("Rejected.");
      await load("silent");
    } catch (e) {
      showError(formatApiError(e));
    } finally {
      setActionId(null);
    }
  }, [load]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
  }, []);

  const draftLine = useCallback((id: string, text: string) => {
    setDraftContent((prev) => ({ ...prev, [id]: text }));
  }, []);

  const saveContentRef = useRef(saveContent);
  const approveRef = useRef(approve);
  const rejectRef = useRef(reject);
  useEffect(() => {
    saveContentRef.current = saveContent;
    approveRef.current = approve;
    rejectRef.current = reject;
  }, [saveContent, approve, reject]);

  const onSaveId = useCallback((id: string) => void saveContentRef.current(id), []);
  const onApproveId = useCallback((id: string) => void approveRef.current(id), []);
  const onRejectId = useCallback((id: string) => void rejectRef.current(id), []);

  const onRefreshGallery = useCallback(() => {
    void load("silent");
  }, [load]);

  const handleUploadImage = useCallback(async (approvalId: string, uri: string, mime: string) => {
    setImageBusyId(approvalId);
    try {
      const fd = new FormData();
      fd.append("file", { uri, name: "upload.jpg", type: mime } as unknown as Blob);
      await api.post(`/api/approvals/${encodeURIComponent(approvalId)}/images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (e) {
      showError(formatApiError(e));
      throw e;
    } finally {
      setImageBusyId(null);
    }
  }, []);

  const handleRemoveImage = useCallback(async (approvalId: string, imageIndex: number) => {
    setImageBusyId(approvalId);
    try {
      await api.delete(`/api/approvals/${encodeURIComponent(approvalId)}/images/${imageIndex}`);
    } catch (e) {
      showError(formatApiError(e));
      throw e;
    } finally {
      setImageBusyId(null);
    }
  }, []);

  const renderItem = useCallback(
    ({ item: a }: { item: ScheduledApprovalRow }) => {
      const t = resolveApprovalTiming(a);
      const expanded = expandedId === a.id;
      return (
        <ApprovalRow
          item={a}
          expanded={expanded}
          draftText={draftContent[a.id] ?? a.content}
          timing={t}
          isSaving={savingId === a.id}
          isAction={actionId === a.id}
          isImageBusy={imageBusyId === a.id}
          onToggleExpand={toggleExpand}
          onDraftLine={draftLine}
          onSaveId={onSaveId}
          onApproveId={onApproveId}
          onRejectId={onRejectId}
          onRefreshGallery={onRefreshGallery}
          onUploadImage={handleUploadImage}
          onRemoveImage={handleRemoveImage}
        />
      );
    },
    [
      expandedId,
      draftContent,
      savingId,
      actionId,
      imageBusyId,
      toggleExpand,
      draftLine,
      onSaveId,
      onApproveId,
      onRejectId,
      onRefreshGallery,
      handleUploadImage,
      handleRemoveImage,
    ],
  );

  const initialLoading = loading && approvals.length === 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="px-4 pb-2">
        <Text className="text-xl font-semibold text-primarytext">Approvals</Text>
        <Text className="mt-1 text-sm text-secondarytext">
          Scheduled posts from Compose V2. Pull to refresh; auto-refresh every 2 min while this tab
          is open.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 px-2">
        <View className="flex-row gap-2 pb-2 pl-2 pr-4">
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`flex-row items-center rounded-full border px-3 py-1.5 active:opacity-80 ${
                filter === f.key ? "border-accent bg-accent/20" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  filter === f.key ? "text-accentlight" : "text-secondarytext"
                }`}
              >
                {f.label}
              </Text>
              {f.key === "due" && dueCount > 0 ? (
                <View className="ml-2 min-w-[18px] rounded-full bg-rose-600 px-1 py-0.5">
                  <Text className="text-center text-[10px] font-bold text-white">{dueCount}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        {...LIST_PERF}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1 }}
        ListHeaderComponent={
          initialLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#0a66c2" />
              <Text className="mt-3 text-sm text-muted">Loading approvals…</Text>
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
          syncing && approvals.length > 0 ? (
            <View className="flex-row items-center justify-center gap-2 py-3">
              <ActivityIndicator size="small" color="#0a66c2" />
              <Text className="text-xs text-muted">Updating…</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !initialLoading ? (
            <Text className="mt-10 text-center text-sm text-muted">No items in this view.</Text>
          ) : null
        }
      />
    </View>
  );
}
