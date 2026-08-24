<script setup lang="ts">
import type { Target } from "../types";
import AppIcon from "./AppIcon.vue";
import PathList from "./PathList.vue";
import Toggle from "./Toggle.vue";

defineProps<{
  target: Target;
  label: string;
  open: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  remove: [];
}>();
</script>

<template>
  <article class="probe">
    <div class="probe-head" @click="emit('toggle')">
      <AppIcon :pkg="target.app_name" :label="label" />
      <div class="meta">
        <div class="name" :title="`${label} (${target.app_name})`">{{ label }}</div>
        <div class="pkg">{{ target.app_name }}</div>
      </div>
      <Toggle v-model="target.enabled" />
      <button class="danger" type="button" aria-label="Remove" @click.stop="emit('remove')">×</button>
    </div>
    <div v-if="open" class="probe-body">
      <div class="row" style="margin-top:10px">
        <span class="lede" style="margin:0">Kernel evasion</span>
        <Toggle v-model="target.kernel_assisted_evasion" />
      </div>
      <div class="field">
        <label>Delay (ms)</label>
        <input v-model.number="target.start_up_delay_ms" type="number" min="0" />
      </div>
      <div class="field">
        <label>Injected libraries</label>
        <PathList v-model="target.injected_libraries" />
      </div>
      <div class="field">
        <div class="row">
          <label style="margin:0">Child gating</label>
          <Toggle v-model="target.child_gating.enabled" />
        </div>
        <template v-if="target.child_gating.enabled">
          <select v-model="target.child_gating.mode" style="margin-top:8px">
            <option value="freeze">Freeze</option>
            <option value="kill">Kill</option>
            <option value="inject">Inject</option>
          </select>
          <div class="field">
            <label>Child libraries</label>
            <PathList v-model="target.child_gating.injected_libraries" />
          </div>
        </template>
      </div>
    </div>
  </article>
</template>
