<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
</script>

<template>
  <SwitchRoot
    class="switch"
    :model-value="modelValue"
    @click.stop
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SwitchThumb class="knob" />
  </SwitchRoot>
</template>
