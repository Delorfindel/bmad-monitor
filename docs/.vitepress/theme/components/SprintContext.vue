<script setup lang="ts">
import type { SprintContextBlock } from '../../../../src/bmad/types'
import { toParagraphs, tokenizeParagraph } from '../format'

defineProps<{ blocks: SprintContextBlock[] }>()

const TONE_LABEL: Record<string, string> = {
  paused: 'Paused',
  blocked: 'Blocked',
  note: 'Note'
}
</script>

<template>
  <section v-if="blocks.length > 0" class="bm-context" aria-label="Sprint context">
    <article v-for="block in blocks" :key="block.id" class="bm-context-card" :data-tone="block.tone">
      <header class="bm-context-head">
        <span class="bm-context-tone">
          <span class="bm-dot" aria-hidden="true" />
          {{ TONE_LABEL[block.tone] ?? 'Note' }}
        </span>
        <h3>{{ block.title }}</h3>
      </header>
      <p v-for="(paragraph, index) in toParagraphs(block.body)" :key="index">
        <template v-for="(token, tokenIndex) in tokenizeParagraph(paragraph)" :key="tokenIndex">
          <code v-if="token.code">{{ token.text }}</code>
          <template v-else>{{ token.text }}</template>
        </template>
      </p>
      <p v-if="block.references.length > 0" class="bm-context-refs">
        <template v-for="reference in block.references" :key="reference.path">
          <a v-if="reference.route" class="bm-link" :href="reference.route">{{ reference.title }}</a>
          <a
            v-else-if="reference.externalUrl"
            class="bm-link"
            :href="reference.externalUrl"
            rel="noreferrer"
            >{{ reference.title }}</a
          >
          <span v-else class="bm-badge bm-badge--plain">{{ reference.title }} — not found</span>
        </template>
      </p>
      <p class="bm-context-note">
        Operational context read from the sprint status comments. It does not change any BMAD
        status.
      </p>
    </article>
  </section>
</template>

<style scoped>
.bm-context {
  display: flex;
  flex-direction: column;
  gap: var(--noir-s4);
}
.bm-context-card {
  padding: var(--noir-s6) var(--noir-s7);
  border-radius: var(--noir-r-lg);
  background: var(--noir-plane-1);
}
.bm-context-card[data-tone='paused'] {
  --bm-hue: var(--noir-warn);
  background: color-mix(in srgb, var(--noir-warn) 12%, var(--noir-plane-1));
}
.bm-context-card[data-tone='blocked'] {
  --bm-hue: var(--noir-danger);
  background: color-mix(in srgb, var(--noir-danger) 12%, var(--noir-plane-1));
}
.bm-context-card[data-tone='note'] {
  --bm-hue: var(--noir-info);
  background: color-mix(in srgb, var(--noir-info) 10%, var(--noir-plane-1));
}
.bm-context-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--noir-s4);
  margin-bottom: var(--noir-s4);
}
.bm-context-tone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--noir-r-pill);
  background: color-mix(in srgb, var(--bm-hue) 22%, transparent);
  color: var(--bm-hue);
  font-family: var(--noir-display);
  font-size: var(--noir-t1);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.bm-context-head h3 {
  margin: 0;
  font-family: var(--noir-display);
  font-size: var(--noir-t5);
  font-weight: 500;
  letter-spacing: -0.02em;
}
.bm-context-card p {
  margin: 0 0 var(--noir-s4);
  font-family: var(--noir-prose);
  font-size: var(--noir-t3);
  line-height: 1.6;
  color: var(--noir-ink-2);
  white-space: pre-line;
}
.bm-context-card code {
  padding: 1px 5px;
  border-radius: var(--noir-r-xs);
  background: color-mix(in srgb, var(--noir-ink) 8%, transparent);
  font-size: 0.92em;
}
.bm-context-refs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--noir-s3);
}
.bm-context-note {
  margin: 0;
  font-size: var(--noir-t1) !important;
  color: var(--noir-ink-3) !important;
}
</style>
