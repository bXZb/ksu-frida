<script setup lang="ts">
import { computed } from "vue";
import type { InjectedLibrary } from "../types";

const props = defineProps<{ modelValue: InjectedLibrary[] }>();
const emit = defineEmits<{ "update:modelValue": [InjectedLibrary[]] }>();

const text = computed({
  get: () => props.modelValue.map((l) => l.path).join("\n"),
  set: (value: string) => {
    emit(
      "update:modelValue",
      value
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((path) => ({ path })),
    );
  },
});
</script>

<template>
  <textarea v-model="text" rows="3" spellcheck="false" />
</template>
