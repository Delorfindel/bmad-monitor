<script setup lang="ts">
import { computed } from 'vue'
import {
  EPIC_STATUS_LABELS,
  STATUS_LABELS,
  type EpicStatus,
  type StoryStatus
} from '../../../../src/bmad/types'

const props = withDefaults(
  defineProps<{
    status: StoryStatus | EpicStatus
    kind?: 'story' | 'epic'
    /** Prefix read by assistive technology, e.g. "Story status". */
    context?: string
  }>(),
  { kind: 'story', context: 'Status' }
)

const label = computed<string>(() => {
  const labels: Record<string, string> =
    props.kind === 'epic' ? EPIC_STATUS_LABELS : STATUS_LABELS
  return labels[props.status] ?? props.status
})
</script>

<template>
  <span class="bm-badge" :data-status="status">
    <span class="bm-dot" aria-hidden="true" />
    <span class="bm-sr">{{ context }}:</span>
    {{ label }}
  </span>
</template>
