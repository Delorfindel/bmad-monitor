<script setup lang="ts">
import { computed } from 'vue'
import {
  STATUS_DISPLAY_ORDER,
  STATUS_LABELS,
  type StatusCounts,
  type StoryStatus
} from '../../../../src/bmad/types'
import { percent } from '../format'

const props = withDefaults(
  defineProps<{ counts: StatusCounts; label?: string; compact?: boolean }>(),
  { label: 'Sprint progress', compact: false }
)

const total = computed(() =>
  STATUS_DISPLAY_ORDER.reduce((sum, status) => sum + props.counts[status], 0)
)
const segments = computed(() =>
  STATUS_DISPLAY_ORDER.filter((status) => props.counts[status] > 0).map((status) => ({
    status,
    count: props.counts[status],
    share: percent(props.counts[status], total.value)
  }))
)
const summary = computed(() =>
  segments.value.map((segment) => `${segment.count} ${STATUS_LABELS[segment.status]}`).join(', ')
)
const labelFor = (status: StoryStatus): string => STATUS_LABELS[status]
</script>

<template>
  <div class="bm-progress" :class="{ 'bm-progress--compact': compact }">
    <div
      class="bm-track"
      role="img"
      :aria-label="`${label}: ${total ? summary : 'no stories'}`"
    >
      <span
        v-for="segment in segments"
        :key="segment.status"
        class="bm-seg"
        :data-status="segment.status"
        :style="{ width: `${segment.share}%` }"
      />
      <span v-if="total === 0" class="bm-seg bm-seg--empty" style="width: 100%" />
    </div>
    <ul v-if="!compact" class="bm-legend">
      <li v-for="segment in segments" :key="segment.status" :data-status="segment.status">
        <span class="bm-dot" aria-hidden="true" />
        <span class="bm-legend-count">{{ segment.count }}</span>
        <span class="bm-legend-label">{{ labelFor(segment.status) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bm-progress {
  display: flex;
  flex-direction: column;
  gap: var(--noir-s5);
}
.bm-track {
  display: flex;
  gap: 3px;
  height: 12px;
  border-radius: var(--noir-r-pill);
  overflow: hidden;
  background: var(--noir-inset);
}
.bm-progress--compact .bm-track {
  height: 6px;
  gap: 2px;
}
.bm-seg {
  display: block;
  min-width: 3px;
  background-color: var(--bm-hue);
  background-image: var(--bm-texture, none);
}
.bm-seg--empty {
  background-color: var(--noir-plane-3);
  background-image: var(--noir-hachure);
}
.bm-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--noir-s4) var(--noir-s6);
  margin: 0;
  padding: 0;
  list-style: none;
}
.bm-legend li {
  display: flex;
  align-items: baseline;
  gap: var(--noir-s3);
  font-family: var(--noir-display);
}
.bm-legend .bm-dot {
  align-self: center;
}
.bm-legend-count {
  font-size: var(--noir-t5);
  font-weight: 300;
  letter-spacing: -0.02em;
  color: var(--noir-ink);
}
.bm-legend-label {
  font-size: var(--noir-t2);
  color: var(--noir-ink-3);
}
</style>
