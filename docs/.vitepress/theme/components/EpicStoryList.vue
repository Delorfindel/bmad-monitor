<script setup lang="ts">
import { useSprint } from '../useSprint'
import ProgressBar from './ProgressBar.vue'
import StoryRow from './StoryRow.vue'

const { epic } = useSprint()
</script>

<template>
  <section v-if="epic" class="bm-epic-stories" aria-label="Stories in this epic">
    <ProgressBar :counts="epic.progress" :label="`Epic ${epic.number} progress`" />
    <div class="bm-epic-rows">
      <StoryRow v-for="story in epic.stories" :key="story.key" :story="story" />
    </div>
    <p v-if="epic.stories.length === 0" class="bm-epic-empty">
      No story of this epic is in the current sprint scope.
    </p>
  </section>
</template>

<style scoped>
.bm-epic-stories {
  display: flex;
  flex-direction: column;
  gap: var(--noir-s5);
  margin: var(--noir-s6) 0 var(--noir-s8);
  padding: var(--noir-s5);
  border-radius: var(--noir-r-lg);
  background: var(--noir-plane-2);
}
.bm-epic-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bm-epic-empty {
  margin: 0;
  padding: var(--noir-s6);
  border-radius: var(--noir-r);
  background-color: var(--noir-inset);
  background-image: var(--noir-hachure);
  text-align: center;
  font-size: var(--noir-t3);
  color: var(--noir-ink-3);
}
</style>
