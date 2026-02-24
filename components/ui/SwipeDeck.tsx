"use client";

import React, { useState, useLayoutEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  PanInfo,
  useAnimation,
} from "framer-motion";

interface SwipeDeckProps<T> {
  data: T[];
  renderCard: (item: T) => React.ReactNode;
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  canSwipeRight?: (item: T) => boolean;
  onSwipedAll?: () => void;
  keyExtractor: (item: T) => string;
}

const SWIPE_THRESHOLD = 150;

export function SwipeDeck<T>({
  data,
  renderCard,
  onSwipeLeft,
  onSwipeRight,
  canSwipeRight,
  onSwipedAll,
  keyExtractor,
}: SwipeDeckProps<T>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-8, 8]);
  const opacity = useTransform(x, [-400, -200, 0, 200, 400], [0, 1, 1, 1, 0]);
  const nextCardScale = useTransform(x, [-300, 0, 300], [1, 0.92, 1]);
  const nextCardOpacity = useTransform(x, [-300, 0, 300], [1, 0.6, 1]);

  const controls = useAnimation();

  useLayoutEffect(() => {
    controls.set({ x: 0, opacity: 1 });
  }, [currentIndex, controls]);

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const isSwipeRight =
      info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 800;
    const isSwipeLeft =
      info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -800;

    if (isSwipeRight) {
      const currentItem = data[currentIndex];
      if (canSwipeRight && !canSwipeRight(currentItem)) {
        controls.start({
          x: 0,
          opacity: 1,
          transition: { type: "spring", stiffness: 300, damping: 20 },
        });
        return;
      }
      if (onSwipeRight) onSwipeRight(currentItem);
      await controls.start({
        x: 500,
        opacity: 0,
        transition: { duration: 0.25 },
      });
      handleNext(1);
    } else if (isSwipeLeft) {
      await controls.start({
        x: -500,
        opacity: 0,
        transition: { duration: 0.25 },
      });
      handleNext(-1);
    } else {
      controls.start({
        x: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      });
    }
  };

  const handleNext = (direction: number) => {
    const currentItem = data[currentIndex];
    if (direction < 0 && onSwipeLeft) onSwipeLeft(currentItem);

    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next === data.length && onSwipedAll) {
        onSwipedAll();
      }
      return next;
    });
    x.set(0);
    controls.set({ x: 0, opacity: 1 });
  };

  if (currentIndex >= data.length) {
    return (
      <div className="flex-1 w-full h-[600px] flex items-center justify-center" />
    );
  }

  return (
    <div className="relative w-full h-[70vh]  flex items-center justify-center perspective-[1000px]">
      {[...data].reverse().map((item, reversedIndex) => {
        const index = data.length - 1 - reversedIndex;
        if (index < currentIndex || index > currentIndex + 2) return null;

        const isTopCard = index === currentIndex;
        const isSecondCard = index === currentIndex + 1;

        return (
          <motion.div
            key={keyExtractor(item)}
            className="absolute w-full max-w-[420px]  h-full flex items-center justify-center will-change-transform"
            style={{
              zIndex: data.length - index,
              scale: isTopCard ? 1 : isSecondCard ? nextCardScale : 0.92,
              opacity: isTopCard ? opacity : isSecondCard ? nextCardOpacity : 0,

              rotate: isTopCard ? rotate : 0,
              x: isTopCard ? x : 0,
            }}
            drag={isTopCard ? "x" : false}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={1}
            onDragEnd={isTopCard ? handleDragEnd : undefined}
            whileTap={isTopCard ? { cursor: "grabbing" } : undefined}
            initial={
              isTopCard
                ? false
                : { scale: 0.92, opacity: isSecondCard ? 0.6 : 0 }
            }
            animate={
              isTopCard
                ? controls
                : {
                    scale: isSecondCard ? nextCardScale.get() : 0.92,
                    opacity: isSecondCard ? nextCardOpacity.get() : 0,
                  }
            }
            transition={{ duration: 0.2 }}
          >
            {renderCard(item)}
          </motion.div>
        );
      })}
    </div>
  );
}
