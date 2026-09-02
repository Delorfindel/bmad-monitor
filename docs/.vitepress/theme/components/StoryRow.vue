<script setup lang="ts">
import { computed } from 'vue'
import type { ChecklistProgress, SprintStory } from '../../../../src/bmad/types'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ story: SprintStory; current?: boolean }>()

function describe(progress: ChecklistProgress | undefined, noun: string): string | null {
  if (!progress || progress.total === 0) return null
  return progress.checkable
    ? `${progress.completed}/${progress.total} ${noun}`
    : `${progress.total} ${noun}`
}

const acceptance = computed(() => describe(props.story.acceptanceCriteria, 'AC'))
const tasks = computed(() => describe(props.story.tasks, 'tasks'))
</script>

<template>
  <a class="bm-story" :href="story.route" :aria-current="current ? 'page' : undefined">
    <span class="bm-story-id">{{ story.label }}</span>
    <span class="bm-story-main">
      <span class="bm-story-title">{{ story.title }}</span>
      <span class="bm-story-meta">
        <span v-if="acceptance">{{ acceptance }}</span>
        <span v-if="tasks">{{ tasks }}</span>
        <span v-if="story.missingSource" class="bm-story-missing">
          <span aria-hidden="true">▨</span> no story file
        </span>
      </span>
    </span>
    <StatusBadge :status="story.status" context="Story status" />
  </a>
</template>

<style scoped>
/* Rule 3, with its stated exception: a list row is so obviously the object of
   its column that a permanent fill on each would add forty boxes. Rows light
   up on hover instead. */
.bm-story {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--noir-s5);
  padding: 10px var(--noir-s5);
  border-radius: var(--noir-r);
  color: inherit;
  text-decoration: none;
  transition: background 0.16s;
}
.bm-story:hover {
  background: var(--noir-plane-2);
}
.bm-story[aria-current='page'] {
  background: var(--noir-plane-4);
}
.bm-story-id {
  font-family: var(--noir-display);
  font-size: var(--noir-t4);
  font-weight: 600;
  color: var(--noir-ink);
}
.bm-story-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.bm-story-title {
  font-family: var(--noir-display);
  font-size: var(--noir-t4);
  font-weight: 400;
  color: var(--noir-ink);
  overflow-wrap: anywhere;
}
.bm-story-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--noir-s5);
  font-size: var(--noir-t2);
  color: var(--noir-ink-3);
}
.bm-story-missing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--noir-warn);
}
@media (max-width: 640px) {
  .bm-story {
    grid-template-columns: 44px minmax(0, 1fr);
    row-gap: var(--noir-s3);
  }
  .bm-story :deep(.bm-badge) {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
