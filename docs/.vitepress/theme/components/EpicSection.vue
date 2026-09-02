<script setup lang="ts">
import { computed } from 'vue'
import type { SprintEpic } from '../../../../src/bmad/types'
import { percent } from '../format'
import ProgressBar from './ProgressBar.vue'
import StatusBadge from './StatusBadge.vue'
import StoryRow from './StoryRow.vue'

const props = defineProps<{ epic: SprintEpic }>()

/** An epic being worked on is the one a reader opened the site for. */
const open = computed(() => props.epic.status === 'in-progress')
const done = computed(() => percent(props.epic.progress.done, props.epic.stories.length))
</script>

<template>
  <details class="bm-epic" :open="open">
    <summary class="bm-epic-head">
      <span class="bm-epic-id">Epic {{ epic.number }}</span>
      <span class="bm-epic-title">{{ epic.title }}</span>
      <span class="bm-epic-count">
        {{ epic.stories.length }}
        <span class="bm-epic-count-unit">{{ epic.stories.length === 1 ? 'story' : 'stories' }}</span>
      </span>
      <span class="bm-epic-done">{{ done }}<span class="bm-epic-count-unit">% done</span></span>
      <StatusBadge :status="epic.status" kind="epic" context="Epic status" />
      <span class="bm-epic-chevron" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </summary>

    <div class="bm-epic-body">
      <ProgressBar :counts="epic.progress" compact :label="`Epic ${epic.number} progress`" />
      <div class="bm-epic-stories">
        <StoryRow v-for="story in epic.stories" :key="story.key" :story="story" />
      </div>
      <p class="bm-epic-foot">
        <a class="bm-link" :href="epic.route">Open epic {{ epic.number }}</a>
        <span v-if="epic.retrospective" class="bm-badge bm-badge--plain">
          Retrospective: {{ epic.retrospective.status }}
        </span>
      </p>
    </div>
  </details>
</template>

<style scoped>
.bm-epic {
  padding: var(--noir-s5) var(--noir-s5) var(--noir-s4);
  border-radius: var(--noir-r-lg);
  background: var(--noir-plane-1);
}
.bm-epic-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: var(--noir-s5);
  padding: var(--noir-s3) var(--noir-s5);
  border-radius: var(--noir-r);
  cursor: pointer;
  list-style: none;
  transition: background 0.15s;
}
.bm-epic-head::-webkit-details-marker {
  display: none;
}
.bm-epic-head:hover {
  background: var(--noir-plane-2);
}
.bm-epic-id {
  font-family: var(--noir-display);
  font-size: var(--noir-t2);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--noir-ink-3);
}
.bm-epic-title {
  font-family: var(--noir-display);
  font-size: var(--noir-t5);
  font-weight: 400;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.bm-epic-count,
.bm-epic-done {
  font-family: var(--noir-display);
  font-size: var(--noir-t4);
  color: var(--noir-ink-2);
  white-space: nowrap;
}
.bm-epic-count-unit {
  font-size: var(--noir-t2);
  color: var(--noir-ink-3);
}
.bm-epic-chevron {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--noir-r-sm);
  background: var(--noir-plane-3);
  color: var(--noir-ink-2);
  transition: transform 0.18s;
}
.bm-epic[open] .bm-epic-chevron {
  transform: rotate(180deg);
}
.bm-epic-body {
  display: flex;
  flex-direction: column;
  gap: var(--noir-s5);
  padding: var(--noir-s5) var(--noir-s5) var(--noir-s3);
}
.bm-epic-stories {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bm-epic-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--noir-s4);
  margin: 0;
}
@media (max-width: 860px) {
  .bm-epic-head {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: var(--noir-s3);
  }
  .bm-epic-title {
    grid-column: 1 / -1;
  }
}
</style>
