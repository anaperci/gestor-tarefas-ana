"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { api } from "./api";
import type { ContentComment, ContentItem, ContentSlide } from "./types";

interface ListFilters {
  status?: string[];
  format?: string[];
  platform?: string;
  assignedTo?: string;
  search?: string;
}

const LIST_KEY = "content:list";

function listKey(filters: ListFilters) {
  return [LIST_KEY, JSON.stringify(filters)] as const;
}

export function useContentItems(filters: ListFilters) {
  const { data, error, isLoading, mutate } = useSWR(
    listKey(filters),
    () => api.getContentItems(filters),
    { revalidateOnFocus: true }
  );
  return { items: data, error, isLoading, mutate };
}

export function useContentItem(id: string | null) {
  const { mutate: mutateAll } = useSWRConfig();

  const itemSwr = useSWR<ContentItem>(
    id ? `content:item:${id}` : null,
    () => api.getContentItem(id!),
    { revalidateOnFocus: true }
  );
  const slidesSwr = useSWR<ContentSlide[]>(
    id ? `content:slides:${id}` : null,
    () => api.getContentSlides(id!),
    { revalidateOnFocus: false }
  );
  const commentsSwr = useSWR<ContentComment[]>(
    id ? `content:comments:${id}` : null,
    () => api.getContentComments(id!),
    { revalidateOnFocus: true, refreshInterval: 10_000 }
  );

  const refreshLists = useCallback(() => {
    mutateAll((key) => Array.isArray(key) && key[0] === LIST_KEY, undefined, { revalidate: true });
  }, [mutateAll]);

  return {
    item: itemSwr.data,
    slides: slidesSwr.data ?? [],
    comments: commentsSwr.data ?? [],
    isLoading: itemSwr.isLoading,
    error: itemSwr.error,
    mutateItem: itemSwr.mutate,
    mutateSlides: slidesSwr.mutate,
    mutateComments: commentsSwr.mutate,
    refreshLists,
  };
}
