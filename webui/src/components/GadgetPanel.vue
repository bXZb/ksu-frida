<script setup lang="ts">
defineProps<{
  installed: boolean;
  detail: string;
  json: string;
  jsonStatus: "ok" | "missing" | "invalid";
  path: string;
  scan: string[];
  scanning: boolean;
  installing: boolean;
  clearLibs: boolean;
}>();

const emit = defineEmits<{
  "update:json": [string];
  "update:path": [string];
  "update:clearLibs": [boolean];
  scan: [];
  install: [];
  remove: [];
  pick: [string];
}>();
</script>

<template>
  <section class="deck">
    <article class="probe" style="padding:14px">
      <div class="row">
        <strong>Binary</strong>
        <span :class="installed ? 'status-ok' : 'status-warn'">{{ installed ? "Installed" : "Missing" }}</span>
      </div>
      <p class="hint">
        Gadget is not bundled. Copy a Frida gadget <span class="mono">.so</span> onto the device, then install it as
        <span class="mono">libsecmon.so</span>.
      </p>
      <p class="mono">{{ detail }}</p>
      <div class="field">
        <label>Install from path</label>
        <input
          :value="path"
          type="text"
          placeholder="/sdcard/Download/frida-gadget-android-arm64.so"
          @input="emit('update:path', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="actions">
        <button class="ghost" type="button" :disabled="scanning" @click="emit('scan')">
          {{ scanning ? "Scanning…" : "Scan device" }}
        </button>
        <button class="solid" type="button" :disabled="installing" @click="emit('install')">
          {{ installing ? "Installing…" : "Install" }}
        </button>
        <button class="ghost" type="button" @click="emit('remove')">Remove</button>
      </div>
      <label class="check">
        <input
          type="checkbox"
          :checked="clearLibs"
          @change="emit('update:clearLibs', ($event.target as HTMLInputElement).checked)"
        />
        Also clear injected libraries on all targets
      </label>
      <div v-if="scan.length" class="scan">
        <button v-for="item in scan" :key="item" type="button" @click="emit('pick', item)">{{ item }}</button>
      </div>
    </article>

    <article class="probe" style="padding:14px">
      <div class="row">
        <strong>Listen config</strong>
        <span
          :class="{
            'status-ok': jsonStatus === 'ok',
            'status-err': jsonStatus === 'invalid',
            'status-warn': jsonStatus === 'missing',
          }"
        >
          {{ jsonStatus === "ok" ? "OK" : jsonStatus === "invalid" ? "Invalid JSON" : "Not found" }}
        </span>
      </div>
      <textarea
        class="json-editor"
        spellcheck="false"
        :value="json"
        @input="emit('update:json', ($event.target as HTMLTextAreaElement).value)"
      />
    </article>
  </section>
</template>
