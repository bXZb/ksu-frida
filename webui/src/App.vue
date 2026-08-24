<script setup lang="ts">
import { onMounted } from "vue";
import AppPicker from "./components/AppPicker.vue";
import GadgetPanel from "./components/GadgetPanel.vue";
import TargetCard from "./components/TargetCard.vue";
import { useFrida } from "./composables/useFrida";

const {
  available,
  tab,
  config,
  expanded,
  appFilter,
  fetchingApps,
  pickerOpen,
  pickerQuery,
  filteredApps,
  gadgetInstalled,
  gadgetDetail,
  gadgetJson,
  gadgetJsonStatus,
  gadgetPath,
  gadgetScan,
  scanning,
  installing,
  clearLibsOnGadgetChange,
  busy,
  labelOf,
  saveAll,
  reload,
  boot,
  installGadget,
  removeGadget,
  scanGadgetCandidates,
  setAppFilter,
  openPicker,
  addTarget,
  removeTarget,
  toggleExpand,
} = useFrida();

onMounted(() => {
  void boot();
});
</script>

<template>
  <div v-if="!available" class="gate">
    <div>
      <div class="wordmark">Ksu<span>Frida</span></div>
      <p class="hint">Open this page from KernelSU Manager.</p>
    </div>
  </div>

  <div v-else class="shell">
    <header class="mast">
      <div>
        <div class="wordmark">Ksu<span>Frida</span></div>
        <p class="lede">Gadget injection</p>
      </div>
      <button
        class="chip"
        :class="gadgetInstalled ? 'live' : 'missing'"
        type="button"
        @click="tab = 'gadget'"
      >
        {{ gadgetInstalled ? "Gadget live" : "Gadget missing" }}
      </button>
    </header>

    <nav class="tabs">
      <button type="button" :class="{ active: tab === 'targets' }" @click="tab = 'targets'">Targets</button>
      <button type="button" :class="{ active: tab === 'gadget' }" @click="tab = 'gadget'">Gadget</button>
    </nav>

    <main class="stage">
      <section v-if="tab === 'targets'" class="deck">
        <div class="row">
          <span class="lede" style="margin:0">{{ config.targets.length }} hooked</span>
          <button class="solid" type="button" @click="openPicker">Add app</button>
        </div>

        <div v-if="!config.targets.length" class="empty">
          <strong>No probes yet</strong>
          Add an app, then install a gadget on the other tab.
        </div>

        <TargetCard
          v-for="(target, index) in config.targets"
          :key="target.app_name"
          :target="target"
          :label="labelOf(target.app_name)"
          :open="Boolean(expanded[target.app_name])"
          @toggle="toggleExpand(target.app_name)"
          @remove="removeTarget(index)"
        />
      </section>

      <GadgetPanel
        v-else
        :installed="gadgetInstalled"
        :detail="gadgetDetail"
        :json="gadgetJson"
        :json-status="gadgetJsonStatus"
        :path="gadgetPath"
        :scan="gadgetScan"
        :scanning="scanning"
        :installing="installing"
        :clear-libs="clearLibsOnGadgetChange"
        @update:json="gadgetJson = $event"
        @update:path="gadgetPath = $event"
        @update:clear-libs="clearLibsOnGadgetChange = $event"
        @scan="scanGadgetCandidates"
        @install="installGadget"
        @remove="removeGadget"
        @pick="gadgetPath = $event"
      />
    </main>

    <footer class="dock">
      <button class="ghost" type="button" :disabled="busy" @click="reload">Reload</button>
      <button class="solid" type="button" :disabled="busy" @click="saveAll">Save</button>
    </footer>
  </div>

  <AppPicker
    v-if="pickerOpen"
    :query="pickerQuery"
    :filter="appFilter"
    :apps="filteredApps"
    :loading="fetchingApps"
    :label-of="labelOf"
    @close="pickerOpen = false"
    @update:query="pickerQuery = $event"
    @update:filter="setAppFilter"
    @pick="addTarget"
  />
</template>
