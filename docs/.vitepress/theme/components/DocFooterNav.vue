<script setup lang="ts">
import { useSprint } from '../useSprint'

const { epic, previous, next, kind } = useSprint()
</script>

<template>
  <nav v-if="kind" class="bm-docnav" aria-label="Sprint navigation">
    <a v-if="previous" class="bm-docnav-item" :href="previous.route" rel="prev">
      <span class="bm-eyebrow">Previous</span>
      <span class="bm-docnav-label">{{ previous.label }} — {{ previous.title }}</span>
    </a>
    <span v-else class="bm-docnav-item bm-docnav-item--empty" />

    <a v-if="next" class="bm-docnav-item bm-docnav-item--next" :href="next.route" rel="next">
      <span class="bm-eyebrow">Next</span>
      <span class="bm-docnav-label">{{ next.label }} — {{ next.title }}</span>
    </a>
    <span v-else class="bm-docnav-item bm-docnav-item--empty" />

    <p class="bm-docnav-links">
      <a v-if="epic && kind !== 'epic'" class="bm-link" :href="epic.route">
        Back to epic {{ epic.number }}
      </a>
      <a class="bm-link" href="/">Back to dashboard</a>
    </p>
  </nav>
</template>

<style scoped>
.bm-docnav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--noir-s2);
  margin-top: var(--noir-s7);
}
.bm-docnav-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: var(--noir-s5) var(--noir-s6);
  border-radius: var(--noir-r);
  background: var(--noir-plane-1);
  color: inherit;
  text-decoration: none;
  transition: background 0.15s;
}
.bm-docnav-item--next {
  text-align: right;
}
.bm-docnav-item--empty {
  background: transparent;
}
.bm-docnav-item:hover {
  background: var(--noir-plane-3);
}
.bm-docnav-label {
  font-family: var(--noir-display);
  font-size: var(--noir-t3);
  font-weight: 500;
  overflow-wrap: anywhere;
}
.bm-docnav-links {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--noir-s3);
  margin: var(--noir-s4) 0 0;
}
@media (max-width: 640px) {
  .bm-docnav {
    grid-template-columns: minmax(0, 1fr);
  }
  .bm-docnav-item--next {
    text-align: left;
  }
}
</style>
