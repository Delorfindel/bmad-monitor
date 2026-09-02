<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardWarning } from '../../../../src/bmad/types'

const props = defineProps<{ warnings: DashboardWarning[] }>()
const blocking = computed(() =>
  props.warnings.filter((warning) => warning.severity === 'warning')
)
</script>

<template>
  <details v-if="warnings.length > 0" class="bm-warnings" :open="blocking.length > 0">
    <summary>
      <span class="bm-badge" data-status="in-progress">
        <span class="bm-dot" aria-hidden="true" />
        {{ warnings.length }} data {{ warnings.length === 1 ? 'notice' : 'notices' }}
      </span>
      <span class="bm-warnings-hint">Missing files and unrecognised values found while reading the sprint</span>
    </summary>
    <ul>
      <li v-for="(warning, index) in warnings" :key="index" :data-severity="warning.severity">
        <span class="bm-eyebrow">{{ warning.code }}</span>
        <span class="bm-warnings-message">{{ warning.message }}</span>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.bm-warnings {
  padding: var(--noir-s4) var(--noir-s5);
  border-radius: var(--noir-r);
  background: var(--noir-plane-1);
}
summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--noir-s4);
  cursor: pointer;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
.bm-warnings-hint {
  font-size: var(--noir-t2);
  color: var(--noir-ink-3);
}
ul {
  margin: var(--noir-s5) 0 var(--noir-s2);
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
li {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: var(--noir-s4);
  padding: var(--noir-s4) var(--noir-s5);
  border-radius: var(--noir-r-sm);
  background: var(--noir-plane-2);
}
li[data-severity='info'] {
  background: transparent;
}
.bm-warnings-message {
  font-family: var(--noir-prose);
  font-size: var(--noir-t2);
  line-height: 1.5;
  color: var(--noir-ink-2);
  overflow-wrap: anywhere;
}
@media (max-width: 720px) {
  li {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--noir-s2);
  }
}
</style>
