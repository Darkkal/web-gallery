import { useEffect, useState } from "react";

export function useLightbox(
  itemsLength: number,
  getGroupLength?: (index: number) => number,
  options?: {
    onLoadMore?: () => Promise<void> | void;
    hasMore?: boolean;
    isLoading?: boolean;
    preloadBuffer?: number;
  },
) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [prevItemsLength, setPrevItemsLength] = useState(itemsLength);
  const [shouldAdvancePending, setShouldAdvancePending] = useState(false);
  const [prevIsLoading, setPrevIsLoading] = useState(false);

  const preloadBuffer = options?.preloadBuffer ?? 3;

  // Sync external itemsLength updates when not waiting to advance
  if (itemsLength !== prevItemsLength && !shouldAdvancePending) {
    setPrevItemsLength(itemsLength);
  }

  // Proactively fetch more items in the background when getting close to the end of the loaded feed
  useEffect(() => {
    if (
      selectedIndex !== null &&
      options?.hasMore &&
      options?.onLoadMore &&
      !options.isLoading &&
      !shouldAdvancePending &&
      itemsLength - 1 - selectedIndex <= preloadBuffer
    ) {
      options.onLoadMore();
    }
  }, [
    selectedIndex,
    itemsLength,
    preloadBuffer,
    options?.hasMore,
    options?.onLoadMore,
    options?.isLoading,
    shouldAdvancePending,
  ]);

  // If itemsLength increases while we are pending, immediately advance to the first new item
  if (shouldAdvancePending && itemsLength > prevItemsLength) {
    setSelectedIndex(prevItemsLength);
    setMediaIndex(0);
    setPrevItemsLength(itemsLength);
    setShouldAdvancePending(false);
  }

  // Handle loading completion when we are pending (cancel pending if no items were added)
  useEffect(() => {
    if (options?.isLoading !== undefined) {
      if (prevIsLoading && !options.isLoading) {
        if (shouldAdvancePending) {
          // Finished loading but length didn't change (no more records available)
          setShouldAdvancePending(false);
        }
      }
      setPrevIsLoading(options.isLoading);
    }
  }, [options?.isLoading, prevIsLoading, shouldAdvancePending]);

  const open = (index: number, mIndex: number = 0) => {
    setSelectedIndex(index);
    setMediaIndex(mIndex);
    setShouldAdvancePending(false);
  };

  const close = () => {
    setSelectedIndex(null);
    setShouldAdvancePending(false);
  };

  const next = () => {
    if (selectedIndex === null) return;

    const groupLength = getGroupLength ? getGroupLength(selectedIndex) : 1;

    if (mediaIndex < groupLength - 1) {
      setMediaIndex(mediaIndex + 1);
    } else if (selectedIndex < itemsLength - 1) {
      setSelectedIndex(selectedIndex + 1);
      setMediaIndex(0);
    } else if (
      options?.hasMore &&
      options?.onLoadMore &&
      !options.isLoading &&
      !shouldAdvancePending
    ) {
      setShouldAdvancePending(true);
      options.onLoadMore();
    }
  };

  const prev = () => {
    if (selectedIndex === null) return;
    setShouldAdvancePending(false); // Reset pending load-more advance if user decides to browse backward

    if (mediaIndex > 0) {
      setMediaIndex(mediaIndex - 1);
    } else if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelectedIndex(prevIndex);
      const prevGroupLength = getGroupLength ? getGroupLength(prevIndex) : 1;
      setMediaIndex(prevGroupLength - 1);
    }
  };

  return {
    selectedIndex,
    mediaIndex,
    isOpen: selectedIndex !== null,
    isPageLoading: shouldAdvancePending,
    open,
    close,
    next,
    prev,
    setSelectedIndex,
    setMediaIndex,
  };
}
