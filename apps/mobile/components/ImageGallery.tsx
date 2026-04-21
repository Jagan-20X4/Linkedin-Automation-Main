import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

const TH = 96;
const TW = 96;

type Props = {
  images: string[];
  canEdit: boolean;
  busy?: boolean;
  title?: string;
  maxImages?: number;
  onRefresh: () => void | Promise<void>;
  uploadUri: (localUri: string, mime: string) => Promise<void>;
  removeAt: (index: number) => Promise<void>;
};

export function ImageGallery({
  images,
  canEdit,
  busy = false,
  title = "Images",
  maxImages = 9,
  onRefresh,
  uploadUri,
  removeAt,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const maxW = Dimensions.get("window").width * 0.92;
  const maxH = Dimensions.get("window").height * 0.78;

  async function pickAndUpload() {
    if (!canEdit || busy || images.length >= maxImages) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const uri = asset.uri;
    const mime = asset.mimeType ?? "image/jpeg";
    try {
      await uploadUri(uri, mime);
      await onRefresh();
    } catch {
      /* parent shows alert */
    }
  }

  async function remove(i: number) {
    if (!canEdit || busy) return;
    try {
      await removeAt(i);
      await onRefresh();
    } catch {
      /* parent */
    }
  }

  if (images.length === 0 && !canEdit) return null;

  return (
    <View className="border-t border-border bg-surface2/50 px-3 py-2">
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-[10px] font-semibold uppercase text-muted">{title}</Text>
        {canEdit && images.length < maxImages ? (
          <Pressable
            onPress={() => void pickAndUpload()}
            disabled={busy}
            className="rounded-md border border-dashed border-border px-2 py-1 active:opacity-70 disabled:opacity-40"
          >
            <Text className="text-xs font-medium text-secondarytext">+ Add image</Text>
          </Pressable>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color="#1d8aff" />
      ) : images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row flex-wrap gap-2">
            {images.map((src, i) => (
              <View
                key={`${i}-${src.slice(0, 32)}`}
                className="relative overflow-hidden rounded-lg border border-border bg-black/40"
                style={{ width: TW, height: TH }}
              >
                <Pressable onPress={() => setPreview(src)} style={{ flex: 1 }}>
                  <Image source={{ uri: src }} style={{ width: TW, height: TH }} resizeMode="cover" />
                </Pressable>
                {canEdit ? (
                  <Pressable
                    onPress={() => void remove(i)}
                    disabled={busy}
                    className="absolute right-1 top-1 z-10 h-7 w-7 items-center justify-center rounded-full bg-black/75 active:opacity-80"
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text className="text-xs text-muted">No images yet.</Text>
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable
          onPress={() => setPreview(null)}
          className="flex-1 items-center justify-center bg-black/90 px-4 pt-14"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {preview ? (
              <Image
                source={{ uri: preview }}
                resizeMode="contain"
                style={{ width: maxW, height: maxH }}
              />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setPreview(null)}
            className="mt-4 rounded-full border border-border bg-surface px-4 py-2 active:opacity-80"
          >
            <Text className="text-sm text-primarytext">Close</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
