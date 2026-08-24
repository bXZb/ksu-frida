<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import type { AppFilter } from "../types";
import AppIcon from "./AppIcon.vue";

defineProps<{
  open: boolean;
  query: string;
  filter: AppFilter;
  apps: string[];
  loading: boolean;
  labelOf: (pkg: string) => string;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  "update:query": [string];
  "update:filter": [AppFilter];
  pick: [string];
}>();
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="sheet" />
      <DialogContent class="sheet-card" aria-describedby="undefined">
        <div class="row">
          <DialogTitle as="strong">Select app</DialogTitle>
          <DialogClose class="quiet" type="button">Close</DialogClose>
        </div>
        <input
          :value="query"
          type="text"
          placeholder="Search packages…"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        />
        <div class="seg">
          <button type="button" class="ghost" :class="{ active: filter === 'user' }" @click="emit('update:filter', 'user')">User</button>
          <button type="button" class="ghost" :class="{ active: filter === 'system' }" @click="emit('update:filter', 'system')">System</button>
          <button type="button" class="ghost" :class="{ active: filter === 'all' }" @click="emit('update:filter', 'all')">All</button>
        </div>
        <div class="sheet-list">
          <p v-if="loading && !apps.length" class="empty">Loading apps…</p>
          <p v-else-if="!apps.length" class="empty">No apps found</p>
          <button
            v-for="pkg in apps"
            :key="pkg"
            class="app-hit"
            type="button"
            @click="emit('pick', pkg)"
          >
            <AppIcon :pkg="pkg" :label="labelOf(pkg)" />
            <div class="meta">
              <div class="name">{{ labelOf(pkg) }}</div>
              <div class="pkg">{{ pkg }}</div>
            </div>
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
