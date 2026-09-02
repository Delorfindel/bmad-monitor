<script setup lang="ts">
import { computed } from 'vue'
import { formatTimestamp, percent } from '../format'
import { useSprint } from '../useSprint'
import EpicSection from './EpicSection.vue'
import ProgressBar from './ProgressBar.vue'
import SprintContext from './SprintContext.vue'
import WarningPanel from './WarningPanel.vue'

const { sprint } = useSprint()

const done = computed(() => percent(sprint.value.progress.done, sprint.value.totalStories))
const lastUpdated = computed(() => formatTimestamp(sprint.value.lastUpdated))
const linked = computed(() => sprint.value.references.filter((reference) => reference.route))
</script>

<template>
  <div class="bm-dash">
    <header class="bm-head">
      <p class="bm-eyebrow">{{ sprint.sprintLabel ?? 'Sprint' }}</p>
      <h1>{{ sprint.project }}</h1>
      <p v-if="sprint.scope" class="bm-scope">{{ sprint.scope }}</p>
      <dl class="bm-meta">
        <div v-if="lastUpdated">
          <dt>Last updated</dt>
          <dd>{{ lastUpdated }}</dd>
        </div>
        <div>
          <dt>Snapshot</dt>
          <dd>
            <a
              v-if="sprint.snapshot.commitUrl"
              :href="sprint.snapshot.commitUrl"
              rel="noreferrer"
              >{{ sprint.snapshot.shortSha }}</a
            >
            <template v-else>{{ sprint.snapshot.shortSha }}</template>
            <span class="bm-meta-sub">{{ sprint.snapshot.repository }}@{{ sprint.snapshot.ref }}</span>
          </dd>
        </div>
        <div>
          <dt>Scope source</dt>
          <dd>
            <a v-if="sprint.sprintStatusUrl" :href="sprint.sprintStatusUrl" rel="noreferrer">
              sprint-status.yaml
            </a>
            <template v-else>sprint-status.yaml</template>
            <span class="bm-meta-sub">{{ sprint.sprintStatusPath }}</span>
          </dd>
        </div>
      </dl>
    </header>

    <SprintContext :blocks="sprint.contextBlocks" />

    <section class="bm-summary" aria-label="Sprint progress">
      <div class="bm-summary-figure">
        <p class="bm-eyebrow">Stories done</p>
        <p class="bm-summary-value">
          {{ sprint.progress.done }}<span class="bm-summary-total">/{{ sprint.totalStories }}</span>
        </p>
        <p class="bm-summary-sub">{{ done }}% of the sprint scope</p>
      </div>
      <div class="bm-summary-bar">
        <ProgressBar :counts="sprint.progress" />
      </div>
    </section>

    <section class="bm-epics" aria-label="Epics">
      <EpicSection v-for="epic in sprint.epics" :key="epic.number" :epic="epic" />
    </section>

    <section v-if="linked.length > 0" class="bm-linked" aria-label="Linked documents">
      <h2 class="bm-eyebrow">Linked documents</h2>
      <div class="bm-linked-list">
        <a v-for="reference in linked" :key="reference.path" class="bm-linked-item" :href="reference.route">
          <span class="bm-linked-title">{{ reference.title }}</span>
          <span class="bm-linked-path">{{ reference.path }}</span>
        </a>
      </div>
    </section>

    <WarningPanel :warnings="sprint.warnings" />
  </div>
</template>

<style scoped>
.bm-dash {
  display: flex;
  flex-direction: column;
  /* 28px: two different subjects. The gutter is the punctuation here. */
  gap: var(--noir-s7);
}
.bm-head h1 {
  margin: var(--noir-s2) 0 0;
  font-family: var(--noir-display);
  font-size: var(--noir-t7);
  font-weight: 200;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.bm-scope {
  margin: var(--noir-s4) 0 0;
  max-width: 68ch;
  font-family: var(--noir-prose);
  font-size: var(--noir-t3);
  line-height: 1.55;
  color: var(--noir-ink-2);
}
.bm-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--noir-s4) var(--noir-s8);
  margin: var(--noir-s6) 0 0;
}
.bm-meta dt {
  font-family: var(--noir-display);
  font-size: var(--noir-t1);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--noir-ink-4);
}
.bm-meta dd {
  margin: 3px 0 0;
  font-family: var(--noir-display);
  font-size: var(--noir-t4);
  color: var(--noir-ink);
}
.bm-meta-sub {
  display: block;
  margin-top: 1px;
  font-size: var(--noir-t1);
  color: var(--noir-ink-3);
  overflow-wrap: anywhere;
}

.bm-summary {
  display: grid;
  grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  align-items: center;
  gap: var(--noir-s7);
  padding: var(--noir-s6) var(--noir-s7);
  border-radius: var(--noir-r-lg);
  background: var(--noir-plane-1);
}
.bm-summary-value {
  margin: var(--noir-s3) 0 0;
  font-family: var(--noir-display);
  font-size: var(--noir-t8);
  font-weight: 200;
  line-height: 1;
  letter-spacing: -0.04em;
}
.bm-summary-total {
  font-size: var(--noir-t6);
  color: var(--noir-ink-3);
}
.bm-summary-sub {
  margin: var(--noir-s4) 0 0;
  font-size: var(--noir-t2);
  color: var(--noir-ink-3);
}
.bm-epics {
  display: flex;
  flex-direction: column;
  gap: var(--noir-s4);
}
.bm-linked-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--noir-s2);
  margin-top: var(--noir-s4);
}
.bm-linked-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--noir-s4) var(--noir-s5);
  border-radius: var(--noir-r);
  background: var(--noir-plane-1);
  color: inherit;
  text-decoration: none;
  transition: background 0.15s;
}
.bm-linked-item:hover {
  background: var(--noir-plane-2);
}
.bm-linked-title {
  font-family: var(--noir-display);
  font-size: var(--noir-t3);
  font-weight: 500;
}
.bm-linked-path {
  font-size: var(--noir-t1);
  color: var(--noir-ink-3);
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .bm-meta {
    gap: var(--noir-s5) var(--noir-s6);
    margin-top: var(--noir-s5);
  }
  .bm-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--noir-s6);
  }
  .bm-head h1 {
    font-size: var(--noir-t6);
  }
}
</style>
