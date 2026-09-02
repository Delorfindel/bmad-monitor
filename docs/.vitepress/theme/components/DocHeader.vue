<script setup lang="ts">
import { computed } from 'vue'
import { useSprint } from '../useSprint'
import StatusBadge from './StatusBadge.vue'

const { sprint, story, epic, kind } = useSprint()

const externalUrl = computed(() => story.value?.externalUrl ?? epic.value?.planningExternalUrl)
const externalLabel = computed(() =>
  story.value ? 'View story on GitHub' : 'View planning source on GitHub'
)
</script>

<template>
  <header v-if="kind" class="bm-doc-head">
    <nav class="bm-crumbs" aria-label="Breadcrumb">
      <a href="/">{{ sprint.project }}</a>
      <span aria-hidden="true">/</span>
      <a v-if="epic" :href="epic.route">Epic {{ epic.number }}</a>
      <template v-if="story">
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ story.label }}</span>
      </template>
      <template v-if="kind === 'context'">
        <span aria-hidden="true">/</span>
        <span aria-current="page">Linked document</span>
      </template>
    </nav>

    <div class="bm-doc-meta">
      <StatusBadge
        v-if="story"
        :status="story.status"
        context="BMAD story status"
      />
      <StatusBadge
        v-else-if="kind === 'epic' && epic"
        :status="epic.status"
        kind="epic"
        context="BMAD epic status"
      />
      <span v-if="story?.missingSource" class="bm-badge bm-badge--plain">
        No story file at this revision
      </span>
      <span class="bm-doc-spacer" />
      <a v-if="externalUrl" class="bm-link" :href="externalUrl" rel="noreferrer">
        {{ externalLabel }}
      </a>
      <a class="bm-link" href="/">Back to dashboard</a>
    </div>
  </header>
</template>

<style scoped>
.bm-doc-head {
  display: flex;
  flex-direction: column;
  gap: var(--noir-s4);
  margin-bottom: var(--noir-s6);
}
.bm-crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--noir-s2);
  font-family: var(--noir-display);
  font-size: var(--noir-t2);
}
.bm-crumbs a,
.bm-crumbs span[aria-current] {
  padding: 4px 11px;
  border-radius: var(--noir-r-pill);
  background: var(--noir-plane-2);
  color: var(--noir-ink-3);
  text-decoration: none;
}
.bm-crumbs span[aria-current] {
  background: var(--noir-plane-4);
  color: var(--noir-ink);
}
.bm-crumbs span[aria-hidden] {
  padding: 0;
  background: none;
  color: var(--noir-ink-4);
}
.bm-doc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--noir-s3);
}
.bm-doc-spacer {
  flex: 1 1 auto;
}
</style>
